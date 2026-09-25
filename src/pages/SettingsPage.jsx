import { useEffect, useMemo, useState } from "react";
import { useAppSocket } from "../context/SocketContext.jsx";

export default function SettingsPage() {
  const { socket, connected, state } = useAppSocket();
  const menu = state?.menu ?? [];
  const soldSet = useMemo(() => new Set(state?.soldOutIds ?? []), [state?.soldOutIds]);
  /** menuId -> 누적 판매 수량(주문 완료 기준) */
  const soldQty = useMemo(
    () => new Map((state?.salesStats?.menuLines ?? []).map((l) => [l.menuId, l.qty])),
    [state?.salesStats?.menuLines]
  );

  const defaultLimit = state?.settings?.defaultLimitMinutes ?? 120;
  const [defaultInput, setDefaultInput] = useState(String(defaultLimit));

  useEffect(() => {
    if (state?.settings?.defaultLimitMinutes != null)
      setDefaultInput(String(state.settings.defaultLimitMinutes));
  }, [state?.settings?.defaultLimitMinutes]);

  return (
    <div className="page settings-page">
      <div className="system-top">
        <h1 className="system-h1">설정</h1>
        <span className={`conn large ${connected ? "ok" : ""}`}>{connected ? "연결됨" : "연결 끊김"}</span>
      </div>

      <section className="system-settings">
        <h2 className="section-title large">타이머 설정</h2>
        <div className="settings-grid">
          <label className="field-label">
            기본 제한 시간 (분)
            <p className="muted small flush">첫 주문 후 이 시간을 넘기면 경고합니다.</p>
            <div className="inline-row">
              <input
                type="number"
                min={1}
                max={999}
                value={defaultInput}
                onChange={(e) => setDefaultInput(e.target.value)}
                className="field-input narrow"
              />
              <button
                type="button"
                className="btn-secondary"
                onClick={() => socket.emit("system:setDefaultLimitMinutes", defaultInput)}
              >
                적용
              </button>
            </div>
          </label>
        </div>
        <p className="muted small">
          전체 데이터를 비우려면 상단 메뉴의 「전체 초기화」를 이용하세요.
        </p>
      </section>

      <section className="soldout-panel">
        <h2 className="section-title large">품절 설정</h2>
        <p className="muted kitchen-hint">버튼을 누르면 주문서에 즉시 반영됩니다.</p>
        <div className="soldout-grid">
          {menu.map((m) => {
            const on = soldSet.has(m.id);
            return (
              <button
                key={m.id}
                type="button"
                className={`soldout-btn ${on ? "on" : ""}`}
                onClick={() => socket.emit("kitchen:soldOut:toggle", m.id)}
              >
                <span className="soldout-name">{m.name}</span>
                <span className="soldout-qty">판매 {soldQty.get(m.id) ?? 0}개</span>
                <span className="soldout-flag">{on ? "품절" : "판매중"}</span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
