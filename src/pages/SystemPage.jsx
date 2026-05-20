import { useEffect, useMemo, useState, useCallback } from "react";
import { useAppSocket } from "../context/SocketContext.jsx";

const ALL_TABLES = Array.from({ length: 40 }, (_, i) => String(i + 1));

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

  const handleReset = useCallback((table) => {
    socket.emit("system:resetTable", table);
    setConfirmTable(null);
  }, [socket]);

  useEffect(() => {
    const id = setInterval(() => setClock((c) => c + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const defaultLimit = state?.settings?.defaultLimitMinutes ?? 90;

  const tableData = useMemo(() => {
    const now = Date.now();
    return ALL_TABLES.map((table) => {
      const t = state?.tables?.[table];
      if (!t || t.timerStartedAt == null) return { table, active: false };
      const bonus = Math.max(0, Math.floor(Number(t.bonusLimitMinutes) || 0));
      const partySize = Math.max(0, Math.floor(Number(t.partySize) || 0));
      const depositors = String(t.depositors ?? "") || String(t.depositor ?? "");
      const totalAmount = Math.max(0, Math.floor(Number(t.totalAmount) || 0));
      const limitMin = defaultLimit + bonus;
      const elapsed = now - t.timerStartedAt;
      const limitMs = limitMin * 60 * 1000;
      const over = elapsed >= limitMs;
      const remaining = Math.max(0, limitMs - elapsed);
      return { table, active: true, remaining, over, limitMin, partySize, depositors, totalAmount };
    });
  }, [state?.tables, defaultLimit, clock]);

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
      {historyTable && (() => {
        const td = state?.tables?.[historyTable];
        const history = Array.isArray(td?.orderHistory) ? td.orderHistory : [];
        const total = Math.max(0, Math.floor(Number(td?.totalAmount) || 0));
        return (
          <div className="modal-backdrop" role="presentation" onClick={() => setHistoryTable(null)}>
            <div className="modal-panel modal-panel--history" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
              <h2 className="modal-title">{historyTable}번 테이블 주문 내역</h2>
              <div className="oh-scroll">
                {history.length === 0 ? (
                  <p className="muted">주문 내역이 없습니다.</p>
                ) : (
                  <ol className="oh-list">
                    {history.map((batch, i) => (
                      <li key={i} className="oh-batch">
                        <div className="oh-batch-header">
                          <span className="oh-batch-num">#{i + 1}</span>
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
          <span className="tc-count-badge">{activeCount} / 40 이용 중</span>
        </h2>

        <div className="table-grid">
          {tableData.map(({ table, active, remaining, over, limitMin, partySize, depositors, totalAmount }) => (
            <div key={table} className={`table-card ${active ? (over ? "table-card--over" : "table-card--active") : "table-card--empty"}`}>
              <div className="tc-header">
                <div className="tc-header-row">
                  <span className="tc-num">{table}번</span>
                  {active && (
                    <div className="tc-header-actions">
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
