/**
 * 동시 접속자 100명 부하 테스트
 * 실행: node test/load-test.mjs [URL]
 * 기본 URL: http://127.0.0.1:3002
 */
import { io } from "socket.io-client";

const TARGET = process.argv[2] ?? "http://127.0.0.1:3002";
const TOTAL_CLIENTS = 100;
const ORDER_CLIENTS = 10; // 동시에 주문을 넣는 클라이언트 수

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function pct(arr, p) {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function stats(label, arr) {
  if (!arr.length) { console.log(`  ${label}: (no data)`); return; }
  const avg = arr.reduce((s, v) => s + v, 0) / arr.length;
  console.log(
    `  ${label}: avg=${avg.toFixed(1)}ms  min=${Math.min(...arr)}ms` +
    `  p95=${pct(arr, 95)}ms  max=${Math.max(...arr)}ms  n=${arr.length}`
  );
}

async function run() {
  console.log(`\n=== 부하 테스트 시작 ===`);
  console.log(`대상: ${TARGET}`);
  console.log(`클라이언트 수: ${TOTAL_CLIENTS}명 (주문 동시 실행: ${ORDER_CLIENTS}명)\n`);

  const clients = [];
  const connectTimes = [];
  const stateLatencies = [];
  const orderLatencies = [];
  const errors = [];
  let connectedCount = 0;
  let stateCount = 0;

  // ── 1. 100명 동시 접속 ──────────────────────────────────────────
  console.log("[1/4] 100명 동시 연결 시도...");
  const connectStart = Date.now();

  const connectPromises = Array.from({ length: TOTAL_CLIENTS }, (_, i) =>
    new Promise((resolve) => {
      const t0 = Date.now();
      const socket = io(TARGET, {
        transports: ["websocket"],
        reconnection: false,
        timeout: 10000,
      });

      socket.on("connect", () => {
        connectTimes.push(Date.now() - t0);
        connectedCount++;
        resolve(socket);
      });

      socket.on("connect_error", (err) => {
        errors.push(`client-${i} connect: ${err.message}`);
        resolve(null);
      });

      clients.push(socket);
    })
  );

  const sockets = (await Promise.all(connectPromises)).filter(Boolean);
  const connectElapsed = Date.now() - connectStart;
  console.log(`  완료: ${sockets.length}/${TOTAL_CLIENTS}명 연결 (${connectElapsed}ms)`);
  stats("연결 시간", connectTimes);

  if (sockets.length === 0) {
    console.error("\n연결된 클라이언트 없음. 서버가 실행 중인지 확인하세요.");
    process.exit(1);
  }

  // ── 2. 초기 state 수신 대기 ────────────────────────────────────
  console.log("\n[2/4] 초기 state 브로드캐스트 수신 대기...");
  const stateStart = Date.now();

  await new Promise((resolve) => {
    let received = 0;
    const t0 = Date.now();
    sockets.forEach((socket) => {
      socket.once("state", () => {
        stateLatencies.push(Date.now() - t0);
        received++;
        stateCount++;
        if (received === sockets.length) resolve();
      });
    });
    setTimeout(resolve, 5000); // 최대 5초 대기
  });

  console.log(`  state 수신: ${stateCount}/${sockets.length}명 (${Date.now() - stateStart}ms)`);
  stats("state 수신 지연", stateLatencies);

  // ── 3. 동시 주문 10건 ──────────────────────────────────────────
  console.log(`\n[3/4] ${ORDER_CLIENTS}명 동시 주문 제출...`);
  const orderSockets = sockets.slice(0, ORDER_CLIENTS);

  const orderPromises = orderSockets.map((socket, i) =>
    new Promise((resolve) => {
      const t0 = Date.now();
      const tableNum = String(i + 1);
      const submitId = `load-${Date.now()}-${i}`;
      socket.emit(
        "order:submit",
        {
          table: tableNum,
          quantities: { 5: 1 }, // 닭강정 1개
          partySize: 2,
          depositor: `테스터${i + 1}`,
          submitId,
        },
        (res) => {
          orderLatencies.push(Date.now() - t0);
          if (!res?.ok) errors.push(`order-${i}: ${res?.error ?? "no ack"}`);
          resolve(res);
        }
      );
      // 10초 내 응답 없으면 타임아웃
      setTimeout(() => {
        errors.push(`order-${i}: timeout`);
        resolve(null);
      }, 10000);
    })
  );

  const orderResults = await Promise.all(orderPromises);
  const okOrders = orderResults.filter((r) => r?.ok).length;
  console.log(`  성공: ${okOrders}/${ORDER_CLIENTS}건`);
  stats("주문 응답 시간", orderLatencies);

  // ── 4. 브로드캐스트 전파 지연 측정 ────────────────────────────
  console.log("\n[4/4] state 브로드캐스트 전파 지연 측정...");
  const broadcastLatencies = [];

  await new Promise((resolve) => {
    let received = 0;
    const t0 = Date.now();
    // 주문 이후 브로드캐스트를 100명 모두가 수신하는 시간 측정
    sockets.forEach((socket) => {
      socket.once("state", () => {
        broadcastLatencies.push(Date.now() - t0);
        received++;
        if (received === sockets.length) resolve();
      });
    });

    // 트리거: 추가 주문 1건
    sockets[0]?.emit("order:submit", {
      table: "99",
      quantities: { 6: 1 }, // 제육 1개
      partySize: 1,
      depositor: "브로드캐스트테스트",
      submitId: `bcast-${Date.now()}`,
    });

    setTimeout(resolve, 5000);
  });

  console.log(`  수신 완료: ${broadcastLatencies.length}/${sockets.length}명`);
  stats("브로드캐스트 전파 지연", broadcastLatencies);

  // ── 결과 요약 ──────────────────────────────────────────────────
  console.log("\n=== 결과 요약 ===");
  console.log(`연결 성공률:     ${sockets.length}/${TOTAL_CLIENTS} (${(sockets.length / TOTAL_CLIENTS * 100).toFixed(1)}%)`);
  console.log(`주문 성공률:     ${okOrders}/${ORDER_CLIENTS} (${(okOrders / ORDER_CLIENTS * 100).toFixed(1)}%)`);
  console.log(`브로드캐스트:    ${broadcastLatencies.length}/${sockets.length}명 수신`);
  stats("연결 시간", connectTimes);
  stats("주문 응답 시간", orderLatencies);
  stats("브로드캐스트 전파", broadcastLatencies);

  if (errors.length > 0) {
    console.log(`\n오류 (${errors.length}건):`);
    errors.slice(0, 10).forEach((e) => console.log(`  - ${e}`));
    if (errors.length > 10) console.log(`  ... 외 ${errors.length - 10}건`);
  }

  // ── 정리 ──────────────────────────────────────────────────────
  await sleep(500);
  clients.forEach((s) => s.disconnect());
  console.log("\n연결 종료 완료.");

  // 테이블 초기화 (선택적)
  const cleanSocket = io(TARGET, { transports: ["websocket"], reconnection: false });
  await new Promise((r) => cleanSocket.on("connect", r));
  cleanSocket.emit("system:resetAll");
  await sleep(300);
  cleanSocket.disconnect();
  console.log("테스트 데이터 초기화 완료.\n");
}

run().catch((e) => {
  console.error("테스트 실패:", e);
  process.exit(1);
});
