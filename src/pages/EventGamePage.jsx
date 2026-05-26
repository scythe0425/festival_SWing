import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppSocket } from "../context/SocketContext.jsx";

export default function EventGamePage() {
  const { socket, connected, state, toast, setToast } = useAppSocket();
  const [table, setTable] = useState("");
  const [partySize, setPartySize] = useState("");
  const [depositor, setDepositor] = useState("");
  const [quantities, setQuantities] = useState({});
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitIdRef = useRef(null);

  const soldSet = useMemo(() => new Set(state?.soldOutIds ?? []), [state?.soldOutIds]);
  const gameMenu = useMemo(() => (state?.menu ?? []).filter((m) => m.gameOnly), [state?.menu]);

  const setQty = useCallback((menuId, delta) => {
    setQuantities((prev) => {
      const cur = Math.max(0, Math.floor(Number(prev[menuId]) || 0));
      const next = Math.max(0, cur + delta);
      if (next === 0) {
        const { [menuId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [menuId]: next };
    });
  }, []);

  const lines = useMemo(() => {
    const out = [];
    for (const m of gameMenu) {
      const q = Math.max(0, Math.floor(Number(quantities[m.id]) || 0));
      if (q > 0) out.push({ ...m, qty: q });
    }
    return out;
  }, [gameMenu, quantities]);

  const total = useMemo(() => lines.reduce((s, l) => s + l.price * l.qty, 0), [lines]);

  const openPaymentModal = useCallback(() => {
    submitIdRef.current = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setPaymentModalOpen(true);
  }, []);

  const submit = useCallback(() => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    const timeoutId = setTimeout(() => {
      setIsSubmitting(false);
      setToast("응답 없음 — 테이블 현황에서 주문 상태를 확인하세요.");
    }, 8000);
    socket.emit(
      "order:submit",
      { table, quantities, partySize, depositor, submitId: submitIdRef.current },
      (res) => {
        clearTimeout(timeoutId);
        setIsSubmitting(false);
        if (res?.ok) {
          setQuantities({});
          setTable("");
          setPartySize("");
          setDepositor("");
          setPaymentModalOpen(false);
          submitIdRef.current = null;
        } else if (res?.error) {
          setToast(res.error);
        }
      }
    );
  }, [socket, table, quantities, partySize, depositor, isSubmitting, setToast]);

  useEffect(() => {
    if (!connected && isSubmitting) {
      setIsSubmitting(false);
      setToast("연결이 끊겼습니다. 주문 상태를 테이블 현황에서 확인하세요.");
    }
  }, [connected, isSubmitting, setToast]);

  useEffect(() => {
    if (!paymentModalOpen) return;
    const onKey = (e) => { if (e.key === "Escape") setPaymentModalOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paymentModalOpen]);

  const canSubmit = connected && lines.length > 0 && table.trim().length > 0;

  return (
    <div className="page order-page">
      {toast && <div className="toast">{toast}</div>}
      {paymentModalOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setPaymentModalOpen(false)}
        >
          <div
            className="modal-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="game-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="game-modal-title" className="modal-title">입금 확인</h2>
            {!connected ? (
              <p className="modal-body" style={{ color: "var(--danger)" }}>
                연결이 끊겼습니다. 재연결 후 시도하세요.
              </p>
            ) : (
              <p className="modal-body">입금 확인했나요?</p>
            )}
            <div className="modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setPaymentModalOpen(false)}
                disabled={isSubmitting}
              >
                취소
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={submit}
                disabled={!connected || isSubmitting}
              >
                {isSubmitting ? "처리 중…" : "주문 완료"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="order-top">
        <div className="order-top-fields">
          <label className="field-label">
            테이블 번호
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              placeholder="예: 5, 12"
              value={table}
              onChange={(e) => setTable(e.target.value.replace(/\D/g, ""))}
              className="field-input"
            />
          </label>
          <label className="field-label">
            인원수
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={99}
              autoComplete="off"
              placeholder="명"
              value={partySize}
              onChange={(e) => setPartySize(e.target.value.replace(/\D/g, ""))}
              className="field-input"
            />
          </label>
          <label className="field-label">
            입금자
            <input
              type="text"
              autoComplete="off"
              placeholder="이름"
              maxLength={40}
              value={depositor}
              onChange={(e) => setDepositor(e.target.value)}
              className="field-input"
            />
          </label>
        </div>
        <span className={`conn ${connected ? "ok" : ""}`}>{connected ? "연결됨" : "연결 끊김"}</span>
      </div>

      <section className="menu-section">
        <h2 className="section-title">이벤트 게임</h2>
        <ul className="menu-list">
          {gameMenu.map((m) => {
            const sold = soldSet.has(m.id);
            const q = Math.max(0, Math.floor(Number(quantities[m.id]) || 0));
            return (
              <li key={m.id} className={`menu-row ${sold ? "soldout" : ""}`}>
                <div className="menu-info">
                  <span className="menu-name">{m.name}</span>
                  <span className="menu-price">{m.price.toLocaleString()}원</span>
                  {sold && <span className="badge-sold">주문 불가</span>}
                </div>
                <div className="qty-controls">
                  <button type="button" disabled={sold} onClick={() => setQty(m.id, -1)} aria-label="감소">
                    −
                  </button>
                  <span className="qty-val">{q}</span>
                  <button type="button" disabled={sold} onClick={() => setQty(m.id, 1)} aria-label="증가">
                    +
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <footer className="order-footer">
        <div className="cart-summary">
          <h3 className="cart-title">선택 내역</h3>
          {lines.length === 0 ? (
            <p className="muted">게임 수량을 선택해 주세요.</p>
          ) : (
            <ul className="cart-lines">
              {lines.map((l) => (
                <li key={l.id}>
                  {l.name} × {l.qty}{" "}
                  <span className="sub">{(l.price * l.qty).toLocaleString()}원</span>
                </li>
              ))}
            </ul>
          )}
          <div className="cart-total">
            합계 <strong>{total.toLocaleString()}원</strong>
          </div>
        </div>
        <button
          type="button"
          className="btn-primary btn-block"
          onClick={openPaymentModal}
          disabled={!canSubmit}
        >
          주문 완료
        </button>
      </footer>
    </div>
  );
}
