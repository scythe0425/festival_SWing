/**
 * 테이블 번호 — 파라솔 테이블 56개 + 여유분 책상 4개
 */
export const TABLE_COUNT = 60;

/** "1" ~ "60" 형태의 유효한 테이블 번호인지 */
export function isValidTable(table) {
  const s = String(table ?? "").trim();
  if (!/^\d+$/.test(s)) return false;
  const n = Number(s);
  return n >= 1 && n <= TABLE_COUNT;
}
