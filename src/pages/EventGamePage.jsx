import { useCallback, useEffect, useRef, useState } from "react";
import { useAppSocket } from "../context/SocketContext.jsx";

const UNIT_PRICE = 1000;

export default function EventGamePage() {
  const { socket, connected, toast, setToast } = useAppSocket();
  const [depositor, setDepositor] = useState("");
  const [qty, setQty] = useState(0);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitIdRef = useRef(null);

  const total = qty * UNIT_PRICE;

  const changeQty = useCallback((delta) => {
    setQty((prev) => Math.max(0, prev + delta));
  }, []);

  const openPaymentModal = useCallback(() => {
    submitIdRef.current = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setPaymentModalOpen(true);
  }, []);

  const submit = useCallback(() => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    const timeoutId = setTimeout(() => {
      setIsSubmitting(false);
      setToast("응답 없음 — 이벤트 게임 내역 탭에서 접수 여부를 확인하세요.");
    }, 8000);
    socket.emit("eventGame:submit", { depositor, qty }, (res) => {
      clearTimeout(timeoutId);
      setIsSubmitting(false);
      if (res?.ok) {
        setDepositor("");
        setQty(0);
        setPaymentModalOpen(false);
        submitIdRef.current = null;
      } else if (res?.error) {
        setToast(res.error);
      }
    });
  }, [socket, depositor, qty, isSubmitting, setToast]);

  useEffect(() => {
    if (!connected && isSubmitting) {
      setIsSubmitting(false);
      setToast("연결이 끊겼습니다.");
    }
  }, [connected, isSubmitting, setToast]);

  useEffect(() => {
    if (!paymentModalOpen) return;
    const onKey = (e) => { if (e.key === "Escape") setPaymentModalOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paymentModalOpen]);

  const canSubmit = connected && qty > 0 && depositor.trim().length > 0;

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
          <li className="menu-row">
            <div className="menu-info">
              <span className="menu-name">이벤트 게임</span>
              <span className="menu-price">{UNIT_PRICE.toLocaleString()}원</span>
            </div>
            <div className="qty-controls">
              <button type="button" onClick={() => changeQty(-1)} aria-label="감소">−</button>
              <span className="qty-val">{qty}</span>
              <button type="button" onClick={() => changeQty(1)} aria-label="증가">+</button>
            </div>
          </li>
        </ul>
      </section>

      <footer className="order-footer">
        <div className="cart-summary">
          <h3 className="cart-title">선택 내역</h3>
          {qty === 0 ? (
            <p className="muted">수량을 선택해 주세요.</p>
          ) : (
            <ul className="cart-lines">
              <li>
                이벤트 게임 × {qty}{" "}
                <span className="sub">{total.toLocaleString()}원</span>
              </li>
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
