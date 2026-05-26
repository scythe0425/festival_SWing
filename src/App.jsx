import { NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { SocketProvider } from "./context/SocketContext.jsx";
import OrderPage from "./pages/OrderPage.jsx";
import KitchenPage from "./pages/KitchenPage.jsx";
import SystemPage from "./pages/SystemPage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";
import StatsPage from "./pages/StatsPage.jsx";
import ReservationsPage from "./pages/ReservationsPage.jsx";
import ResetAllPage from "./pages/ResetAllPage.jsx";
import ManualPage from "./pages/ManualPage.jsx";
import EventGamePage from "./pages/EventGamePage.jsx";
import EventGameHistoryPage from "./pages/EventGameHistoryPage.jsx";

function AppShell() {
  const { pathname } = useLocation();
  const wideLayout =
    pathname === "/kitchen" ||
    pathname === "/system" ||
    pathname === "/settings" ||
    pathname === "/stats" ||
    pathname === "/reservations" ||
    pathname === "/reset" ||
    pathname === "/game-history";

  return (
    <>
      <header className="app-header">
        <div className="app-header-row">
          <strong className="app-title">주점 주문</strong>
        </div>
        <nav className="app-nav">
          <NavLink end className={({ isActive }) => (isActive ? "nav-a active" : "nav-a")} to="/">
            주문서
          </NavLink>
          <NavLink className={({ isActive }) => (isActive ? "nav-a active" : "nav-a")} to="/game">
            이벤트 게임
          </NavLink>
          <NavLink className={({ isActive }) => (isActive ? "nav-a active" : "nav-a")} to="/game-history">
            게임 내역
          </NavLink>
          <NavLink className={({ isActive }) => (isActive ? "nav-a active" : "nav-a")} to="/kitchen">
            주방
          </NavLink>
          <NavLink className={({ isActive }) => (isActive ? "nav-a active" : "nav-a")} to="/system">
            테이블 현황
          </NavLink>
          <NavLink className={({ isActive }) => (isActive ? "nav-a active" : "nav-a")} to="/settings">
            설정
          </NavLink>
          <NavLink className={({ isActive }) => (isActive ? "nav-a active" : "nav-a")} to="/reservations">
            예약
          </NavLink>
          <NavLink className={({ isActive }) => (isActive ? "nav-a active" : "nav-a")} to="/manual">
            매뉴얼
          </NavLink>
          <NavLink className={({ isActive }) => (isActive ? "nav-a active nav-a--reset" : "nav-a nav-a--reset")} to="/reset">
            전체 초기화
          </NavLink>
        </nav>
      </header>
      <main className={`app-main${wideLayout ? " app-main--wide" : ""}`}>
        <Routes>
          <Route path="/" element={<OrderPage />} />
          <Route path="/game" element={<EventGamePage />} />
          <Route path="/game-history" element={<EventGameHistoryPage />} />
          <Route path="/kitchen" element={<KitchenPage />} />
          <Route path="/system" element={<SystemPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="/reservations" element={<ReservationsPage />} />
          <Route path="/reset" element={<ResetAllPage />} />
          <Route path="/manual" element={<ManualPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  );
}

export default function App() {
  return (
    <SocketProvider>
      <AppShell />
    </SocketProvider>
  );
}
