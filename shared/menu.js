/**
 * 메뉴 목록 — 운영 시 이 배열만 수정하면 됩니다.
 * addonOnly: true → 예약용(미사용).
 * 자릿세(COVER_MENU_ID): 주방 조리 없음·시스템 인원(자릿세 수량 합) 집계.
 */
export const COVER_MENU_ID = 11;

export const MENU_LIST = [
  /* 기타 */
  { id: COVER_MENU_ID, name: "자릿세", price: 5000, category: "기타" },
  { id: 12, name: "기본 안주", price: 1000, category: "기타" },
  /* 메인 */
  { id: 5, name: "닭강정", price: 18000, category: "메인" },
  { id: 6, name: "제육", price: 18000, category: "메인" },
  { id: 7, name: "소세지 나초", price: 18000, category: "메인" },
  /* 사이드 */
  { id: 8, name: "콘치즈", price: 11000, category: "사이드" },
  { id: 9, name: "오지치즈 후라이", price: 11000, category: "사이드" },
  { id: 10, name: "주먹밥", price: 8000, category: "사이드" },
];

/**
 * 주방 큐용: 세트는 구성 메뉴 각각 한 줄, 그 외 메뉴는 그대로 한 줄.
 * @param {{ menuId: number, name: string, price: number, qty: number }[]} items
 * @returns {{ menuId: number, name: string, price: number, qty: number }[]}
 */
export function expandKitchenLines(items) {
  const out = [];
  for (const it of items) {
    const m = MENU_LIST.find((x) => x.id === it.menuId);
    const parts = m?.kitchenParts;
    if (Array.isArray(parts) && parts.length > 0) {
      for (const partName of parts) {
        out.push({
          menuId: it.menuId,
          name: String(partName),
          price: 0,
          qty: it.qty,
        });
      }
    } else {
      out.push({ menuId: it.menuId, name: it.name, price: it.price, qty: it.qty });
    }
  }
  return out;
}
