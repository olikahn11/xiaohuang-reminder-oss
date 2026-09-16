import React from "react";
import {
  ArrowsClockwise,
  CalendarBlank,
  FolderSimple,
  House,
  Plus,
} from "@phosphor-icons/react";
import { t } from "../utils/i18n.js";

export function BottomNav({ activeNav, onNavigate, onQuickAdd, urgentCount = 0, currentLang = "zh-CN" }) {
  return (
    <nav className="mobile-bottom-nav" aria-label="移动端底栏导航">
      <button
        className={`bottom-nav-item ${activeNav === "dashboard" ? "active" : ""}`}
        onClick={() => onNavigate("dashboard")}
      >
        <House size={22} weight={activeNav === "dashboard" ? "fill" : "regular"} />
        <span>{t("nav.dashboard_short", currentLang)}</span>
        {urgentCount > 0 && <span className="bottom-nav-badge" />}
      </button>

      <button
        className={`bottom-nav-item ${activeNav === "calendar" ? "active" : ""}`}
        onClick={() => onNavigate("calendar")}
      >
        <CalendarBlank size={22} weight={activeNav === "calendar" ? "fill" : "regular"} />
        <span>{t("nav.calendar_short", currentLang)}</span>
      </button>

      <button
        className="bottom-nav-add-btn"
        onClick={onQuickAdd}
        aria-label={t("btn.quick_add", currentLang)}
      >
        <Plus size={22} weight="bold" />
      </button>

      <button
        className={`bottom-nav-item ${activeNav === "renewal" ? "active" : ""}`}
        onClick={() => onNavigate("renewal")}
      >
        <ArrowsClockwise size={22} weight={activeNav === "renewal" ? "fill" : "regular"} />
        <span>{t("nav.renewal_short", currentLang)}</span>
      </button>

      <button
        className={`bottom-nav-item ${activeNav === "assets" ? "active" : ""}`}
        onClick={() => onNavigate("assets")}
      >
        <FolderSimple size={22} weight={activeNav === "assets" ? "fill" : "regular"} />
        <span>{t("nav.assets_short", currentLang)}</span>
      </button>
    </nav>
  );
}
