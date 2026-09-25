import { useEffect, useMemo, useState, useCallback } from "react";
import { useAppSocket } from "../context/SocketContext.jsx";
import { TABLE_COUNT, isValidTable } from "@shared/tables.js";

const ALL_TABLES = Array.from({ length: TABLE_COUNT }, (_, i) => String(i + 1));
/** 종료 20분 전부터 강조 — 연장 여부 확인 · 대기 손님 안내 시점 */
const SOON_MS = 20 * 60 * 1000;

function formatHM(ts) {
  return new Date(ts).toLocaleString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

/** 남은 시간 H:MM */
function formatRemain(ms) {
  const m = Math.max(0, Math.floor(ms / 60000));
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
}

function formatHMS(ms) {
  if (ms < 0) ms = 0;
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const p = (n) => String(n).padStart(2, "0");
  return `${p(h)}:${p(m)}:${p(sec)}`;
}

export default function SystemPage() {
  const { socket, connected, state } = useAppSocket();
  const [clock, setClock] = useState(0);
  const [confirmTable, setConfirmTable] = useState(null);
  const [historyTable, setHistoryTable] = useState(null);
  const [joinTable, setJoinTable] = useState(null);
  const [joinInput, setJoinInput] = useState("");
  const [joinError, setJoinError] = useState("");
  /** input: 번호 입력 → preview: 결과 확인 후 확정 / unjoin: 해제 확인 */
  const [joinStep, setJoinStep] = useState("input");

  const handleReset = useCallback((table) => {
    socket.emit("system:resetTable", table);
    setConfirmTable(null);
  }, [socket]);

  useEffect(() => {
    const id = setInterval(() => setClock((c) => c + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const defaultLimit = state?.settings?.defaultLimitMinutes ?? 120;

  /** 합석 그룹(없으면 자기 자신만) */
  const groupOf = useCallback(
    (table) => (state?.joinGroups ?? []).find((g) => g.includes(table)) ?? [table],
    [state?.joinGroups]
  );

  const tableData = useMemo(() => {
    const now = Date.now();
    return ALL_TABLES.map((table) => {
      const t = state?.tables?.[table];
      if (!t || t.timerStartedAt == null) return { table, active: false };
      /* 합석 중이면 인원·금액·입금자는 그룹 합산, 타이머는 그룹 중 가장 이른 시작 기준 */
      const group = groupOf(table);
      const members = group.map((g) => state?.tables?.[g]).filter(Boolean);
      const partySize = members.reduce((sum, m) => sum + Math.max(0, Math.floor(Number(m.partySize) || 0)), 0);
      const depositors = [
        ...new Set(
          members.flatMap((m) => (String(m.depositors ?? "") || String(m.depositor ?? "")).split(",").map((d) => d.trim()))
        ),
      ]
        .filter(Boolean)
        .join(", ");
      const totalAmount = members.reduce((sum, m) => sum + Math.max(0, Math.floor(Number(m.totalAmount) || 0)), 0);
      const startedAt = Math.min(...members.map((m) => m.timerStartedAt).filter((v) => v != null));
      const limitMin = defaultLimit;
      const elapsed = now - startedAt;
      const limitMs = limitMin * 60 * 1000;
      const over = elapsed >= limitMs;
      const remaining = Math.max(0, limitMs - elapsed);
      const soon = !over && remaining <= SOON_MS;
      return { table, active: true, remaining, over, soon, limitMin, partySize, depositors, totalAmount, group };
    });
  }, [state?.tables, groupOf, defaultLimit, clock]);

  const closeJoin = () => {
    setJoinTable(null);
    setJoinInput("");
    setJoinError("");
    setJoinStep("input");
  };

  /** "4, 5 6" → ["4", "5", "6"] (중복 제거) */
  const joinTargets = [...new Set(joinInput.split(/\D+/).filter(Boolean).map((t) => String(Number(t))))];

  /** 입력 확인 후 미리보기 단계로 */
  const handleJoinNext = () => {
    const invalid = joinTargets.filter((t) => !isValidTable(t));
    if (invalid.length) return setJoinError(`1~${TABLE_COUNT}번만 입력할 수 있습니다: ${invalid.join(", ")}`);
    if (joinTargets.includes(joinTable)) return setJoinError(`${joinTable}번 자신은 입력하지 않아도 됩니다.`);
    const alreadyJoined = joinTargets.filter((t) => groupOf(joinTable).includes(t));
    if (alreadyJoined.length === joinTargets.length) return setJoinError(`이미 합석 중인 테이블입니다: ${alreadyJoined.join(", ")}`);
    setJoinError("");
    setJoinStep("preview");
  };

  /** 합석 결과 미리보기: 최종 그룹과 테이블별 경고 */
  const buildJoinPreview = () => {
    const now = Date.now();
    const limitMs = defaultLimit * 60 * 1000;
    const myGroup = groupOf(joinTable);
    const merged = [...new Set([joinTable, ...joinTargets].flatMap((t) => groupOf(t)))].sort((a, b) => Number(a) - Number(b));
    const starts = merged.map((t) => state?.tables?.[t]?.timerStartedAt).filter((v) => v != null);
    const earliest = starts.length ? Math.min(...starts) : null;
    const rows = merged.map((t) => {
      const start = state?.tables?.[t]?.timerStartedAt ?? null;
      const warnings = [];
      const curGroup = groupOf(t);
      if (curGroup.length >= 2 && !myGroup.includes(t)) {
        warnings.push(`이미 ${curGroup.join("·")}번 합석 중 — 그룹 전체가 합쳐집니다`);
      }
      if (start == null) {
        warnings.push(earliest != null ? "빈 테이블 — 지금부터 이용 중으로 바뀝니다" : "빈 테이블");
      } else if (earliest != null && start - earliest >= 60000) {
        const before = limitMs - (now - start);
        const after = limitMs - (now - earliest);
        warnings.push(
          `남은 시간 ${formatRemain(before)} → ${formatRemain(after)} (${Math.round((start - earliest) / 60000)}분 줄어듦)`
        );
      }
      const status = start == null ? "빈 테이블" : `남은 ${formatRemain(limitMs - (now - start))}`;
      return { table: t, status, warnings };
    });
    return { merged, rows, warnCount: rows.filter((r) => r.warnings.length > 0).length };
  };

  const handleJoin = () => {
    socket.emit("table:join", { table: joinTable, others: joinTargets }, (res) => {
      if (res?.ok) closeJoin();
      else {
        setJoinError(res?.error ?? "합석에 실패했습니다.");
        setJoinStep("input");
      }
    });
  };

  const handleUnjoin = () => {
    socket.emit("table:unjoin", joinTable);
    closeJoin();
  };

  const activeCount = tableData.filter((t) => t.active).length;

  return (
    <div className="page system-page">
      {confirmTable && (
        <div className="modal-backdrop" role="presentation" onClick={() => setConfirmTable(null)}>
          <div className="modal-panel" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">{confirmTable}번 테이블 해제</h2>
            <p className="modal-body">타이머와 주방 주문이 모두 초기화됩니다. 계속할까요?</p>
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setConfirmTable(null)}>취소</button>
              <button type="button" className="btn-danger" onClick={() => handleReset(confirmTable)}>해제</button>
            </div>
          </div>
        </div>
      )}
      {joinTable && (() => {
        const group = groupOf(joinTable);
        if (joinStep === "unjoin") {
          const rest = group.filter((t) => t !== joinTable);
          return (
            <div className="modal-backdrop" role="presentation" onClick={closeJoin}>
              <div className="modal-panel" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
                <h2 className="modal-title">{joinTable}번 합석 해제</h2>
                <p className="modal-body">
                  {joinTable}번을 합석({group.join("·")}번)에서 뺄까요? 타이머는 합석 전으로 돌아갑니다. (합석 중 시간이 초과돼 다시 시작된 경우에는 현재 타이머 유지)
                </p>
                {rest.length === 1 && <p className="modal-body">남은 {rest[0]}번 혼자가 되므로 합석이 모두 풀립니다.</p>}
                <div className="modal-actions">
                  <button type="button" className="btn-secondary" onClick={() => setJoinStep("input")}>뒤로</button>
                  <button type="button" className="btn-danger" onClick={handleUnjoin}>해제</button>
                </div>
              </div>
            </div>
          );
        }
        if (joinStep === "preview") {
          const { merged, rows, warnCount } = buildJoinPreview();
          return (
            <div className="modal-backdrop" role="presentation" onClick={closeJoin}>
              <div className="modal-panel" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
                <h2 className="modal-title">합석 확인</h2>
                <p className="modal-body">
                  합석 결과: <strong>{merged.join("·")}번</strong> ({merged.length}개 테이블)
                </p>
                <ul className="join-preview">
                  {rows.map((r) => (
                    <li key={r.table} className={r.warnings.length ? "join-preview-row join-preview-row--warn" : "join-preview-row"}>
                      <span className="join-preview-head">
                        <strong>{r.table}번</strong>
                        <span className="muted">{r.status}</span>
                      </span>
                      {r.warnings.map((w) => (
                        <span key={w} className="join-preview-warn">⚠ {w}</span>
                      ))}
                    </li>
                  ))}
                </ul>
                {warnCount > 0 && (
                  <p className="join-error">⚠ 표시된 테이블 번호가 맞는지 손님께 다시 확인하세요.</p>
                )}
                {joinError && <p className="join-error">{joinError}</p>}
                <div className="modal-actions">
                  <button type="button" className="btn-secondary" onClick={() => setJoinStep("input")}>뒤로</button>
                  <button type="button" className="btn-primary" onClick={handleJoin}>확정</button>
                </div>
              </div>
            </div>
          );
        }
        return (
          <div className="modal-backdrop" role="presentation" onClick={closeJoin}>
            <div className="modal-panel" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
              <h2 className="modal-title">{joinTable}번 테이블 합석</h2>
              {group.length >= 2 && <p className="modal-body">현재 합석: {group.join("·")}번</p>}
              <p className="modal-body">
                합석할 테이블 번호를 입력하세요. 여러 개는 쉼표나 띄어쓰기로 구분합니다 (예: 4, 5, 6). 다음 화면에서 결과를 확인한 뒤 확정합니다.
              </p>
              <input
                type="text"
                autoComplete="off"
                placeholder="예: 4, 5, 6"
                value={joinInput}
                onChange={(e) => {
                  setJoinInput(e.target.value.replace(/[^\d,\s]/g, ""));
                  setJoinError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && joinTargets.length > 0) handleJoinNext();
                }}
                className="field-input"
              />
              {joinError && <p className="join-error">{joinError}</p>}
              <div className="modal-actions">
                {group.length >= 2 && (
                  <button type="button" className="btn-danger" onClick={() => setJoinStep("unjoin")}>이 테이블 합석 해제</button>
                )}
                <button type="button" className="btn-secondary" onClick={closeJoin}>취소</button>
                <button type="button" className="btn-primary" disabled={joinTargets.length === 0} onClick={handleJoinNext}>다음</button>
              </div>
            </div>
          </div>
        );
      })()}
      {historyTable && (() => {
        const group = groupOf(historyTable);
        const history = group
          .flatMap((g) => {
            const td = state?.tables?.[g];
            return (Array.isArray(td?.orderHistory) ? td.orderHistory : []).map((batch) => ({ ...batch, table: g }));
          })
          .sort((a, b) => a.createdAt - b.createdAt);
        const total = group.reduce((sum, g) => sum + Math.max(0, Math.floor(Number(state?.tables?.[g]?.totalAmount) || 0)), 0);
        return (
          <div className="modal-backdrop" role="presentation" onClick={() => setHistoryTable(null)}>
            <div className="modal-panel modal-panel--history" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
              <h2 className="modal-title">
                {group.length >= 2 ? `합석 ${group.join("·")}번 주문 내역` : `${historyTable}번 테이블 주문 내역`}
              </h2>
              <div className="oh-scroll">
                {history.length === 0 ? (
                  <p className="muted">주문 내역이 없습니다.</p>
                ) : (
                  <ol className="oh-list">
                    {history.map((batch, i) => (
                      <li key={i} className="oh-batch">
                        <div className="oh-batch-header">
                          <span className="oh-batch-num">#{i + 1}</span>
                          {group.length >= 2 && <span className="oh-batch-table">{batch.table}번</span>}
                          <time className="oh-batch-time">{formatHM(batch.createdAt)}</time>
                          <span className="oh-batch-sub">{batch.subtotal.toLocaleString()}원</span>
                        </div>
                        <ul className="oh-items">
                          {batch.items.map((it, j) => (
                            <li key={j} className="oh-item">
                              <span>{it.name} × {it.qty}</span>
                              <span>{(it.price * it.qty).toLocaleString()}원</span>
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
              <div className="oh-footer">
                <span>누적 합계</span>
                <strong>{total.toLocaleString()}원</strong>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setHistoryTable(null)}>닫기</button>
              </div>
            </div>
          </div>
        );
      })()}
      <div className="system-top">
        <h1 className="system-h1">시스템 / 타이머</h1>
        <span className={`conn large ${connected ? "ok" : ""}`}>{connected ? "연결됨" : "연결 끊김"}</span>
      </div>

      <section className="tables-section">
        <h2 className="section-title large tables-section-title">
          테이블 현황
          <span className="tc-count-badge">{activeCount} / {TABLE_COUNT} 이용 중</span>
        </h2>

        <div className="table-grid">
          {tableData.map(({ table, active, remaining, over, soon, limitMin, partySize, depositors, totalAmount, group }) => (
            <div
              key={table}
              className={`table-card ${
                active ? (over ? "table-card--over" : soon ? "table-card--soon" : "table-card--active") : "table-card--empty"
              }`}
            >
              <div className="tc-header">
                <div className="tc-header-row">
                  <span className="tc-num">{table}번</span>
                  {active && (
                    <div className="tc-header-actions">
                      <button
                        type="button"
                        className="tc-history-btn"
                        onClick={() => setJoinTable(table)}
                      >합석</button>
                      <button
                        type="button"
                        className="tc-history-btn"
                        onClick={() => setHistoryTable(table)}
                      >내역</button>
                      <button
                        type="button"
                        className="tc-close"
                        aria-label="테이블 할당 해제"
                        onClick={() => setConfirmTable(table)}
                      >✕</button>
                    </div>
                  )}
                </div>
                <span
                  className={`tc-status ${
                    active ? (over ? "tc-status--over" : soon ? "tc-status--soon" : "tc-status--active") : "tc-status--empty"
                  }`}
                >
                  {active ? (over ? "시간초과" : soon ? "종료 20분 전" : "이용 중") : "빈 테이블"}
                </span>
                {active && group.length >= 2 && <span className="tc-join-badge">🔗 합석 {group.join("·")}번</span>}
              </div>
              {active && (
                <>
                  <div className={`tc-timer ${over ? "tc-timer--over" : ""}`}>{formatHMS(remaining)}</div>
                  <div className="tc-meta">
                    <span>인원 {partySize > 0 ? `${partySize}명` : "—"}</span>
                    <span>제한 {limitMin}분</span>
                    {depositors && <span>입금 {depositors}</span>}
                    {totalAmount > 0 && <span className="tc-amount">{totalAmount.toLocaleString()}원</span>}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
