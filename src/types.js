/**
 * JSDoc 타입 정의 (런타임 import 없음)
 * @typedef {{ id: number, name: string, price: number, category: string, addonOnly?: boolean, gameOnly?: boolean, hideFirstOrderBadge?: boolean, kitchenParts?: string[] }} MenuItem
 * @typedef {{ id: string, name: string, partySize: number, phone: string, createdAt: number }} Reservation
 * @typedef {{ menuId: number, name: string, price: number, qty: number, status: "pending" | "done" | "served", lineKey?: string }} OrderLine
 * @typedef {{ id: string, table: string, items: OrderLine[], createdAt: number, joinedTables?: string[] }} KitchenOrder
 * @typedef {{ items: { name: string, price: number, qty: number }[], subtotal: number, createdAt: number }} OrderHistoryEntry
 * @typedef {{ timerStartedAt: number | null, coverQty: number, partySize: number, depositor: string, depositors: string, totalAmount: number, orderHistory: OrderHistoryEntry[] }} TableState
 * @typedef {{ menuId: number, name: string, category: string, qty: number, revenue: number }} SalesMenuLine
 * @typedef {{
 *   menuLines: SalesMenuLine[],
 *   totalRevenue: number,
 *   orderSubmitCount: number
 * }} SalesStatsSnapshot
 * @typedef {{
 *   menu: MenuItem[],
 *   soldOutIds: number[],
 *   kitchenQueue: KitchenOrder[],
 *   tables: Record<string, TableState>,
 *   settings: { defaultLimitMinutes: number },
 *   salesStats: SalesStatsSnapshot,
 *   reservations: Reservation[],
 *   joinGroups: string[][]
 * }} AppState
 */

export {};
