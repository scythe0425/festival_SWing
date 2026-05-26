import { useState } from "react";
import { useAppSocket } from "../context/SocketContext.jsx";

function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

function itemClass(status) {
  if (status === "done") return "kc-item kc-item--done";
  if (status === "served") return "kc-item kc-item--served";
  return "kc-item";
}

export default function KitchenPage() {
  const { socket, connected, state } = useAppSocket();
  const queue = state?.kitchenQueue ?? [];
  const [confirmId, setConfirmId] = useState(null);

  const confirmOrder = confirmId ? queue.find((o) => o.id === confirmId) : null;

  const handleDelete = () => {
    socket.emit("kitchen:deleteOrder", confirmId);
    setConfirmId(null);
  };

  return (
    <div className="page kitchen-page">
      {confirmOrder && (
        <div className="modal-backdrop" role="presentation" onClick={() => setConfirmId(null)}>
          <div className="modal-panel" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">{confirmOrder.table}번 주문 취소</h2>
            <p className="modal-body">해당 주문을 주방 대기 목록에서 삭제할까요?</p>
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setConfirmId(null)}>취소</button>
              <button type="button" className="btn-danger" onClick={handleDelete}>삭제</button>
            </div>
          </div>
        </div>
      )}

      <div className="kitchen-top">
        <h1 className="kitchen-h1">주방</h1>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span className="muted" style={{ fontSize: "0.95rem" }}>대기 {queue.length}건</span>
          <span className={`conn large ${connected ? "ok" : ""}`}>{connected ? "연결됨" : "끊김"}</span>
        </div>
      </div>

      {queue.length === 0 ? (
        <p className="empty-kitchen muted">대기 중인 주문이 없습니다.</p>
      ) : (
        <div className="kitchen-grid">
          {queue.map((o) => (
            <article key={o.id} className="kitchen-card">
              <header className="kc-head">
                <span className="kc-table">{o.table}번</span>
                <time className="kc-time">{formatTime(o.createdAt)}</time>
                <button
                  type="button"
                  className="tc-close"
                  aria-label="주문 취소"
                  onClick={() => setConfirmId(o.id)}
                >
                  ✕
                </button>
              </header>
              <ul className="kc-items">
                {o.items.map((it, i) => {
                  const status = it.status ?? (it.done ? "done" : "pending");
                  return (
                    <li key={it.lineKey ?? `${o.id}-${i}`} className={itemClass(status)}>
                      <span className="kc-item-name">{it.name}</span>
                      {status === "pending" && (
                        <button
                          type="button"
                          className="kc-btn-done"
                          onClick={() => socket.emit("kitchen:completeLine", { orderId: o.id, lineKey: it.lineKey, lineIndex: i })}
                        >
                          완료
                        </button>
                      )}
                      {status === "done" && (
                        <button
                          type="button"
                          className="kc-btn-serve"
                          onClick={() => socket.emit("kitchen:serveLine", { orderId: o.id, lineKey: it.lineKey, lineIndex: i })}
                        >
                          서빙
                        </button>
                      )}
                      {status === "served" && (
                        <button
                          type="button"
                          className="kc-btn-undo"
                          onClick={() => socket.emit("kitchen:uncompleteLine", { orderId: o.id, lineKey: it.lineKey, lineIndex: i })}
                        >
                          취소
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
