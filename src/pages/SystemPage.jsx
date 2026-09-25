import { useEffect, useMemo, useState, useCallback } from "react";
import { useAppSocket } from "../context/SocketContext.jsx";

/** 파라솔 테이블 56개 + 여유분 책상 4개 */
const TABLE_COUNT = 60;
const ALL_TABLES = Array.from({ length: TABLE_COUNT }, (_, i) => String(i + 1));

function formatHM(ts) {
  return new Date(ts).toLocaleString("ko-KR", { hour: "2-digit", minute: "2-digit" });
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
      return { table, active: true, remaining, over, limitMin, partySize, depositors, totalAmount, group };
    });
  }, [state?.tables, groupOf, defaultLimit, clock]);

  const closeJoin = () => {
    setJoinTable(null);
    setJoinInput("");
    setJoinError("");
  };

  const handleJoin = () => {
    socket.emit("table:join", { table: joinTable, other: joinInput }, (res) => {
      if (res?.ok) closeJoin();
      else setJoinError(res?.error ?? "합석에 실패했습니다.");
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
        return (
          <div className="modal-backdrop" role="presentation" onClick={closeJoin}>
            <div className="modal-panel" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
              <h2 className="modal-title">{joinTable}번 테이블 합석</h2>
              {group.length >= 2 && <p className="modal-body">현재 합석: {group.join("·")}번</p>}
              <p className="modal-body">
                합석할 테이블 번호를 입력하세요. 타이머는 가장 먼저 입장한 테이블 기준으로 맞춰지고, 인원·금액은 합산 표시됩니다.
              </p>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                placeholder="테이블 번호"
                value={joinInput}
                onChange={(e) => {
                  setJoinInput(e.target.value.replace(/\D/g, ""));
                  setJoinError("");
                }}
                className="field-input"
              />
              {joinError && <p className="join-error">{joinError}</p>}
              <div className="modal-actions">
                {group.length >= 2 && (
                  <button type="button" className="btn-danger" onClick={handleUnjoin}>이 테이블 합석 해제</button>
                )}
                <button type="button" className="btn-secondary" onClick={closeJoin}>취소</button>
                <button type="button" className="btn-primary" disabled={!joinInput} onClick={handleJoin}>합석</button>
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
          {tableData.map(({ table, active, remaining, over, limitMin, partySize, depositors, totalAmount, group }) => (
            <div key={table} className={`table-card ${active ? (over ? "table-card--over" : "table-card--active") : "table-card--empty"}`}>
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
                <span className={`tc-status ${active ? (over ? "tc-status--over" : "tc-status--active") : "tc-status--empty"}`}>
                  {active ? (over ? "시간초과" : "이용 중") : "빈 테이블"}
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
