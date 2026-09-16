import React from "react";
import {
  ArrowsClockwise,
  CalendarBlank,
  CheckSquare,
  FolderSimple,
  House,
  LockKey,
  ShieldCheck,
  Sparkle,
} from "@phosphor-icons/react";
import { t } from "../utils/i18n.js";

export const PRIMARY_NAV = [
  { key: "dashboard", label: "全景看板", icon: House },
  { key: "calendar", label: "时间轨道", icon: CalendarBlank },
  { key: "renewal", label: "订阅续费", icon: ArrowsClockwise },
  { key: "pending", label: "待办事项", icon: CheckSquare },
  { key: "assets", label: "数字资产", icon: FolderSimple },
  { key: "almanac", label: "择吉黄历", icon: Sparkle },
];

export function Sidebar({
  activeNav,
  onNavigate,
  urgentCount = 0,
  renewalCount = 0,
  pendingCount = 0,
  lockEnabled = false,
  currentLang = "zh-CN",
}) {
  return (
    <aside className="app-sidebar" aria-label="应用导航">
      <div className="sidebar-brand">
        <div className="sidebar-logo">
          <img src="/assets/app-icon-flat.png" alt="小黄提醒管家" />
        </div>
        <div className="sidebar-brand__text">
          <h2>小黄提醒</h2>
          <span>管家 Pro</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-section-title">核心功能</div>
        {PRIMARY_NAV.map((item) => {
          const Icon = item.icon;
          const isActive = activeNav === item.key;
          let badge = null;
          if (item.key === "dashboard" && urgentCount > 0) {
            badge = <span className="nav-badge nav-badge--urgent">{urgentCount}</span>;
          } else if (item.key === "renewal" && renewalCount > 0) {
            badge = <span className="nav-badge">{renewalCount}</span>;
          } else if (item.key === "pending" && pendingCount > 0) {
            badge = <span className="nav-badge">{pendingCount}</span>;
          }

          return (
            <button
              key={item.key}
              type="button"
              className={`sidebar-nav-item ${isActive ? "active" : ""}`}
              onClick={() => onNavigate(item.key)}
            >
              <span className="sidebar-nav-icon">
                <Icon size={20} weight={isActive ? "fill" : "regular"} />
              </span>
              <span className="sidebar-nav-label">{t("nav." + item.key, currentLang)}</span>
              {badge}
            </button>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <button
          type="button"
          className={`sidebar-nav-item ${activeNav === "security" ? "active" : ""}`}
          onClick={() => onNavigate("security")}
        >
          <span className="sidebar-nav-icon">
            <ShieldCheck size={20} weight={activeNav === "security" ? "fill" : "regular"} />
          </span>
          <span className="sidebar-nav-label">{t("nav.security", currentLang)}</span>
          {lockEnabled ? (
            <span className="nav-badge nav-badge--success" title="加密保险箱已启用">
              <LockKey size={12} weight="fill" />
            </span>
          ) : null}
        </button>
      </div>
    </aside>
  );
}
