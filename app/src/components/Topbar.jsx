import React, { useState } from "react";
import {
  Bell,
  CloudCheck,
  Gear,
  LockKey,
  MagnifyingGlass,
  Plus,
  X,
} from "@phosphor-icons/react";
import { NotificationDropdown } from "../features/reminders/NotificationDropdown.jsx";
import { t } from "../utils/i18n.js";

export function Topbar({
  title = "全景看板",
  subtitle,
  query,
  setQuery,
  onQuickAdd,
  records,
  onSelectRecord,
  onAdvanceRecord,
  onRequestPermission,
  permissionGranted,
  lockEnabled,
  cloudEnabled,
  urgentCount = 0,
  onOpenSettings,
  currentLang = "zh-CN",
}) {
  const [notifOpen, setNotifOpen] = useState(false);

  return (
    <header className="app-topbar">
      <div className="topbar-left">
        <h1 className="topbar-title">{title}</h1>
        {subtitle && <span className="topbar-subtitle">{subtitle}</span>}
      </div>

      <div className="topbar-center">
        <div className="topbar-search">
          <MagnifyingGlass size={18} className="search-icon" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("btn.search", currentLang)}
            aria-label="搜索记录"
          />
          {query && (
            <button
              className="search-clear"
              onClick={() => setQuery("")}
              aria-label="清空搜索"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="topbar-right">
        {/* 安全与同步状态指示 */}
        <div className="topbar-badges">
          {lockEnabled && (
            <span className="status-pill status-pill--vault" title="本地保险箱已加密锁定保护">
              <LockKey size={14} weight="fill" />
              <span>{t("stat.security_status", currentLang)}</span>
            </span>
          )}
          {cloudEnabled && (
            <span className="status-pill status-pill--cloud" title="iCloud 端到端加密同步已启用">
              <CloudCheck size={15} weight="fill" />
              <span>iCloud</span>
            </span>
          )}
        </div>

        {/* 提醒通知铃铛 */}
        <div className="topbar-notif-wrapper">
          <button
            className={`topbar-icon-button ${urgentCount > 0 ? "has-urgent" : ""}`}
            onClick={() => setNotifOpen(!notifOpen)}
            aria-label={`提醒通知 (${urgentCount} 条待处理)`}
            title="查看待办与到期提醒"
          >
            <Bell size={20} weight={urgentCount > 0 ? "fill" : "regular"} />
            {urgentCount > 0 && <span className="topbar-notif-dot">{urgentCount}</span>}
          </button>

          {notifOpen && (
            <NotificationDropdown
              records={records}
              onClose={() => setNotifOpen(false)}
              onSelectRecord={onSelectRecord}
              onAdvanceRecord={onAdvanceRecord}
              onRequestPermission={onRequestPermission}
              permissionGranted={permissionGranted}
            />
          )}
        </div>

        {/* 系统设置与多国语言入口 */}
        <button
          className="topbar-icon-button"
          onClick={onOpenSettings}
          aria-label={t("settings.title", currentLang)}
          title={t("settings.title", currentLang)}
        >
          <Gear size={20} />
        </button>

        {/* 全局快捷新建记录按钮（桌面端显示，手机端由底栏常驻 + 号负责） */}
        <button
          className="btn-primary-gradient topbar-desktop-btn"
          onClick={onQuickAdd}
          title={t("btn.new_item", currentLang)}
        >
          <Plus size={18} weight="bold" />
          <span>{t("btn.new_item", currentLang)}</span>
        </button>
      </div>
    </header>
  );
}
