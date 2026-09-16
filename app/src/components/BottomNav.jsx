import React from "react";
import {
  ArrowsClockwise,
  CalendarBlank,
  CheckSquare,
  FolderSimple,
  House,
  Plus,
} from "@phosphor-icons/react";

export function BottomNav({ activeNav, onNavigate, onQuickAdd, urgentCount = 0 }) {
  return (
    <nav className="mobile-bottom-nav" aria-label="移动端底栏导航">
      <button
        className={`bottom-nav-item ${activeNav === "dashboard" ? "active" : ""}`}
        onClick={() => onNavigate("dashboard")}
      >
        <House size={22} weight={activeNav === "dashboard" ? "fill" : "regular"} />
        <span>看板</span>
        {urgentCount > 0 && <span className="bottom-nav-badge" />}
      </button>

      <button
        className={`bottom-nav-item ${activeNav === "calendar" ? "active" : ""}`}
        onClick={() => onNavigate("calendar")}
      >
        <CalendarBlank size={22} weight={activeNav === "calendar" ? "fill" : "regular"} />
        <span>日历</span>
      </button>

      <button
        className="bottom-nav-add-btn"
        onClick={onQuickAdd}
        aria-label="快速新增"
      >
        <Plus size={22} weight="bold" />
      </button>

      <button
        className={`bottom-nav-item ${activeNav === "renewal" ? "active" : ""}`}
        onClick={() => onNavigate("renewal")}
      >
        <ArrowsClockwise size={22} weight={activeNav === "renewal" ? "fill" : "regular"} />
        <span>续费</span>
      </button>

      <button
        className={`bottom-nav-item ${activeNav === "assets" ? "active" : ""}`}
        onClick={() => onNavigate("assets")}
      >
        <FolderSimple size={22} weight={activeNav === "assets" ? "fill" : "regular"} />
        <span>资产</span>
      </button>
    </nav>
  );
}
