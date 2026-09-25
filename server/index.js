/**
 * 주점 주문 관리 — Express + Socket.io 서버
 * 상태는 인메모리로 관리하며 STATE_FILE(JSON)에 저장해 재시작 시 복구합니다.
 */

import express from "express";
import fs from "fs";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { Server } from "socket.io";
import { MENU_LIST, COVER_MENU_ID, GAME_MENU_ID, expandKitchenLines } from "../shared/menu.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3002;
const STATE_FILE = process.env.STATE_FILE || path.join(__dirname, "..", "data", "state.json");
const distDir = path.join(__dirname, "..", "dist");
const distIndex = path.join(distDir, "index.html");
/** 빌드 산출물이 있으면 단일 포트로 정적 호스팅 (npm start) */
const hasDist = fs.existsSync(distIndex);

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  pingTimeout: 60000,
  pingInterval: 25000,
  cors: !hasDist
    ? { origin: ["http://127.0.0.1:5173", "http://localhost:5173"], methods: ["GET", "POST"] }
    : undefined,
});

/** @typedef {{ menuId: number, name: string, price: number, qty: number, status: "pending" | "done" | "served", lineKey?: string }} OrderLine */
/** @typedef {{ id: string, table: string, items: OrderLine[], createdAt: number, joinedTables?: string[] }} KitchenOrder */

/** @typedef {{ timerStartedAt: number | null, coverQty: number, partySize: number, depositor: string, depositors: string, totalAmount: number, orderHistory: Array<{items: Array<{name:string,price:number,qty:number}>, subtotal:number, createdAt:number}> }} TableState */
/** @returns {TableState} */
const defaultTableState = () => ({ timerStartedAt: null, coverQty: 0, partySize: 0, depositor: "", depositors: "", totalAmount: 0, orderHistory: [] });

/** 서버 단일 상태 */
const state = {
  soldOutIds: new Set(),
  kitchenQueue: /** @type {KitchenOrder[]} */ ([]),
  /** 테이블별: timerStartedAt은 첫 주문 시각, coverQty는 접수된 자릿세 수량 합 */
  tables: /** @type {Record<string, TableState>} */ ({}),
  settings: {
    /** 경고까지 기본 허용 시간(분) */
    defaultLimitMinutes: 120,
  },
  /** 매출 집계: 「주문 완료」 접수 기준(state.json에 영속 저장) */
  salesStats: {
    /** menuId -> 누적 */
    byMenuId: /** @type {Record<number, { qty: number, revenue: number }>} */ ({}),
    totalRevenue: 0,
    /** 주문 완료 버튼이 성공한 횟수 */
    orderSubmitCount: 0,
  },
  reservations: /** @type {{ id: string, name: string, partySize: number, phone: string, createdAt: number }[]} */ ([]),
  /** 합석 그룹: 각 그룹은 2개 이상 테이블 번호, 그룹끼리 겹치지 않음 */
  joinGroups: /** @type {string[][]} */ ([]),
};

function randomId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** 중복 주문 방지: 최근 submitId 100건 캐시 */
const recentSubmitIds = [];
function isDuplicateSubmit(id) {
  if (!id || recentSubmitIds.includes(id)) return true;
  recentSubmitIds.push(id);
  if (recentSubmitIds.length > 100) recentSubmitIds.shift();
  return false;
}

/** 클라이언트로 보낼 직렬화 가능한 스냅샷 */
function getSnapshot() {
  return {
    menu: MENU_LIST,
    soldOutIds: [...state.soldOutIds],
    kitchenQueue: state.kitchenQueue,
    tables: Object.fromEntries(
      Object.entries(state.tables).map(([k, v]) => {
        return [
          k,
          {
            timerStartedAt: v.timerStartedAt,
            coverQty: Math.max(0, Math.floor(Number(v.coverQty) || 0)),
            partySize: Math.max(0, Math.floor(Number(v.partySize) || 0)),
            depositor: String(v.depositor ?? ""),
            depositors: String(v.depositors ?? ""),
            totalAmount: Math.max(0, Math.floor(Number(v.totalAmount) || 0)),
            orderHistory: Array.isArray(v.orderHistory) ? v.orderHistory : [],
          },
        ];
      })
    ),
    settings: { ...state.settings },
    salesStats: {
      menuLines: MENU_LIST.map((m) => {
        const row = state.salesStats.byMenuId[m.id];
        return {
          menuId: m.id,
          name: m.name,
          category: m.category,
          qty: row?.qty ?? 0,
          revenue: row?.revenue ?? 0,
        };
      }),
      totalRevenue: state.salesStats.totalRevenue,
      orderSubmitCount: state.salesStats.orderSubmitCount,
    },
    reservations: state.reservations.map((r) => ({ ...r })),
    joinGroups: state.joinGroups,
  };
}

function saveState() {
  try {
    const dir = path.dirname(STATE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const tmp = STATE_FILE + ".tmp";
    fs.writeFileSync(
      tmp,
      JSON.stringify({
        soldOutIds: [...state.soldOutIds],
        kitchenQueue: state.kitchenQueue,
        tables: state.tables,
        settings: state.settings,
        salesStats: state.salesStats,
        reservations: state.reservations,
        joinGroups: state.joinGroups,
      }),
      "utf8"
    );
    fs.renameSync(tmp, STATE_FILE);
  } catch (e) {
    console.error("[state] 저장 실패:", e.message);
  }
}

function loadState() {
  try {
    if (!fs.existsSync(STATE_FILE)) return;
    const raw = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
    if (Array.isArray(raw.soldOutIds)) state.soldOutIds = new Set(raw.soldOutIds);
    if (Array.isArray(raw.kitchenQueue)) {
      state.kitchenQueue = raw.kitchenQueue;
      /* 구버전 저장 파일: done(boolean) → status로 변환 */
      for (const o of state.kitchenQueue) {
        for (const it of o.items ?? []) {
          if (!it.status) it.status = it.done ? "done" : "pending";
          delete it.done;
        }
      }
    }
    if (raw.tables && typeof raw.tables === "object") state.tables = raw.tables;
    if (raw.settings?.defaultLimitMinutes) state.settings.defaultLimitMinutes = raw.settings.defaultLimitMinutes;
    if (raw.salesStats) state.salesStats = { ...state.salesStats, ...raw.salesStats };
    if (Array.isArray(raw.reservations)) state.reservations = raw.reservations;
    if (Array.isArray(raw.joinGroups)) state.joinGroups = raw.joinGroups;
    console.log("[state] 저장된 상태를 복구했습니다.");
  } catch (e) {
    console.error("[state] 복구 실패, 초기 상태로 시작:", e.message);
  }
}

loadState();

function broadcastState() {
  saveState();
  io.emit("state", getSnapshot());
}

/** 「주문 완료」로 접수된 품목 기준 매출·수량 누적 */
function recordSalesFromItems(items) {
  let batch = 0;
  for (const it of items) {
    batch += it.price * it.qty;
    const prev = state.salesStats.byMenuId[it.menuId] || { qty: 0, revenue: 0 };
    state.salesStats.byMenuId[it.menuId] = {
      qty: prev.qty + it.qty,
      revenue: prev.revenue + it.price * it.qty,
    };
  }
  state.salesStats.totalRevenue += batch;
  state.salesStats.orderSubmitCount += 1;
}

/** 테이블이 속한 합석 그룹(없으면 자기 자신만) */
function groupOf(table) {
  return state.joinGroups.find((g) => g.includes(table)) ?? [table];
}

function removeFromJoinGroups(table) {
  state.joinGroups = state.joinGroups
    .map((g) => g.filter((t) => t !== table))
    .filter((g) => g.length >= 2);
}

/**
 * 주문 접수: 주방 큐 추가. 타이머는 해당 테이블에 처음 주문이 들어올 때만 시작(추가 주문은 타이머 건드리지 않음).
 */
function submitOrder(tableRaw, items, partySize, depositor) {
  const table = String(tableRaw).trim();
  if (!table) return { ok: false, error: "테이블 번호를 입력하세요." };
  if (!items.length) return { ok: false, error: "주문할 메뉴를 선택하세요." };

  for (const it of items) {
    if (state.soldOutIds.has(it.menuId)) {
      return { ok: false, error: `품절 메뉴가 포함되어 있습니다: ${it.name}` };
    }
  }

  recordSalesFromItems(items);

  if (!state.tables[table]) {
    state.tables[table] = defaultTableState();
  }
  const ts = state.tables[table];

  let coverAdded = 0;
  for (const it of items) {
    if (it.menuId === COVER_MENU_ID) coverAdded += it.qty;
  }
  if (coverAdded > 0) {
    ts.coverQty = Math.max(0, Math.floor(Number(ts.coverQty) || 0)) + coverAdded;
  }

  if (partySize > 0) {
    ts.partySize = Math.max(0, Math.floor(Number(ts.partySize) || 0)) + partySize;
  }
  if (depositor) {
    ts.depositor = depositor;
    const existing = ts.depositors ? ts.depositors.split(",").map((s) => s.trim()) : [];
    if (!existing.includes(depositor)) {
      ts.depositors = existing.length > 0 ? `${ts.depositors}, ${depositor}` : depositor;
    }
  }
  const subtotal = items.reduce((s, it) => s + it.price * it.qty, 0);
  ts.totalAmount = Math.max(0, Math.floor(Number(ts.totalAmount) || 0)) + subtotal;
  if (!Array.isArray(ts.orderHistory)) ts.orderHistory = [];
  ts.orderHistory.push({
    items: items.map((it) => ({ name: it.name, price: it.price, qty: it.qty })),
    subtotal,
    createdAt: Date.now(),
  });

  const kitchenItems = items.filter((it) => it.menuId !== COVER_MENU_ID && it.menuId !== GAME_MENU_ID);
  if (kitchenItems.length > 0) {
    const flatLines = expandKitchenLines(kitchenItems);
    const order = {
      id: randomId(),
      table,
      items: flatLines.map((i) => ({ ...i, status: "pending", lineKey: randomId() })),
      createdAt: Date.now(),
    };
    const group = groupOf(table);
    if (group.length >= 2) order.joinedTables = [...group];
    state.kitchenQueue.push(order);
  }

  /* 타이머는 합석 그룹 단위: 그룹 중 가장 이른 시작 기준, 시간 초과 후 주문 시 그룹 전체 재시작 */
  const members = groupOf(table);
  const starts = members.map((t) => state.tables[t]?.timerStartedAt).filter((v) => v != null);
  const groupStart = starts.length ? Math.min(...starts) : null;
  if (groupStart == null || Date.now() - groupStart >= state.settings.defaultLimitMinutes * 60 * 1000) {
    const now = Date.now();
    for (const t of members) {
      if (!state.tables[t]) state.tables[t] = defaultTableState();
      state.tables[t].timerStartedAt = now;
    }
  }

  return { ok: true };
}

/** 주방 라인 찾기: lineKey 우선, 없으면 lineIndex(구버전 데이터용) */
function findKitchenLine(payload) {
  const order = state.kitchenQueue.find((o) => o.id === payload?.orderId);
  if (!order?.items?.length) return null;
  const lineKey = typeof payload?.lineKey === "string" ? payload.lineKey : "";
  if (lineKey) {
    const line = order.items.find((it) => it.lineKey === lineKey);
    if (line) return line;
  }
  const n = parseInt(String(payload?.lineIndex), 10);
  return Number.isInteger(n) && n >= 0 && n < order.items.length ? order.items[n] : null;
}

io.on("connection", (socket) => {
  socket.emit("state", getSnapshot());

  socket.on("order:submit", (payload, ack) => {
    const { table, quantities, partySize, submitId, depositor } = payload || {};
    if (isDuplicateSubmit(submitId)) {
      if (typeof ack === "function") ack({ ok: false, error: "중복 주문입니다." });
      return;
    }
    const q = quantities && typeof quantities === "object" ? quantities : {};
    const ps = Math.max(0, Math.floor(Number(partySize) || 0));
    const dep = String(depositor ?? "").trim().slice(0, 40);
    const items = [];
    for (const m of MENU_LIST) {
      const qty = Math.max(0, Math.floor(Number(q[m.id]) || 0));
      if (qty > 0) items.push({ menuId: m.id, name: m.name, price: m.price, qty });
    }
    const res = submitOrder(table, items, ps, dep);
    if (res.ok) broadcastState();
    if (typeof ack === "function") ack(res);
    if (!res.ok && res.error) socket.emit("error:toast", res.error);
  });

  /** 메뉴(라인) 단위 조리 완료: pending → done */
  socket.on("kitchen:completeLine", (payload) => {
    const line = findKitchenLine(payload);
    if (!line || line.status !== "pending") return;
    line.status = "done";
    broadcastState();
  });

  /** 되돌리기: 어떤 상태든 pending으로 */
  socket.on("kitchen:uncompleteLine", (payload) => {
    const line = findKitchenLine(payload);
    if (!line) return;
    line.status = "pending";
    broadcastState();
  });

  /** 서빙 완료: done → served */
  socket.on("kitchen:serveLine", (payload) => {
    const line = findKitchenLine(payload);
    if (!line || line.status !== "done") return;
    line.status = "served";
    broadcastState();
  });

  socket.on("kitchen:soldOut:toggle", (menuId) => {
    const id = Number(menuId);
    if (!MENU_LIST.some((m) => m.id === id)) return;
    if (state.soldOutIds.has(id)) state.soldOutIds.delete(id);
    else state.soldOutIds.add(id);
    broadcastState();
  });

  socket.on("system:resetTable", (tableRaw) => {
    const table = String(tableRaw).trim();
    if (!table) return;
    delete state.tables[table];
    removeFromJoinGroups(table);
    state.kitchenQueue = state.kitchenQueue.filter((o) => o.table !== table);
    broadcastState();
  });

  /** 합석: 두 테이블(또는 이미 합석 중인 그룹)을 한 그룹으로 묶고 타이머를 가장 이른 시작 시각으로 맞춤 */
  socket.on("table:join", (payload, ack) => {
    const a = String(payload?.table ?? "").trim();
    const b = String(payload?.other ?? "").trim();
    const fail = (error) => {
      if (typeof ack === "function") ack({ ok: false, error });
    };
    if (!a || !b) return fail("테이블 번호를 입력하세요.");
    if (a === b) return fail("같은 테이블은 합석할 수 없습니다.");
    const merged = [...new Set([...groupOf(a), ...groupOf(b)])].sort((x, y) => Number(x) - Number(y));
    state.joinGroups = state.joinGroups.filter((g) => !g.includes(a) && !g.includes(b));
    state.joinGroups.push(merged);
    const starts = merged.map((t) => state.tables[t]?.timerStartedAt).filter((v) => v != null);
    if (starts.length) {
      const earliest = Math.min(...starts);
      for (const t of merged) {
        if (!state.tables[t]) state.tables[t] = defaultTableState();
        state.tables[t].timerStartedAt = earliest;
      }
    }
    broadcastState();
    if (typeof ack === "function") ack({ ok: true });
  });

  /** 합석 해제: 해당 테이블만 그룹에서 빠짐(타이머·금액은 테이블별로 그대로) */
  socket.on("table:unjoin", (tableRaw) => {
    const table = String(tableRaw ?? "").trim();
    if (!table) return;
    removeFromJoinGroups(table);
    broadcastState();
  });

  /** 주방 대기·테이블 타이머·매출 집계·품절 표시까지 한 번에 비움(설정값은 유지) */
  socket.on("system:resetAll", () => {
    state.kitchenQueue = [];
    state.tables = {};
    state.soldOutIds.clear();
    state.salesStats = {
      byMenuId: {},
      totalRevenue: 0,
      orderSubmitCount: 0,
    };
    state.reservations = [];
    state.joinGroups = [];
    broadcastState();
  });

  socket.on("system:setDefaultLimitMinutes", (minutes) => {
    state.settings.defaultLimitMinutes = Math.max(1, Math.floor(Number(minutes) || 120));
    broadcastState();
  });

  socket.on("reservation:create", (payload, ack) => {
    const name = String(payload?.name ?? "").trim();
    const phone = String(payload?.phone ?? "").trim();
    const partySize = Math.max(0, Math.floor(Number(payload?.partySize) || 0));
    const fail = (error) => {
      if (typeof ack === "function") ack({ ok: false, error });
    };
    if (!name) return fail("이름을 입력해 주세요.");
    if (name.length > 40) return fail("이름은 40자 이내로 입력해 주세요.");
    if (!phone) return fail("전화번호를 입력해 주세요.");
    if (phone.length > 30) return fail("전화번호가 너무 깁니다.");
    if (partySize < 1 || partySize > 99) return fail("인원수는 1~99명으로 입력해 주세요.");
    state.reservations.push({
      id: randomId(),
      name,
      phone,
      partySize,
      createdAt: Date.now(),
    });
    broadcastState();
    if (typeof ack === "function") ack({ ok: true });
  });

  socket.on("reservation:delete", (id) => {
    const rid = String(id ?? "").trim();
    if (!rid) return;
    const idx = state.reservations.findIndex((r) => r.id === rid);
    if (idx >= 0) {
      state.reservations.splice(idx, 1);
      broadcastState();
    }
  });

  socket.on("kitchen:deleteOrder", (orderId) => {
    const id = String(orderId ?? "").trim();
    if (!id) return;
    const idx = state.kitchenQueue.findIndex((o) => o.id === id);
    if (idx >= 0) {
      state.kitchenQueue.splice(idx, 1);
      broadcastState();
    }
  });
});

if (hasDist) {
  app.use(express.static(distDir));
  app.get("*", (_req, res) => {
    res.sendFile(distIndex);
  });
}

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    // eslint-disable-next-line no-console
    console.error(
      `[server] 포트 ${PORT}가 이미 사용 중입니다. 이전에 실행한 node 서버를 종료하거나 다른 포트를 쓰세요.\n` +
        `  PowerShell: $env:PORT=3001; npm start\n` +
        `  CMD: set PORT=3001&& npm start\n` +
        `  사용 중 PID 확인: netstat -ano | findstr ":${PORT}"`
    );
  } else {
    // eslint-disable-next-line no-console
    console.error(err);
  }
  process.exit(1);
});

const listenHost = process.env.LISTEN_HOST ?? "0.0.0.0";

server.listen(PORT, listenHost, () => {
  // eslint-disable-next-line no-console
  if (hasDist) {
    console.log(
      `[server] 웹 + Socket.io 포트 ${PORT} (바인딩: ${listenHost})\n` +
        `  • 이 머신 안에서만 볼 때: http://127.0.0.1:${PORT}\n` +
        `  • EC2/클라우드에서는 브라우저에 퍼블릭 IP(또는 도메인)로 접속: http://<퍼블릭IP>:${PORT}\n` +
        `    (127.0.0.1은 "내 PC"라서 다른 기기에서는 동작하지 않습니다.)`
    );
  } else {
    console.log(
      `[server] Socket.io http://127.0.0.1:${PORT} — 프론트는 Vite(5173)에서 실행하세요.`
    );
  }
});
