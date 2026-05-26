import { useMemo } from "react";
import { useAppSocket } from "../context/SocketContext.jsx";

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

export default function EventGameHistoryPage() {
  const { connected, state } = useAppSocket();
  const list = useMemo(() => {
    const raw = state?.eventGames ?? [];
    return [...raw].sort((a, b) => b.createdAt - a.createdAt);
  }, [state?.eventGames]);

  const totalAmount = useMemo(() => list.reduce((s, g) => s + g.amount, 0), [list]);

  return (
    <div className="page reservations-page">
      <div className="reservations-top">
        <h1 className="reservations-h1">이벤트 게임 내역</h1>
        <span className={`conn large ${connected ? "ok" : ""}`}>{connected ? "연결됨" : "연결 끊김"}</span>
      </div>

      {list.length > 0 && (
        <div className="eg-summary">
          <span className="eg-summary-count">{list.length}건</span>
          <span className="eg-summary-total">합계 <strong>{totalAmount.toLocaleString()}원</strong></span>
        </div>
      )}

      {list.length === 0 ? (
        <p className="muted">기록된 이벤트 게임이 없습니다.</p>
      ) : (
        <ul className="eg-list">
          {list.map((g) => (
            <li key={g.id} className="eg-item">
              <span className="eg-depositor">{g.depositor}</span>
              <span className="eg-sep">:</span>
              <span className="eg-amount">{g.amount.toLocaleString()}원</span>
              <time className="eg-time muted">{formatTime(g.createdAt)}</time>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
