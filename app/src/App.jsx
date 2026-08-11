import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import {
  cancelAll,
  isPermissionGranted,
  requestPermission,
  Schedule,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  AppWindow,
  ArrowRight,
  ArrowSquareOut,
  ArrowsClockwise,
  Article,
  Bell,
  BellRinging,
  CalendarBlank,
  CaretLeft,
  CaretDown,
  CaretRight,
  Check,
  CheckCircle,
  CheckSquare,
  ClockCountdown,
  CloudCheck,
  Code,
  Copy,
  CreditCard,
  Database,
  DeviceMobile,
  DotsThreeVertical,
  EnvelopeSimple,
  Eye,
  EyeSlash,
  FolderSimple,
  GearSix,
  Globe,
  HardDrives,
  House,
  HourglassHigh,
  IdentificationBadge,
  Key,
  LinkSimple,
  List,
  LockKey,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  Question,
  ShieldCheck,
  Sparkle,
  SquaresFour,
  Trash,
  UserCircle,
  WifiHigh,
  X,
} from "@phosphor-icons/react";
import { INITIAL_RECORDS, KIND_LABELS, LEGACY_DEMO_IDS, NAVIGATION } from "./data.js";
import {
  ALMANAC_REFERENCES,
  lunarCellLabel,
  lunarDayLabel,
  lunarInfoForDate,
  lunarPreviewForDate,
  lunarMonthOptions,
  lunarPartsForSolarDate,
  lunarSummaryForDate,
  solarDateKeyFromLunar,
} from "./lunarCalendar.js";
import { FORM_DEFAULTS, PRIMARY_FIELDS_BY_KIND, RECORD_FORM_CONFIG, defaultStatusForKind, fieldsForKind } from "./recordFields.js";
import { SecurityCenter } from "./SecurityCenter.jsx";
import { ThemedSelect, useSwipeDownToClose } from "./ThemedSelect.jsx";
import {
  LOCK_CONFIG_KEY,
  RECORDS_KEY,
  VAULT_KEY,
  createEncryptedBackup,
  createLocalVault,
  decryptBackup,
  encryptLocalVault,
  mergeRecords,
  normalizeRecords,
  unlockLocalVault,
  unlockLocalVaultWithKey,
} from "./security.js";
import {
  authenticateBiometric,
  biometricStatus,
  deleteDeviceSecret,
  readDeviceSecret,
  readICloud,
  saveDeviceSecret,
  synchronizeICloud,
  writeICloud,
} from "./native.js";

const STORAGE_KEY = RECORDS_KEY;
const BIOMETRIC_KEY = "local-vault-data-key";
const ICLOUD_PASSWORD_KEY = "icloud-sync-password";
const ICLOUD_CONFIG_KEY = "xuji.icloud.v1";

async function openExternal(url) {
  if (!url) return;
  if (isTauri()) {
    await openUrl(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

async function openNotificationSettings() {
  if (!isTauri()) return false;
  const settingsUrl = /Macintosh/i.test(navigator.userAgent)
    ? "x-apple.systempreferences:com.apple.Notifications-Settings.extension"
    : "app-settings:";
  await openUrl(settingsUrl);
  return true;
}

function reminderId(recordId, daysBefore) {
  const value = `${recordId}:${daysBefore}`;
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash || daysBefore);
}

async function scheduleRenewalReminders(records) {
  const isMacNative = /Macintosh/i.test(navigator.userAgent);
  if (!isMacNative) await cancelAll();
  let scheduled = 0;
  const now = new Date();
  const macReminders = [];

  for (const record of records) {
    if (record.status === "handled" || !record.dueDate) continue;
    for (const daysBefore of [7, 3, 1, 0]) {
      const remindAt = new Date(`${record.dueDate}T${record.dueTime || "09:00"}:00`);
      remindAt.setDate(remindAt.getDate() - daysBefore);
      if (remindAt <= now) continue;
      const reminder = {
        id: String(reminderId(record.id, daysBefore)),
        title: daysBefore ? `${recordTitle(record)}将在${daysBefore}天后到期` : `${recordTitle(record)}今天需要处理`,
        body: `${record.amount ? `${money(record.amount)} · ` : ""}${record.cycle || KIND_LABELS[record.kind] || "日程"}，点击小黄提醒管家查看详情。`,
      };
      if (isMacNative) {
        macReminders.push({
          ...reminder,
          year: remindAt.getFullYear(),
          month: remindAt.getMonth() + 1,
          day: remindAt.getDate(),
          hour: remindAt.getHours(),
          minute: remindAt.getMinutes(),
        });
      } else {
        await sendNotification({
          ...reminder,
          id: Number(reminder.id),
          schedule: Schedule.at(remindAt),
        });
      }
      scheduled += 1;
    }
  }
  if (isMacNative) await invoke("schedule_macos_reminders", { reminders: macReminders });
  return scheduled;
}

const iconMap = {
  home: House,
  hub: SquaresFour,
  overview: SquaresFour,
  project: FolderSimple,
  account: IdentificationBadge,
  renewal: ArrowsClockwise,
  server: HardDrives,
  developer: Code,
  publish: Article,
  pending: CheckSquare,
  custom: List,
  almanac: Sparkle,
};

const kindIcons = {
  renewal: ClockCountdown,
  pending: HourglassHigh,
  custom: List,
  project: AppWindow,
  account: Key,
  server: HardDrives,
  developer: Code,
  publish: Article,
  almanac: Sparkle,
};

function loadRecords() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const normalized = normalizeRecords(saved ? JSON.parse(saved) : INITIAL_RECORDS);
    return normalized.filter((record) => !LEGACY_DEMO_IDS.has(record.id));
  } catch {
    return normalizeRecords(INITIAL_RECORDS);
  }
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia("(max-width: 700px)").matches);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 700px)");
    const update = () => setIsMobile(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return isMobile;
}

function useMobileChromeAutoHide(isMobile, paused) {
  const [hidden, setHidden] = useState(false);
  const lastYRef = useRef(0);

  useEffect(() => {
    if (!isMobile || paused) {
      setHidden(false);
      return undefined;
    }

    lastYRef.current = window.scrollY;
    const onScroll = () => {
      const currentY = Math.max(0, window.scrollY);
      const delta = currentY - lastYRef.current;
      if (currentY < 56) setHidden(false);
      else if (delta > 5 && currentY > 96) setHidden(true);
      else if (delta < -3) setHidden(false);
      lastYRef.current = currentY;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isMobile, paused]);

  return [hidden, setHidden];
}

function greetingCopy() {
  const hour = new Date().getHours();
  if (hour < 6) return "夜深了";
  if (hour < 11) return "早上好";
  if (hour < 14) return "中午好";
  if (hour < 18) return "下午好";
  return "晚上好";
}

function recordTitle(record) {
  return record?.title?.trim() || "未命名记录";
}

function remainingDays(date) {
  if (!date) return null;
  const today = new Date();
  const target = new Date(`${date}T12:00:00`);
  return Math.ceil((target - today) / 86400000);
}

function formatDate(date) {
  if (!date) return "未设置";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).format(new Date(`${date}T12:00:00`));
}

function money(amount) {
  if (!Number.isFinite(Number(amount))) return "—";
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    maximumFractionDigits: 0,
  }).format(amount);
}

function LiquidButton({ children, className = "", icon: Icon, ...props }) {
  const onPointerMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--button-x", `${event.clientX - rect.left}px`);
    event.currentTarget.style.setProperty("--button-y", `${event.clientY - rect.top}px`);
  };

  return (
    <motion.button
      whileHover={{ y: -2, scale: 1.015 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 420, damping: 24 }}
      className={`liquid-button ${className}`}
      onPointerMove={onPointerMove}
      {...props}
    >
      <span className="liquid-button__light" />
      {Icon ? <Icon size={20} weight="bold" /> : null}
      <span>{children}</span>
    </motion.button>
  );
}

function StatusPill({ status }) {
  const statusCopy = {
    due: ["即将到期", "coral"],
    normal: ["正常", "blue"],
    review: ["审核中", "amber"],
    verifying: ["验证中", "blue"],
    handled: ["已处理", "mint"],
    active: ["运行中", "mint"],
    secure: ["已保护", "mint"],
    published: ["已发布", "blue"],
    planned: ["计划中", "blue"],
    pending: ["待处理", "amber"],
    paused: ["已暂停", "amber"],
    completed: ["已完成", "mint"],
    confirmed: ["已确认", "mint"],
    cancelled: ["已取消", "coral"],
    disabled: ["已停用", "coral"],
    maintenance: ["维护中", "amber"],
    stopped: ["已停用", "coral"],
    expired: ["已过期", "coral"],
    draft: ["草稿", "blue"],
    rejected: ["被退回", "coral"],
  };
  const [label, tone] = statusCopy[status] || [status || "未设置", "blue"];
  return (
    <span className={`status-pill status-pill--${tone}`}>
      <span className="status-pulse" />
      {label}
    </span>
  );
}

function Sidebar({ activeKind, onNavigate, onQuickAdd, onSettings }) {
  return (
    <aside className="sidebar glass-layer">
      <button className="brand" onClick={() => onNavigate("overview")} aria-label="返回总览">
        <img src="/assets/app-icon-flat.png?v=052" alt="小黄提醒管家" />
        <span>小黄提醒</span>
      </button>

      <nav className="primary-nav" aria-label="主导航">
        {NAVIGATION.map((item) => {
          const Icon = iconMap[item.icon];
          return (
            <button
              key={item.kind}
              className={activeKind === item.kind ? "active" : ""}
              onClick={() => onNavigate(item.kind)}
            >
              <Icon size={21} weight={activeKind === item.kind ? "fill" : "regular"} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="sidebar-actions">
        <button onClick={onSettings}><GearSix size={21} />设置</button>
        <button onClick={() => onNavigate("overview")}><Question size={21} />使用帮助</button>
      </div>

      <div className="sync-state">
        <span className="sync-dot" />
        <span><strong>数据已保存</strong><small>本地设备 · 刚刚</small></span>
      </div>

      <div className="local-library-card" aria-label="本机资料库，数据仅保存在当前设备">
        <HardDrives size={32} weight="duotone" />
        <span><strong>本机资料库</strong><small>数据仅存此设备</small></span>
        <ShieldCheck size={17} weight="duotone" />
      </div>
    </aside>
  );
}

function MobileNav({ activeKind, onNavigate, onAdd, onSettings, settingsOpen }) {
  const items = [
    { kind: "overview", label: "首页", Icon: House },
    { kind: "hub", label: "总览", Icon: SquaresFour },
  ];
  return (
    <nav className="mobile-nav glass-layer" aria-label="移动端导航">
      {items.map(({ kind, label, Icon }) => <button key={kind} className={activeKind === kind ? "active" : ""} onClick={() => onNavigate(kind)}><Icon size={22} weight={activeKind === kind ? "fill" : "regular"} /><span>{label}</span></button>)}
      <button className="mobile-add" onClick={onAdd} aria-label="新增记录"><Plus size={27} weight="bold" /><span>新增</span></button>
      <button className={activeKind === "almanac" ? "active" : ""} onClick={() => onNavigate("almanac")}><Sparkle size={22} weight={activeKind === "almanac" ? "fill" : "regular"} /><span>黄历</span></button>
      <button className={settingsOpen ? "active" : ""} onClick={onSettings}><GearSix size={22} weight={settingsOpen ? "fill" : "regular"} /><span>设置</span></button>
    </nav>
  );
}

function MobileMoreSheet({ open, activeKind, onClose, onNavigate, onSettings }) {
  const swipe = useSwipeDownToClose(onClose);
  const kinds = NAVIGATION.filter((item) => !["overview", "project", "pending"].includes(item.kind));
  return <AnimatePresence>{open ? <motion.div className="mobile-sheet-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <motion.section className="mobile-more-sheet" initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 330, damping: 34 }} {...swipe}>
      <span className="sheet-handle" />
      <div className="mobile-sheet-head"><div><small>全部功能</small><h2>选择要管理的内容</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="关闭更多功能"><X size={21} /></button></div>
      <div className="mobile-more-grid">{kinds.map((item) => { const Icon = iconMap[item.icon]; return <button type="button" className={activeKind === item.kind ? "active" : ""} key={item.kind} onClick={() => { onNavigate(item.kind); onClose(); }}><Icon size={23} /><span><strong>{item.label}</strong><small>查看、新增与编辑</small></span><CaretRight size={16} /></button>; })}</div>
      <button type="button" className="mobile-settings-row" onClick={() => { onSettings(); onClose(); }}><GearSix size={21} /><span>安全、传输与设置</span><CaretRight size={16} /></button>
    </motion.section>
  </motion.div> : null}</AnimatePresence>;
}

function Topbar({ query, setQuery, onQuickAdd, onNotifications, lockEnabled, cloudEnabled, notificationCount }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const todayCopy = new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "long" }).format(new Date());
  return (
    <header className="topbar">
      <div className="greeting">
        <p className="eyebrow">{todayCopy}</p>
        <h1><b>{greetingCopy()}</b><span><Sparkle size={14} weight="fill" /> 今日计划</span></h1>
        <div className="security-row">
          <span><ShieldCheck size={17} />本地安全：<strong>{lockEnabled ? "已加密" : "未开启锁"}</strong></span>
          <span><CloudCheck size={17} />iCloud：{cloudEnabled ? "密文同步中" : "未开启"}</span>
        </div>
      </div>
      <div className="topbar-actions">
        <button className="mobile-notification-action" onClick={onNotifications} aria-label="通知"><Bell size={20} weight="fill" /><span>通知</span>{notificationCount ? <em>{notificationCount}</em> : null}</button>
        <AnimatePresence initial={false}>
          {searchOpen ? (
            <motion.label className="search-field glass-layer" initial={{ width: 42, opacity: 0 }} animate={{ width: 250, opacity: 1 }} exit={{ width: 42, opacity: 0 }}>
              <MagnifyingGlass size={18} />
              <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索账号、项目、服务…" />
              <button onClick={() => { setQuery(""); setSearchOpen(false); }} aria-label="关闭搜索"><X size={15} /></button>
            </motion.label>
          ) : (
            <button className="icon-button" onClick={() => setSearchOpen(true)} aria-label="搜索"><MagnifyingGlass size={22} /></button>
          )}
        </AnimatePresence>
        <button className="icon-button notification-button" onClick={onNotifications} aria-label="开启提醒"><Bell size={22} />{notificationCount ? <span>{notificationCount}</span> : null}</button>
        <LiquidButton className="primary-action" icon={Plus} onClick={onQuickAdd}>快速记录</LiquidButton>
      </div>
    </header>
  );
}

function CountdownRing({ days }) {
  const safeDays = Math.max(0, days ?? 0);
  const progress = Math.max(12, Math.min(96, 100 - safeDays * 2.2));
  return (
    <div className="countdown-ring" style={{ "--progress": `${progress * 3.6}deg` }}>
      <div className="countdown-core">
        <span>到期剩余</span>
        <strong>{safeDays}</strong>
        <small>天</small>
      </div>
    </div>
  );
}

const CALENDAR_YEARS = Array.from({ length: 201 }, (_, index) => 1900 + index);

function MonthYearPicker({ year, month, onChange, compact = false }) {
  const [open, setOpen] = useState(false);
  const pickerRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const closeOutside = (event) => {
      if (!pickerRef.current?.contains(event.target)) setOpen(false);
    };
    const closeWithKeyboard = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeWithKeyboard);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeWithKeyboard);
    };
  }, [open]);
  return <div ref={pickerRef} className={`month-year-picker ${compact ? "compact" : ""}`}>
    <button type="button" className="month-year-trigger" onClick={() => setOpen((current) => !current)} aria-label="选择年份和月份">
      <span>{year} 年 {month + 1} 月</span><CaretDown size={compact ? 13 : 16} />
    </button>
    <AnimatePresence>
      {open ? <motion.div className="month-year-popover" initial={{ opacity: 0, y: -7, scale: .96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -5 }}>
        <div className="month-year-popover__head"><label><span>年份</span><ThemedSelect compact value={year} ariaLabel="选择年份" onChange={(nextYear) => onChange(Number(nextYear), month)} options={CALENDAR_YEARS.map((item) => [item, `${item} 年`])} /></label><button type="button" className="month-year-close" onClick={() => setOpen(false)} aria-label="关闭年月选择"><X size={16} /></button></div>
        <div className="month-grid">{Array.from({ length: 12 }, (_, index) => <button type="button" className={month === index ? "active" : ""} key={index} onClick={() => { onChange(year, index); setOpen(false); }}>{index + 1} 月</button>)}</div>
        <small>可选择 1900—2100 年</small>
      </motion.div> : null}
    </AnimatePresence>
  </div>;
}

function ChineseDatePicker({ value, onChange }) {
  const initial = value ? new Date(`${value}T12:00:00`) : new Date();
  const initialLunar = lunarPartsForSolarDate(value || localDateKey(initial)) || { year: initial.getFullYear(), month: 1, day: 1 };
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("solar");
  const [cursor, setCursor] = useState(new Date(initial.getFullYear(), initial.getMonth(), 1));
  const [lunarSelection, setLunarSelection] = useState(initialLunar);
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const leading = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells = [...Array(leading).fill(null), ...Array.from({ length: days }, (_, index) => index + 1)];
  const lunarMonths = lunarMonthOptions(lunarSelection.year);
  const selectedLunarMonth = lunarMonths.find((item) => item.value === Number(lunarSelection.month)) || lunarMonths[0];
  const lunarPreviewDate = selectedLunarMonth ? solarDateKeyFromLunar(lunarSelection.year, selectedLunarMonth.value, Math.min(lunarSelection.day, selectedLunarMonth.dayCount)) : "";

  const toggleOpen = () => {
    if (!open) {
      const selected = value ? new Date(`${value}T12:00:00`) : new Date();
      setCursor(new Date(selected.getFullYear(), selected.getMonth(), 1));
      setLunarSelection(lunarPartsForSolarDate(value || localDateKey(selected)) || initialLunar);
    }
    setOpen((current) => !current);
  };
  const choose = (day) => {
    onChange(localDateKey(new Date(year, month, day)));
    setOpen(false);
  };
  const changeLunarYear = (nextYear) => {
    const months = lunarMonthOptions(nextYear);
    setLunarSelection((current) => ({ year: nextYear, month: months[0]?.value || 1, day: Math.min(current.day, months[0]?.dayCount || 29) }));
  };

  return <div className="date-picker">
    <button type="button" className="date-picker__trigger" onClick={toggleOpen}>
      <CalendarBlank size={18} />
      <span>{value ? <>{formatDate(value)}<small>{lunarSummaryForDate(value)?.lunarDate}</small></> : "选择日期（公历 / 农历）"}</span>
      <CaretDown size={15} />
    </button>
    <AnimatePresence>
      {open ? <motion.div className="date-picker__popover" initial={{ opacity: 0, y: -8, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6 }}>
        <div className="date-picker__top"><div className="date-picker__mode"><button type="button" className={mode === "solar" ? "active" : ""} onClick={() => setMode("solar")}>公历选择</button><button type="button" className={mode === "lunar" ? "active" : ""} onClick={() => setMode("lunar")}>农历选择</button></div><button type="button" className="month-year-close" onClick={() => setOpen(false)} aria-label="关闭日期选择"><X size={16} /></button></div>
        {mode === "solar" ? <>
          <div className="date-picker__head">
            <button type="button" onClick={() => setCursor(new Date(year, month - 1, 1))}><CaretLeft size={17} /></button>
            <MonthYearPicker compact year={year} month={month} onChange={(nextYear, nextMonth) => setCursor(new Date(nextYear, nextMonth, 1))} />
            <button type="button" onClick={() => setCursor(new Date(year, month + 1, 1))}><CaretRight size={17} /></button>
          </div>
          <div className="date-picker__week">{["日", "一", "二", "三", "四", "五", "六"].map((day) => <span key={day}>{day}</span>)}</div>
          <div className="date-picker__days">
            {cells.map((day, index) => {
              if (!day) return <span key={`blank-${index}`} />;
              const dateKey = localDateKey(new Date(year, month, day));
              return <button type="button" key={dateKey} className={value === dateKey ? "selected" : ""} onClick={() => choose(day)}><strong>{day}</strong><small>{lunarCellLabel(dateKey)}</small></button>;
            })}
          </div>
        </> : <div className="lunar-picker-panel">
          <div className="lunar-picker-selects">
            <label><span>农历年</span><ThemedSelect value={lunarSelection.year} ariaLabel="选择农历年" onChange={(nextYear) => changeLunarYear(Number(nextYear))} options={CALENDAR_YEARS.map((item) => [item, `${item} 年`])} /></label>
            <label><span>农历月</span><ThemedSelect value={selectedLunarMonth?.value || 1} ariaLabel="选择农历月" onChange={(nextValue) => { const nextMonth = lunarMonths.find((item) => item.value === Number(nextValue)); setLunarSelection((current) => ({ ...current, month: Number(nextValue), day: Math.min(current.day, nextMonth?.dayCount || 29) })); }} options={lunarMonths.map((item) => [item.value, item.label])} /></label>
            <label><span>农历日</span><ThemedSelect value={Math.min(lunarSelection.day, selectedLunarMonth?.dayCount || 29)} ariaLabel="选择农历日" onChange={(nextDay) => setLunarSelection((current) => ({ ...current, day: Number(nextDay) }))} options={Array.from({ length: selectedLunarMonth?.dayCount || 29 }, (_, index) => index + 1).map((day) => [day, lunarDayLabel(lunarSelection.year, selectedLunarMonth?.value || 1, day)])} /></label>
          </div>
          <div className="lunar-conversion-preview"><Sparkle size={20} /><span><strong>{lunarPreviewDate ? lunarSummaryForDate(lunarPreviewDate)?.lunarDate : "请选择农历日期"}</strong><small>{lunarPreviewDate ? `对应公历 ${formatDate(lunarPreviewDate)}` : ""}</small></span></div>
          <button type="button" className="lunar-picker-confirm" disabled={!lunarPreviewDate} onClick={() => { onChange(lunarPreviewDate); const converted = new Date(`${lunarPreviewDate}T12:00:00`); setCursor(new Date(converted.getFullYear(), converted.getMonth(), 1)); setOpen(false); }}>使用这个农历日期</button>
        </div>}
        <button type="button" className="date-picker__today" onClick={() => { const today = new Date(); setCursor(new Date(today.getFullYear(), today.getMonth(), 1)); onChange(localDateKey(today)); setOpen(false); }}>选择今天</button>
      </motion.div> : null}
    </AnimatePresence>
  </div>;
}

function WelcomePanel({ onAdd }) {
  return <motion.section className="welcome-panel content-surface" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
    <div className="welcome-orbit"><Sparkle size={30} weight="fill" /></div>
    <div>
      <p className="eyebrow">从这里开始</p>
      <h2>界面已经准备好，先记录一件重要的事</h2>
      <p>添加项目、订阅续费或待办事项；之后点开任意记录，都能查看详情、修改内容或删除。</p>
      <div className="welcome-tips">
        <span><Plus size={17} />进入分类后点“新增”</span>
        <span><PencilSimple size={17} />点开记录即可编辑</span>
        <span><BellRinging size={17} />设置日期和时间后统一提醒</span>
      </div>
    </div>
    <LiquidButton icon={Plus} onClick={() => onAdd("project")}>创建第一条记录</LiquidButton>
  </motion.section>;
}

function CinematicCalendar({ records, onOpen, onAdd, onViewAlmanac }) {
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(localDateKey(today));
  const [monthDirection, setMonthDirection] = useState(1);
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const leading = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const cells = [...Array(leading).fill(null), ...Array.from({ length: totalDays }, (_, index) => index + 1)];
  while (cells.length % 7) cells.push(null);
  const datedRecords = records.filter((record) => record.dueDate);
  const recordsByDate = datedRecords.reduce((result, record) => {
    (result[record.dueDate] ||= []).push(record);
    return result;
  }, {});
  const selectedRecords = recordsByDate[selectedDate] || [];
  const selectedAlmanac = lunarPreviewForDate(selectedDate);
  const monthCount = datedRecords.filter((record) => {
    const date = new Date(`${record.dueDate}T12:00:00`);
    return date.getFullYear() === year && date.getMonth() === month;
  }).length;

  const goToMonth = (nextYear, nextMonth, preferredDay = 1) => {
    const targetMonth = new Date(nextYear, nextMonth, 1);
    const targetYear = targetMonth.getFullYear();
    const targetMonthIndex = targetMonth.getMonth();
    const day = Math.min(preferredDay, new Date(targetYear, targetMonthIndex + 1, 0).getDate());
    setMonthDirection(targetMonth.getTime() >= cursor.getTime() ? 1 : -1);
    setCursor(targetMonth);
    setSelectedDate(localDateKey(new Date(targetYear, targetMonthIndex, day)));
  };

  return <motion.section className="cinema-calendar content-surface" layout>
    <div className="calendar-aurora calendar-aurora--one" />
    <div className="calendar-aurora calendar-aurora--two" />
    <div className="cinema-calendar__head">
      <div><p className="eyebrow">时间轨道</p><div className="cinema-calendar__title"><CalendarBlank size={24} weight="duotone" /><MonthYearPicker year={year} month={month} onChange={(nextYear, nextMonth) => goToMonth(nextYear, nextMonth)} /></div><span>点击年月可快速跳转 · 本月 {monthCount} 项日程</span></div>
      <div className="calendar-head-actions">
        <div className="calendar-controls">
          <button onClick={() => goToMonth(year, month - 1)} aria-label="上个月"><CaretLeft size={19} /></button>
          <button onClick={() => { setCursor(new Date(today.getFullYear(), today.getMonth(), 1)); setSelectedDate(localDateKey(today)); }}>今天</button>
          <button onClick={() => goToMonth(year, month + 1)} aria-label="下个月"><CaretRight size={19} /></button>
        </div>
        <small className="calendar-double-tip">单击查看 · 双击新增</small>
      </div>
    </div>
    <div className="calendar-layout">
      <div className="month-stage">
        <div className="calendar-week">{["周日", "周一", "周二", "周三", "周四", "周五", "周六"].map((day) => <span key={day}>{day}</span>)}</div>
        <AnimatePresence mode="wait" initial={false}>
        <motion.div key={`${year}-${month}`} className="calendar-days" initial={{ opacity: 0, x: monthDirection * 28, clipPath: monthDirection > 0 ? "inset(0 0 0 18%)" : "inset(0 18% 0 0)" }} animate={{ opacity: 1, x: 0, clipPath: "inset(0 0 0 0)" }} exit={{ opacity: 0, x: monthDirection * -18, clipPath: monthDirection > 0 ? "inset(0 16% 0 0)" : "inset(0 0 0 16%)" }} transition={{ duration: .32, ease: [.22, .75, .2, 1] }}>
          {cells.map((day, index) => {
            if (!day) return <span className="calendar-day blank" key={`blank-${index}`} />;
            const date = localDateKey(new Date(year, month, day));
            const events = recordsByDate[date] || [];
            const isToday = date === localDateKey(today);
            return <motion.button key={date} className={`calendar-day ${selectedDate === date ? "selected" : ""} ${isToday ? "today" : ""}`} onClick={() => setSelectedDate(date)} onDoubleClick={(event) => { event.preventDefault(); setSelectedDate(date); onAdd("pending", date); }} title={`${date}：单击查看当天内容，双击新增日程`} aria-label={`${day}日${events.length ? `，已有${events.length}项内容` : ""}，单击查看，双击新增`} whileHover={{ y: -3, scale: 1.02 }} whileTap={{ scale: .96 }}>
              <span className="calendar-day__solar">{day}</span>
              <span className="calendar-day__lunar">{lunarCellLabel(date)}</span>
              {events.length ? <span className="event-dots">{events.slice(0, 3).map((event) => <i key={event.id} className={`event-dot event-dot--${event.kind}`} />)}</span> : null}
              {events.length ? <small>{events.length} 项</small> : null}
            </motion.button>;
          })}
        </motion.div>
        </AnimatePresence>
      </div>
      <aside className="day-agenda">
        <div className="day-agenda__head"><span><small>当天场次</small>{formatDate(selectedDate)}</span><button onClick={() => onAdd("pending", selectedDate)}><Plus size={16} />在这天新增</button></div>
        {selectedAlmanac ? <motion.div key={`almanac-${selectedDate}`} className="almanac-day-preview" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .24 }}>
          <div><span className="almanac-mark"><Sparkle size={18} weight="fill" /></span><span><strong>{selectedAlmanac.lunarDate}</strong><small>{selectedAlmanac.lunarYear} · {selectedAlmanac.dayGanZhi}</small></span></div>
          <div className="almanac-preview-tags"><span>{selectedAlmanac.duty}</span><span>{selectedAlmanac.dayOfficer}</span></div>
          <p><em>宜</em>{selectedAlmanac.yi.slice(0, 4).join("、") || "无特别条目"}</p>
          <button type="button" onClick={() => onViewAlmanac(selectedDate)}>查看这天完整黄历 <CaretRight size={14} /></button>
        </motion.div> : null}
        <AnimatePresence mode="popLayout">
          {selectedRecords.length ? selectedRecords.map((record) => {
            const Icon = kindIcons[record.kind] || BellRinging;
            return <motion.button layout key={record.id} className="agenda-item" onClick={() => onOpen(record)} initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}>
              <span className={`agenda-time agenda-time--${record.kind}`}>{record.dueTime || "全天"}</span>
              <span className="agenda-icon"><Icon size={19} /></span>
              <span><strong>{recordTitle(record)}</strong><small>{KIND_LABELS[record.kind]} · {record.project || "未关联项目"}</small></span>
              <CaretRight size={17} />
            </motion.button>;
          }) : <motion.div className="agenda-empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><CalendarBlank size={28} /><strong>这一天还没有安排</strong><span>点“新增日程”记录到期、续费或待办。</span></motion.div>}
        </AnimatePresence>
      </aside>
    </div>
  </motion.section>;
}

function AlmanacDetailCard({ date }) {
  const info = lunarInfoForDate(date);
  if (!info) return <div className="almanac-unavailable">当前日期超出农历计算范围，请选择 1900—2100 年。</div>;
  return <div className="almanac-detail-card content-surface">
    <div className="almanac-hero-copy">
      <span className="almanac-emblem"><Sparkle size={30} weight="fill" /></span>
      <span><small>{formatDate(date)}</small><h3>{info.lunarDate}</h3><p>{info.lunarYear} · {info.dayGanZhi}{info.jieQi ? ` · ${info.jieQi}` : ""}</p></span>
      <span className={`almanac-day-type ${info.dayOfficer.includes("黄道") ? "good" : "neutral"}`}>{info.dayOfficer}</span>
    </div>
    <div className="almanac-fact-grid">
      <div><small>十二值日</small><strong>{info.duty}</strong></div>
      <div><small>冲煞</small><strong>{info.clash}</strong></div>
      <div><small>纳音</small><strong>{info.naYin}</strong></div>
      <div><small>星宿</small><strong>{info.mansion}</strong></div>
    </div>
    <div className="almanac-yi-ji">
      <section className="almanac-yi"><h4><span>宜</span>传统事项</h4><div>{info.yi.length ? info.yi.map((item) => <span key={item}>{item}</span>) : <span>无特别条目</span>}</div></section>
      <section className="almanac-ji"><h4><span>忌</span>传统事项</h4><div>{info.ji.length ? info.ji.map((item) => <span key={item}>{item}</span>) : <span>无特别条目</span>}</div></section>
    </div>
    <details className="almanac-extra-details">
      <summary><span><Sparkle size={18} />更多传统信息</span><small>方位、九星、物候、吉神与百忌</small></summary>
      <div className="almanac-extra-content">
        <div className="almanac-secondary-facts">
          <div><small>传统方位</small><strong>{info.luckyDirections}</strong></div>
          {info.festivals.length ? <div><small>传统节日</small><strong>{info.festivals.join("、")}</strong></div> : null}
          <div><small>胎神方位</small><strong>{info.fetalGod}</strong></div>
          <div><small>太岁方位</small><strong>{info.taiSui}</strong></div>
          <div><small>日九星</small><strong>{info.nineStar}</strong></div>
          <div><small>月相</small><strong>{info.moonPhase}</strong></div>
          <div><small>六曜</small><strong>{info.liuYao}</strong></div>
          <div><small>物候</small><strong>{info.seasonalPhenology}</strong></div>
          <div><small>日禄</small><strong>{info.dayLu}</strong></div>
        </div>
        <div className="almanac-spirits"><div><small>传统吉神条目</small><p>{info.goodSpirits.join("、") || "无特别条目"}</p></div><div><small>传统慎用条目</small><p>{info.cautionItems.join("、") || "无特别条目"}</p></div></div>
        <div className="almanac-pengzu"><div><small>彭祖百忌</small>{info.pengZu.map((item) => <p key={item}>{item}</p>)}</div><span>古代警句，仅作民俗文献展示，不应按字面推断现实后果。</span></div>
      </div>
    </details>
    <details className="almanac-time-details">
      <summary><span><ClockCountdown size={18} />传统时辰参考</span><small>展开查看 13 个时段的神煞与宜忌</small></summary>
      <div className="almanac-time-grid">{info.timeSlots.map((slot) => <div className={`almanac-time-card ${slot.luck === "吉" ? "good" : "caution"}`} key={`${slot.range}-${slot.ganZhi}`}><div><strong>{slot.range}</strong><span>{slot.ganZhi}时 · {slot.officer}</span><em>{slot.luck}</em></div><p><b>宜</b>{slot.yi.slice(0, 5).join("、") || "无特别条目"}</p><p><b>忌</b>{slot.ji.slice(0, 5).join("、") || "无特别条目"}</p></div>)}</div>
    </details>
    <details className="almanac-source-details">
      <summary><span><Article size={18} />重要传统来源</span><small>四个影响较大的官修与民间文献体系</small></summary>
      <div className="almanac-source-grid">{ALMANAC_REFERENCES.map((source) => <article key={source.title}><div><span>{source.badge}</span><h4>{source.title}</h4></div><small>{source.edition}</small><p>{source.focus}</p><em>{source.reliability}</em></article>)}</div>
      <p className="almanac-source-boundary">当前日期数值由 lunar-javascript 1.7.7 计算；上列古籍用于说明传统知识谱系，不表示软件已逐卷逐条对勘，也不把不同版本强行合成一个结论。</p>
    </details>
    <div className="almanac-disclaimer"><ShieldCheck size={18} /><p><strong>传统民俗参考</strong><span>采用 lunar-javascript 1.7.7 的通用历法与黄历表算法。不同地区、通胜版本和流派可能给出不同宜忌；婚礼、丧葬、动土、签约等事项应以健康、安全、天气、交通、法律与家人安排为先。</span></p></div>
  </div>;
}

function AlmanacView({ date, onDateChange, records, onOpen, onAdd }) {
  const scheduled = records.filter((record) => record.kind === "almanac" && record.dueDate === date);
  return <motion.section className="almanac-view" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
    <div className="collection-head almanac-view__head">
      <div><p className="eyebrow">传统历法工具</p><h2>农历黄历</h2><p>查看指定日期的农历与传统宜忌，并为婚丧嫁娶、搬家、开业等事项建立本地提醒。</p></div>
      <div className="almanac-head-actions"><ChineseDatePicker value={date} onChange={onDateChange} /><LiquidButton icon={Plus} onClick={() => onAdd("almanac", date)}>记录传统事项</LiquidButton></div>
    </div>
    <AlmanacDetailCard date={date} />
    <section className="almanac-records content-surface">
      <div className="almanac-records__head"><div><h3>这一天的相关安排</h3><p>所有记录都可以查看、编辑和删除。</p></div><button onClick={() => onAdd("almanac", date)}><Plus size={16} />新增</button></div>
      {scheduled.length ? <div className="almanac-record-list">{scheduled.map((record) => <button key={record.id} onClick={() => onOpen(record)}><span className="record-orb"><Sparkle size={20} /></span><span><strong>{recordTitle(record)}</strong><small>{record.traditionMatter || record.subtitle || "传统事项"} · {record.dueTime || "全天"}</small></span><StatusPill status={record.status} /><CaretRight size={17} /></button>)}</div> : <div className="agenda-empty"><Sparkle size={28} /><strong>这一天还没有传统事项记录</strong><span>黄历可以查看，是否采用由你结合现实情况决定。</span></div>}
    </section>
  </motion.section>;
}

function OverviewPortals({ records, onNavigate }) {
  const items = [
    { kind: "project", label: "项目", copy: "查看项目及其关联数据", Icon: FolderSimple },
    { kind: "renewal", label: "订阅续费", copy: "查看到期时间与费用", Icon: ArrowsClockwise },
    { kind: "pending", label: "待办与确认", copy: "查看要做和待确认的事", Icon: CheckSquare },
  ];
  return <section className="overview-portals" aria-label="快捷查看全部">
    {items.map(({ kind, label, copy, Icon }, index) => <motion.button key={kind} className={`overview-portal overview-portal--${kind}`} onClick={() => onNavigate(kind)} whileHover={{ y: -4, scale: 1.012 }} whileTap={{ scale: .98 }}>
      <span className="overview-portal__icon"><Icon size={23} weight="duotone" /></span>
      <span><small>查看全部 · {records.filter((record) => record.kind === kind).length} 项</small><strong>{label}</strong><em>{copy}</em></span>
      <CaretRight size={19} />
      <i style={{ "--portal-delay": `${index * -1.8}s` }} />
    </motion.button>)}
  </section>;
}

function UpcomingTasks({ records, onOpen, onViewAll, onAdd }) {
  const today = localDateKey(new Date());
  const upcoming = records
    .filter((record) => record.dueDate && record.status !== "handled" && record.dueDate >= today)
    .sort((a, b) => `${a.dueDate}${a.dueTime || "23:59"}`.localeCompare(`${b.dueDate}${b.dueTime || "23:59"}`))
    .slice(0, 6);

  return <section className="upcoming-tasks content-surface">
    <div className="upcoming-tasks__head">
      <div><p className="eyebrow">接下来</p><h2>马上要到期</h2><span>按时间排序，只显示仍需处理的事项</span></div>
      <button type="button" onClick={onViewAll}>查看全部 <CaretRight size={16} /></button>
    </div>
    {upcoming.length ? <div className="upcoming-tasks__list">{upcoming.map((record) => {
      const Icon = kindIcons[record.kind] || BellRinging;
      const days = remainingDays(record.dueDate);
      const dayCopy = days === 0 ? "今天" : days === 1 ? "明天" : `${days} 天后`;
      return <button type="button" key={record.id} onClick={() => onOpen(record)}>
        <span className="upcoming-tasks__date"><strong>{new Date(`${record.dueDate}T12:00:00`).getDate()}</strong><small>{new Intl.DateTimeFormat("zh-CN", { month: "short" }).format(new Date(`${record.dueDate}T12:00:00`))}</small></span>
        <span className="upcoming-tasks__icon"><Icon size={20} /></span>
        <span className="upcoming-tasks__copy"><strong>{recordTitle(record)}</strong><small>{record.dueTime || "全天"} · {KIND_LABELS[record.kind]}</small></span>
        <em className={days <= 1 ? "urgent" : ""}>{dayCopy}</em>
        <CaretRight size={17} />
      </button>;
    })}</div> : <div className="upcoming-tasks__empty"><CheckCircle size={30} weight="duotone" /><span><strong>近期没有待处理事项</strong><small>新增日期与时间后，会按先后顺序显示在这里。</small></span><button type="button" onClick={() => onAdd("pending")}>新增待办</button></div>}
  </section>;
}

function OverviewHub({ records, onNavigate }) {
  const sections = [
    { kind: "project", label: "项目", copy: "项目与关联资料", Icon: FolderSimple },
    { kind: "renewal", label: "订阅续费", copy: "费用、周期与到期日", Icon: ArrowsClockwise },
    { kind: "pending", label: "待办与确认", copy: "任务、申请和等待结果", Icon: CheckSquare },
    { kind: "account", label: "账号与绑定", copy: "账号归属与验证方式", Icon: IdentificationBadge },
    { kind: "server", label: "服务器", copy: "主机、域名和证书", Icon: HardDrives },
    { kind: "developer", label: "开发者资质", copy: "平台资质与有效期", Icon: Code },
    { kind: "publish", label: "发布记录", copy: "版本、审核与上线记录", Icon: Article },
    { kind: "custom", label: "自定义记录", copy: "字段和内容完全由你添加", Icon: List },
  ];
  const active = records.filter((record) => record.status !== "handled").length;
  const dated = records.filter((record) => record.dueDate && record.status !== "handled").length;

  return <motion.section className="overview-hub" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
    <div className="collection-head overview-hub__head"><div><p className="eyebrow">全部资料</p><h2>总览</h2><p>按用途进入分类，查看、编辑或删除对应的全部内容。</p></div></div>
    <div className="overview-hub__summary content-surface">
      <span><small>全部记录</small><strong>{records.length}</strong></span>
      <span><small>仍需处理</small><strong>{active}</strong></span>
      <span><small>已设日期</small><strong>{dated}</strong></span>
    </div>
    <div className="overview-hub__grid">{sections.map(({ kind, label, copy, Icon }) => {
      const count = records.filter((record) => record.kind === kind).length;
      return <motion.button type="button" key={kind} className="overview-hub__card content-surface" onClick={() => onNavigate(kind)} whileTap={{ scale: .975 }}>
        <span className="overview-hub__icon"><Icon size={24} weight="duotone" /></span>
        <span><strong>{label}</strong><small>{copy}</small></span>
        <em>{count} 项</em><CaretRight size={18} />
      </motion.button>;
    })}</div>
  </motion.section>;
}

function HeroRenewal({ record, onOpen, onHandled }) {
  if (!record) return null;
  const days = remainingDays(record.dueDate);
  return (
    <motion.section className="hero-panel content-surface" layout>
      <div className="section-heading"><span>下一件要处理</span><Sparkle size={18} weight="fill" /></div>
      <div className="hero-content">
        <CountdownRing days={days} />
        <div className="hero-copy">
          <span className="category-chip"><ClockCountdown size={15} />续费</span>
          <h2>{recordTitle(record)}</h2>
          <p>{record.notes}</p>
          <div className="hero-meta">
            <span><CreditCard size={17} />{money(record.amount)} / {record.cycle}</span>
            <span><CalendarBlank size={17} />{formatDate(record.dueDate)} 到期</span>
          </div>
          <div className="hero-actions">
            <LiquidButton icon={ArrowRight} onClick={() => onOpen(record)}>立即处理</LiquidButton>
            <button className="secondary-button" onClick={() => onHandled(record.id)}>稍后处理 <CalendarBlank size={17} /></button>
          </div>
        </div>
      </div>
      <div className="hero-light-trail" />
    </motion.section>
  );
}

function RenewalTable({ records, selectedId, onSelect, onViewAll }) {
  return (
    <section className="data-section">
      <div className="data-section__head">
        <h3><ClockCountdown size={22} />即将到期的续费</h3>
        <button onClick={onViewAll}>查看全部（{records.length}）<CaretRight size={16} /></button>
      </div>
      <div className="table-head renewal-grid">
        <span>项目</span><span>到期日期</span><span>剩余天数</span><span>金额</span><span>状态</span><span />
      </div>
      <div className="data-list">
        {records.length ? records.map((record) => {
          const Icon = kindIcons[record.kind];
          const days = remainingDays(record.dueDate);
          return (
            <motion.button
              layout
              key={record.id}
              className={`data-row renewal-grid ${selectedId === record.id ? "selected" : ""}`}
              onClick={() => onSelect(record)}
              whileHover={{ x: 4 }}
              transition={{ type: "spring", stiffness: 420, damping: 28 }}
            >
              <span className="row-title"><span className="row-icon"><Icon size={20} weight="duotone" /></span><span><strong>{recordTitle(record)}</strong><small>{record.subtitle}</small></span></span>
              <span>{formatDate(record.dueDate)}</span>
              <span className={days <= 14 ? "urgent-copy" : "days-copy"}>{days} 天</span>
              <span>{money(record.amount)} / {record.cycle}</span>
              <StatusPill status={record.status} />
              <CaretRight size={17} />
            </motion.button>
          );
        }) : <div className="table-empty"><ClockCountdown size={22} /><span>暂无续费记录，可进入“订阅续费”新增。</span></div>}
      </div>
    </section>
  );
}

function PendingTable({ records, onSelect, onViewAll }) {
  return (
    <section className="data-section pending-section">
      <div className="data-section__head">
        <h3><HourglassHigh size={22} />待确认的结果</h3>
        <button onClick={onViewAll}>查看全部（{records.length}）<CaretRight size={16} /></button>
      </div>
      <div className="table-head pending-grid">
        <span>项目</span><span>提交时间</span><span>关联项目</span><span>状态</span><span />
      </div>
      <div className="data-list">
        {records.length ? records.map((record) => (
          <motion.button key={record.id} className="data-row pending-grid" onClick={() => onSelect(record)} whileHover={{ x: 4 }}>
            <span className="row-title"><span className="row-icon"><HourglassHigh size={20} /></span><span><strong>{recordTitle(record)}</strong><small>{record.subtitle}</small></span></span>
            <span>{record.submittedAt}</span>
            <span>{record.project}</span>
            <StatusPill status={record.status} />
            <CaretRight size={17} />
          </motion.button>
        )) : <div className="table-empty"><HourglassHigh size={22} /><span>暂无待办与确认事项。</span></div>}
      </div>
    </section>
  );
}

function CollectionView({ kind, records, query, onSelect, onQuickAdd }) {
  const label = KIND_LABELS[kind] || "全部资产";
  const filtered = records.filter((record) => {
    if (kind === "developer") return record.kind === "developer" || record.id === "renewal-apple";
    if (kind === "server") return record.kind === "server" || record.id === "renewal-server-hk";
    return record.kind === kind;
  }).filter((record) => `${record.title || ""} ${record.subtitle || ""} ${record.project || ""}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <motion.section className="collection-view" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <div className="collection-head">
        <div><p className="eyebrow">资产档案</p><h2>{label}</h2><p>集中查看、编辑和追踪所有相关记录。</p></div>
        <LiquidButton icon={Plus} onClick={() => onQuickAdd(kind)}>新增{label}</LiquidButton>
      </div>
      <div className="collection-grid">
        <div className="collection-stat content-surface"><span>当前记录</span><strong>{filtered.length}</strong><small>条已归档信息</small></div>
        <div className="collection-stat content-surface"><span>安全状态</span><strong className="mint-copy">良好</strong><small>敏感字段默认隐藏</small></div>
        <div className="collection-stat content-surface"><span>最近更新</span><strong>今天</strong><small>所有更改已本地保存</small></div>
      </div>
      <div className="collection-list content-surface">
        {filtered.length ? filtered.map((record, index) => {
          const Icon = kindIcons[record.kind] || Database;
          return (
            <motion.button key={record.id} onClick={() => onSelect(record)} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.045 }} whileHover={{ x: 5 }}>
              <span className="record-orb"><Icon size={23} weight="duotone" /></span>
              <span className="record-main"><strong>{recordTitle(record)}</strong><small>{record.subtitle || record.notes}</small></span>
              <span className="record-project">{record.project || KIND_LABELS[record.kind]}</span>
              <StatusPill status={record.status} />
              <CaretRight size={18} />
            </motion.button>
          );
        }) : (
          <div className="empty-state"><Plus size={30} /><h3>{query ? "没有找到相关记录" : `还没有${label}记录`}</h3><p>{query ? "换个关键词试试。" : "点击右上角新增，填写后即可查看、编辑或删除。"}</p><button onClick={() => onQuickAdd(kind)}>新增{label}</button></div>
        )}
      </div>
    </motion.section>
  );
}

function DetailDrawer({ record, onClose, onHandled, onDelete, onEdit, onAddRelated, handledAnimation }) {
  const [reveal, setReveal] = useState(false);
  const swipe = useSwipeDownToClose(onClose);
  if (!record) return null;
  const canHandle = record.kind === "renewal" || record.kind === "pending" || record.kind === "almanac";
  const detailIcons = {
    subtitle: Article,
    account: UserCircle,
    email: EnvelopeSimple,
    phone: DeviceMobile,
    identity: IdentificationBadge,
    project: AppWindow,
    amount: CreditCard,
    cycle: ArrowsClockwise,
    payment: CreditCard,
    dueDate: CalendarBlank,
    dueTime: ClockCountdown,
    reminders: BellRinging,
    url: LinkSimple,
    traditionMatter: Sparkle,
    participants: UserCircle,
    location: Globe,
    traditionSource: Article,
    realWorldConstraints: ShieldCheck,
  };
  const formatFieldValue = (field) => {
    const value = record[field.key];
    if (field.key === "dueDate" && value) return `${formatDate(value)} · ${lunarSummaryForDate(value)?.lunarDate || ""}`;
    if (field.key === "amount" && value !== "" && value != null) return money(value);
    return value;
  };
  const fields = [
    ...fieldsForKind(record.kind)
      .filter((field) => !["status", "notes", "password"].includes(field.key))
      .map((field) => [detailIcons[field.key] || Database, field.label, formatFieldValue(field)])
      .filter(([, , value]) => value !== "" && value != null),
    ...(record.customFields || []).map((field) => [Database, field.label || "自定义内容", field.value]),
  ];

  const copy = async (value) => {
    try { await navigator.clipboard.writeText(value); } catch { /* Clipboard can be unavailable in preview. */ }
  };

  return (
    <motion.aside
      className="detail-drawer glass-layer"
      initial={{ x: "105%", opacity: 0, filter: "blur(12px)" }}
      animate={{ x: 0, opacity: 1, filter: "blur(0px)" }}
      exit={{ x: "105%", opacity: 0, filter: "blur(8px)" }}
      transition={{ type: "spring", stiffness: 260, damping: 30 }}
      {...swipe}
    >
      <span className="sheet-handle" />
      <div className="drawer-head">
        <div><StatusPill status={record.status} /><h2>{recordTitle(record)}</h2><p>{record.subtitle || KIND_LABELS[record.kind]}</p></div>
        <div className="drawer-head__actions"><button className="icon-button" onClick={() => onEdit(record)} aria-label="编辑记录"><PencilSimple size={21} /></button><button className="icon-button" onClick={onClose} aria-label="关闭详情"><X size={23} /></button></div>
      </div>
      <div className="drawer-scroll">
        <div className="drawer-fields">
          {fields.map(([Icon, label, value]) => (
            <div className="drawer-field" key={label}>
              <Icon size={19} />
              <span><small>{label}</small><strong>{value}</strong></span>
              <button onClick={() => copy(String(value))} aria-label={`复制${label}`}><Copy size={16} /></button>
            </div>
          ))}
          {record.password ? (
            <div className="drawer-field password-field">
              <LockKey size={19} />
              <span><small>密码 / 密钥</small><strong>{reveal ? record.password : "••••••••••••"}</strong></span>
              <button onClick={() => setReveal((value) => !value)} aria-label="显示或隐藏密码">{reveal ? <EyeSlash size={17} /> : <Eye size={17} />}</button>
            </div>
          ) : null}
        </div>
        {record.kind === "almanac" && record.dueDate ? <div className="drawer-almanac"><AlmanacDetailCard date={record.dueDate} /></div> : null}
        <div className="drawer-notes">
          <div><span>备注</span><button onClick={() => onEdit(record)}><PencilSimple size={16} />编辑</button></div>
          <p>{record.notes || "暂无备注。"}</p>
        </div>
      </div>
      <div className="drawer-actions">
        <LiquidButton icon={PencilSimple} onClick={() => onEdit(record)}>编辑全部内容</LiquidButton>
        {record.kind === "project" ? <button className="secondary-button" onClick={() => onAddRelated(record)}><Plus size={17} />为此项目增加数据</button> : null}
        {record.url ? <LiquidButton icon={ArrowSquareOut} onClick={() => openExternal(record.url)}>前往{record.kind === "renewal" ? "续费" : "管理"}</LiquidButton> : null}
        {canHandle ? (
          <motion.button
            className={`confirm-button ${record.status === "handled" || handledAnimation ? "success" : ""}`}
            onClick={() => onHandled(record.id)}
            layout
          >
            <AnimatePresence mode="wait" initial={false}>
              {record.status === "handled" || handledAnimation ? (
                <motion.span key="done" initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }}><Check size={20} weight="bold" />已处理</motion.span>
              ) : (
                <motion.span key="todo" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><CheckCircle size={20} />标记已处理</motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        ) : null}
        <button className="delete-button" onClick={() => onDelete(record.id)}><Trash size={17} />删除记录</button>
      </div>
    </motion.aside>
  );
}

function RecordFormField({ field, form, setForm }) {
  const value = form[field.key] ?? "";
  const setValue = (nextValue) => setForm((current) => ({ ...current, [field.key]: nextValue }));
  const className = field.wide ? "span-two" : "";
  if (field.type === "date") return <label className={className}><span>{field.label}</span><ChineseDatePicker value={value} onChange={setValue} /></label>;
  if (field.type === "select") return <div className={`form-field ${className}`}><span>{field.label}</span><ThemedSelect value={value} options={field.options || []} onChange={setValue} ariaLabel={`选择${field.label}`} /></div>;
  if (field.type === "textarea") return <label className={className}><span>{field.label}</span><textarea value={value} onChange={(event) => setValue(event.target.value)} placeholder={field.placeholder} /></label>;
  return <label className={className}><span>{field.label}</span><input type={field.type || "text"} min={field.type === "number" ? "0" : undefined} value={value} onChange={(event) => setValue(event.target.value)} placeholder={field.placeholder} /></label>;
}

function AlmanacFormPreview({ date }) {
  const info = lunarPreviewForDate(date);
  if (!info) return null;
  return <div className="almanac-form-preview span-two"><div><Sparkle size={20} weight="fill" /><span><strong>{info.lunarDate}</strong><small>{info.lunarYear} · {info.dayOfficer}</small></span></div><p><em>宜</em>{info.yi.slice(0, 6).join("、") || "无特别条目"}</p><p><em>忌</em>{info.ji.slice(0, 6).join("、") || "无特别条目"}</p><small>传统民俗参考；现实安全、天气、健康、法律和家人安排优先。</small></div>;
}

function QuickRecordModal({ open, onClose, onSave, initialRecord, defaultKind = "account", defaultDate = "", relatedProject = "" }) {
  const isMobile = useIsMobile();
  const swipe = useSwipeDownToClose(onClose);
  const newCustomField = () => ({ id: `field-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, label: "", value: "" });
  const createEmptyForm = (kind = defaultKind) => ({
    ...FORM_DEFAULTS,
    kind,
    dueDate: defaultDate,
    project: relatedProject,
    status: defaultStatusForKind(kind),
    customFields: kind === "custom" ? [newCustomField()] : [],
  });
  const [form, setForm] = useState(createEmptyForm);
  useEffect(() => {
    if (!open) return;
    setForm(initialRecord ? { ...createEmptyForm(initialRecord.kind), ...initialRecord, amount: initialRecord.amount ?? "", customFields: initialRecord.customFields || [] } : createEmptyForm(defaultKind));
  // Reset the editor only when it is opened for another record/context.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialRecord?.id, defaultKind, defaultDate, relatedProject]);
  const config = RECORD_FORM_CONFIG[form.kind] || RECORD_FORM_CONFIG.account;
  const primaryKeys = PRIMARY_FIELDS_BY_KIND[form.kind] || [];
  const primaryFields = config.fields.filter((field) => primaryKeys.includes(field.key));
  const extraFields = config.fields.filter((field) => !primaryKeys.includes(field.key));
  const changeKind = (kind) => setForm((current) => ({
    ...createEmptyForm(kind),
    title: current.title,
    dueDate: current.dueDate,
    dueTime: current.dueTime,
    project: current.project || relatedProject,
    customFields: kind === "custom" && !current.customFields.length ? [newCustomField()] : current.customFields,
  }));
  const addCustomField = () => setForm((current) => ({ ...current, customFields: [...current.customFields, newCustomField()] }));
  const updateCustomField = (id, key, value) => setForm((current) => ({ ...current, customFields: current.customFields.map((field) => field.id === id ? { ...field, [key]: value } : field) }));
  const removeCustomField = (id) => setForm((current) => ({ ...current, customFields: current.customFields.filter((field) => field.id !== id) }));
  const submit = (event) => {
    event.preventDefault();
    onSave({
      ...form,
      id: initialRecord?.id || `${form.kind}-${Date.now()}`,
      amount: form.amount ? Number(form.amount) : undefined,
      subtitle: form.subtitle || KIND_LABELS[form.kind],
      submittedAt: initialRecord?.submittedAt || (form.kind === "pending" ? new Date().toLocaleString("zh-CN", { hour12: false }) : undefined),
      customFields: form.customFields.filter((field) => field.label || field.value),
    });
  };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
          <motion.form className="record-modal glass-layer" initial={{ opacity: 0, y: 36, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 24, scale: 0.97 }} transition={{ type: "spring", stiffness: 280, damping: 26 }} onSubmit={submit} {...swipe}>
            <span className="sheet-handle" />
            <div className="modal-head"><div><p className="eyebrow">所有内容都可以随时修改</p><h2>{initialRecord ? "编辑记录" : `新增${KIND_LABELS[form.kind] || "记录"}`}</h2></div><button type="button" className="icon-button" onClick={onClose}><X size={22} /></button></div>
            <div className="form-grid">
              <div className="record-type-section span-two"><span>先选择记录类型</span><div className="record-type-chips">{Object.entries(KIND_LABELS).filter(([value]) => value !== "almanac").map(([value, label]) => { const Icon = kindIcons[value] || Database; return <button type="button" className={form.kind === value ? "active" : ""} key={value} onClick={() => changeKind(value)}><Icon size={18} /><span>{label}</span></button>; })}</div></div>
              <label className="span-two important-field"><span>{config.titleLabel}<em>必填</em></span><input required value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder={config.titlePlaceholder} autoFocus={!isMobile} /></label>
              <div className="form-type-helper span-two"><Sparkle size={17} /><span><strong>{KIND_LABELS[form.kind]}</strong><small>{config.helper}</small></span></div>
              <div className="form-section-label span-two"><strong>{form.kind === "custom" ? "你的自定义内容" : "关键内容"}</strong><small>{form.kind === "custom" ? "名称和内容都可自由增删" : "按实际填写顺序排列"}</small></div>
              {form.kind === "custom" ? <div className="custom-fields-section custom-fields-section--primary span-two">{form.customFields.map((field) => <div className="custom-field-row" key={field.id}><input value={field.label} onChange={(event) => updateCustomField(field.id, "label", event.target.value)} placeholder="选项名称，例如：联系人" /><input value={field.value} onChange={(event) => updateCustomField(field.id, "value", event.target.value)} placeholder="填写内容" /><button type="button" onClick={() => removeCustomField(field.id)} aria-label="删除自定义字段"><X size={17} /></button></div>)}
                <button type="button" className="add-field-button" onClick={addCustomField}><Plus size={16} />再添加一个自定义选项</button>
              </div> : null}
              {primaryFields.map((field) => <RecordFormField key={`${form.kind}-${field.key}`} field={field} form={form} setForm={setForm} />)}
              {form.kind === "almanac" && form.dueDate ? <AlmanacFormPreview date={form.dueDate} /> : null}
              {extraFields.length ? <details className="more-form-fields span-two"><summary><span><Plus size={16} />更多可选信息</span><small>{extraFields.length} 项</small></summary><div className="form-grid">{extraFields.map((field) => <RecordFormField key={`${form.kind}-${field.key}`} field={field} form={form} setForm={setForm} />)}</div></details> : null}
              {form.kind !== "custom" ? <div className="custom-fields-section span-two">{form.customFields.map((field) => <div className="custom-field-row" key={field.id}><input value={field.label} onChange={(event) => updateCustomField(field.id, "label", event.target.value)} placeholder="自定义名称" /><input value={field.value} onChange={(event) => updateCustomField(field.id, "value", event.target.value)} placeholder="内容" /><button type="button" onClick={() => removeCustomField(field.id)} aria-label="删除自定义字段"><X size={17} /></button></div>)}
                <button type="button" className="add-field-button" onClick={addCustomField}><Plus size={16} />没有合适字段？增加自定义内容</button>
              </div> : null}
            </div>
            <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>取消</button><LiquidButton type="submit" icon={initialRecord ? Check : Plus}>{initialRecord ? "保存修改" : "保存记录"}</LiquidButton></div>
          </motion.form>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function LockScreen({ config, biometric, onPasswordUnlock, onBiometricUnlock }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async (task) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try { await task(); } catch (reason) { setError(String(reason?.message || reason)); } finally { setBusy(false); }
  };
  return <div className="lock-screen">
    <div className="background-image" />
    <motion.form className="lock-card glass-layer" initial={{ opacity: 0, y: 28, scale: .96 }} animate={{ opacity: 1, y: 0, scale: 1 }} onSubmit={(event) => { event.preventDefault(); run(() => onPasswordUnlock(password)); }}>
      <span className="lock-emblem"><LockKey size={38} weight="duotone" /></span>
      <p className="eyebrow">本地 AES‑256 保险箱</p>
      <h1>欢迎回到小黄提醒管家</h1>
      <p>资料只在这台设备解密。解锁密码不会发送到任何服务器。</p>
      <label><span>本地密码</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoFocus placeholder="输入本地解锁密码" /></label>
      {error ? <div className="lock-error">{error}</div> : null}
      <LiquidButton type="submit" icon={LockKey} disabled={busy}>解锁保险箱</LiquidButton>
      {config.biometricEnabled && biometric.isAvailable ? <button type="button" className="biometric-button" onClick={() => run(onBiometricUnlock)}><ShieldCheck size={21} />使用 {biometric.label} 解锁</button> : null}
      <small>忘记密码时，只能通过你之前导出的加密备份恢复。</small>
    </motion.form>
  </div>;
}

export function App() {
  const reduceMotion = useReducedMotion();
  const isMobile = useIsMobile();
  const shellRef = useRef(null);
  const initializedRef = useRef(false);
  const [records, setRecords] = useState([]);
  const [bootState, setBootState] = useState("loading");
  const [lockConfig, setLockConfig] = useState(null);
  const [sessionKey, setSessionKey] = useState(null);
  const [biometric, setBiometric] = useState({ isAvailable: false, label: "Touch ID / Face ID" });
  const [cloudEnabled, setCloudEnabled] = useState(() => localStorage.getItem(ICLOUD_CONFIG_KEY) === "enabled");
  const [activeKind, setActiveKind] = useState("overview");
  const [selected, setSelected] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [createContext, setCreateContext] = useState({ kind: "account", date: "", project: "" });
  const [almanacDate, setAlmanacDate] = useState(localDateKey(new Date()));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState("");
  const [handledAnimation, setHandledAnimation] = useState(false);
  const [mobileChromeHidden, setMobileChromeHidden] = useMobileChromeAutoHide(isMobile, quickOpen || drawerOpen || settingsOpen);

  useEffect(() => {
    if (!isMobile) return;
    setMobileChromeHidden(false);
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [activeKind, isMobile, setMobileChromeHidden]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const status = await biometricStatus().catch(() => ({ isAvailable: false, label: "Touch ID / Face ID" }));
      if (!cancelled) setBiometric(status);
      let loaded = loadRecords();
      let config = null;
      try { config = JSON.parse(localStorage.getItem(LOCK_CONFIG_KEY) || "null"); } catch { config = null; }
      if (config && localStorage.getItem(VAULT_KEY)) {
        if (!cancelled) { setLockConfig(config); setBootState("locked"); }
        initializedRef.current = true;
        return;
      }
      if (localStorage.getItem(ICLOUD_CONFIG_KEY) === "enabled") {
        try {
          const password = await readDeviceSecret(ICLOUD_PASSWORD_KEY);
          const remote = await readICloud();
          if (remote) loaded = mergeRecords(loaded, (await decryptBackup(remote, password)).records);
        } catch { /* Local data remains available if iCloud or Keychain is unavailable. */ }
      }
      loaded = loaded.filter((record) => !LEGACY_DEMO_IDS.has(record.id));
      if (!cancelled) {
        setRecords(loaded);
        setSelected(null);
        setDrawerOpen(false);
        setBootState("ready");
      }
      initializedRef.current = true;
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!initializedRef.current || bootState !== "ready") return undefined;
    let cancelled = false;
    const persist = async () => {
      if (lockConfig && sessionKey) {
        const encrypted = await encryptLocalVault(records, sessionKey);
        if (!cancelled) {
          localStorage.setItem(VAULT_KEY, JSON.stringify(encrypted));
          localStorage.removeItem(STORAGE_KEY);
        }
      } else if (!lockConfig) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
      }
    };
    persist().catch(() => showToast("本地加密保存失败，请立即导出备份"));
    return () => { cancelled = true; };
  }, [records, lockConfig, sessionKey, bootState]);

  useEffect(() => {
    if (!selected) return;
    const fresh = records.find((record) => record.id === selected.id && !record.deletedAt);
    if (fresh) setSelected(fresh);
    else { setSelected(null); setDrawerOpen(false); }
  }, [records, selected?.id]);

  const visibleRecords = useMemo(() => records.filter((record) => !record.deletedAt), [records]);
  const renewals = useMemo(() => visibleRecords.filter((record) => record.kind === "renewal" && record.status !== "handled").sort((a, b) => String(a.dueDate || "9999").localeCompare(String(b.dueDate || "9999"))), [visibleRecords]);
  const pending = useMemo(() => visibleRecords.filter((record) => record.kind === "pending" && record.status !== "handled"), [visibleRecords]);
  const filteredRenewals = renewals.filter((record) => `${record.title || ""} ${record.subtitle || ""}`.toLowerCase().includes(query.toLowerCase()));
  const filteredPending = pending.filter((record) => `${record.title || ""} ${record.subtitle || ""}`.toLowerCase().includes(query.toLowerCase()));
  const notificationCount = visibleRecords.filter((record) => record.dueDate && record.status !== "handled").length;

  const showToast = (message) => {
    setToast(message);
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => setToast(""), 2800);
  };

  const handlePointerMove = (event) => {
    if (reduceMotion || isMobile || !shellRef.current) return;
    const rect = shellRef.current.getBoundingClientRect();
    shellRef.current.style.setProperty("--cursor-x", `${event.clientX - rect.left}px`);
    shellRef.current.style.setProperty("--cursor-y", `${event.clientY - rect.top}px`);
  };

  const openDetail = (record) => {
    setSelected(record);
    setDrawerOpen(true);
  };

  const openCreate = (kind = "account", date = "", project = "") => {
    setEditingRecord(null);
    setCreateContext({ kind, date, project });
    setQuickOpen(true);
  };

  const openAlmanac = (date = localDateKey(new Date())) => {
    setAlmanacDate(date);
    setActiveKind("almanac");
  };

  const openEdit = (record) => {
    setEditingRecord(record);
    setCreateContext({ kind: record.kind, date: record.dueDate || "", project: record.project || "" });
    setQuickOpen(true);
  };

  const addRelated = (projectRecord) => {
    setDrawerOpen(false);
    openCreate("account", "", recordTitle(projectRecord));
  };

  const markHandled = (id) => {
    setHandledAnimation(true);
    window.setTimeout(() => {
      const updatedAt = new Date().toISOString();
      setRecords((current) => current.map((record) => record.id === id ? { ...record, status: "handled", updatedAt } : record));
      setHandledAnimation(false);
      showToast("已标记为处理完成");
    }, reduceMotion ? 0 : 620);
  };

  const deleteRecord = (id) => {
    const deletedAt = new Date().toISOString();
    setRecords((current) => current.map((record) => record.id === id ? { ...record, deletedAt, updatedAt: deletedAt } : record));
    setDrawerOpen(false);
    setSelected(null);
    showToast("记录已删除");
  };

  const saveRecord = (record) => {
    const now = new Date().toISOString();
    const existing = records.find((item) => item.id === record.id);
    const stamped = { ...existing, ...record, createdAt: existing?.createdAt || now, updatedAt: now, deletedAt: null };
    setRecords((current) => existing ? current.map((item) => item.id === stamped.id ? stamped : item) : [stamped, ...current]);
    setEditingRecord(null);
    setQuickOpen(false);
    setSelected(stamped);
    setDrawerOpen(true);
    showToast(existing ? "修改已保存" : "新记录已保存到本地");
  };

  const mergeIncoming = (incoming) => setRecords((current) => mergeRecords(current, incoming.filter((record) => !LEGACY_DEMO_IDS.has(record.id))));

  const enableLock = async (password) => {
    const result = await createLocalVault(records, password);
    localStorage.setItem(LOCK_CONFIG_KEY, JSON.stringify(result.config));
    localStorage.setItem(VAULT_KEY, JSON.stringify(result.vault));
    localStorage.removeItem(STORAGE_KEY);
    setLockConfig(result.config);
    setSessionKey(result.dataKey);
  };

  const disableLock = async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    localStorage.removeItem(LOCK_CONFIG_KEY);
    localStorage.removeItem(VAULT_KEY);
    await deleteDeviceSecret(BIOMETRIC_KEY).catch(() => {});
    setLockConfig(null);
    setSessionKey(null);
    showToast("本地保险箱已关闭，资料仍保存在本机");
  };

  const unlockWithPassword = async (password) => {
    const config = JSON.parse(localStorage.getItem(LOCK_CONFIG_KEY));
    const vault = JSON.parse(localStorage.getItem(VAULT_KEY));
    const unlocked = await unlockLocalVault(config, vault, password);
    setRecords(unlocked.records.filter((record) => !LEGACY_DEMO_IDS.has(record.id)));
    setSessionKey(unlocked.dataKey);
    setLockConfig(config);
    setSelected(null);
    setBootState("ready");
  };

  const unlockWithBiometric = async () => {
    await authenticateBiometric();
    const key = await readDeviceSecret(BIOMETRIC_KEY);
    const vault = JSON.parse(localStorage.getItem(VAULT_KEY));
    const unlocked = await unlockLocalVaultWithKey(vault, key);
    setRecords(unlocked.records.filter((record) => !LEGACY_DEMO_IDS.has(record.id)));
    setSessionKey(unlocked.dataKey);
    setSelected(null);
    setBootState("ready");
  };

  const toggleBiometric = async () => {
    if (!lockConfig || !sessionKey) return;
    if (lockConfig.biometricEnabled) {
      await deleteDeviceSecret(BIOMETRIC_KEY);
      const next = { ...lockConfig, biometricEnabled: false };
      localStorage.setItem(LOCK_CONFIG_KEY, JSON.stringify(next));
      setLockConfig(next);
      showToast("生物识别解锁已关闭");
      return;
    }
    const status = await biometricStatus();
    setBiometric(status);
    if (!status.isAvailable) throw new Error("这台设备尚未设置可用的 Touch ID 或 Face ID");
    await authenticateBiometric("允许小黄提醒管家启用快速解锁");
    await saveDeviceSecret(BIOMETRIC_KEY, sessionKey);
    const next = { ...lockConfig, biometricEnabled: true };
    localStorage.setItem(LOCK_CONFIG_KEY, JSON.stringify(next));
    setLockConfig(next);
    showToast(`${status.label} 解锁已开启`);
  };

  const cloudUpload = async (passwordOverride) => {
    const password = passwordOverride || await readDeviceSecret(ICLOUD_PASSWORD_KEY);
    const encrypted = await createEncryptedBackup(records, password, { includeSecrets: true });
    await writeICloud(encrypted);
    await synchronizeICloud();
    showToast("加密资料已写入你的 iCloud");
  };

  const cloudDownload = async () => {
    const password = await readDeviceSecret(ICLOUD_PASSWORD_KEY);
    const encrypted = await readICloud();
    if (!encrypted) throw new Error("你的 iCloud 中还没有小黄提醒管家同步数据");
    const payload = await decryptBackup(encrypted, password);
    mergeIncoming(payload.records);
    showToast(`已从 iCloud 合并 ${payload.records.length} 条记录`);
  };

  const enableCloud = async (password) => {
    if (!password) throw new Error("请设置 iCloud 端到端同步密码");
    await saveDeviceSecret(ICLOUD_PASSWORD_KEY, password);
    localStorage.setItem(ICLOUD_CONFIG_KEY, "enabled");
    setCloudEnabled(true);
    await cloudUpload(password);
  };

  const disableCloud = async () => {
    localStorage.removeItem(ICLOUD_CONFIG_KEY);
    await deleteDeviceSecret(ICLOUD_PASSWORD_KEY).catch(() => {});
    setCloudEnabled(false);
    showToast("iCloud 自动同步已关闭，云端密文未被删除");
  };

  useEffect(() => {
    if (!cloudEnabled || bootState !== "ready" || !records.length) return undefined;
    const timer = window.setTimeout(() => cloudUpload().catch(() => {}), 1800);
    return () => window.clearTimeout(timer);
  // cloudUpload changes with the record set and is intentionally represented by records.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records, cloudEnabled, bootState]);

  useEffect(() => {
    if (!cloudEnabled || bootState !== "ready") return undefined;
    const timer = window.setInterval(() => cloudDownload().catch(() => {}), 60_000);
    return () => window.clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloudEnabled, bootState]);

  const requestNotifications = async () => {
    try {
      if (isTauri()) {
        const granted = await isPermissionGranted() || await requestPermission() === "granted";
        if (!granted) {
          await openNotificationSettings();
          return showToast("已打开系统通知设置，请允许小黄提醒管家发送通知");
        }
        const scheduled = await scheduleRenewalReminders(visibleRecords);
        await sendNotification({ title: "小黄提醒已开启", body: `已安排 ${scheduled} 条提醒，关键日期不会再错过。` });
        return showToast(`已开启系统通知并安排 ${scheduled} 条提醒`);
      }
      if (!("Notification" in window)) return showToast("当前浏览器不支持系统通知");
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        new Notification("小黄提醒已开启", { body: "到期、待办与等待结果会在这里提醒你。", icon: "/assets/app-icon-flat.png" });
        showToast("通知提醒已开启");
      } else showToast("你可以稍后在浏览器设置中开启通知");
    } catch {
      if (isTauri()) {
        try {
          await openNotificationSettings();
          return showToast("提醒未能开启，已为你打开系统通知设置");
        } catch {
          return showToast("无法打开通知设置，请在系统设置中选择小黄提醒管家");
        }
      }
      showToast("提醒设置失败，请检查浏览器通知权限");
    }
  };

  if (bootState === "loading") return <div className="lock-screen"><div className="background-image" /><div className="boot-mark"><img src="/assets/app-icon-flat.png?v=052" alt="小黄提醒管家" /><span>正在打开本地资料…</span></div></div>;
  if (bootState === "locked") return <LockScreen config={lockConfig} biometric={biometric} onPasswordUnlock={unlockWithPassword} onBiometricUnlock={unlockWithBiometric} />;

  return (
    <div ref={shellRef} className={`app-shell ${drawerOpen && selected ? "drawer-visible" : ""} ${mobileChromeHidden ? "mobile-chrome-hidden" : ""}`} onPointerMove={handlePointerMove}>
      <div className="background-image" />
      <div className="cursor-aura" />
      <Sidebar activeKind={activeKind} onNavigate={setActiveKind} onQuickAdd={() => openCreate()} onSettings={() => setSettingsOpen(true)} />
      <main className="main-content">
        <Topbar query={query} setQuery={setQuery} onQuickAdd={() => openCreate()} onNotifications={requestNotifications} lockEnabled={Boolean(lockConfig)} cloudEnabled={cloudEnabled} notificationCount={notificationCount} />
        <AnimatePresence mode="wait">
          {activeKind === "overview" ? (
            <motion.div className="overview" key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <CinematicCalendar records={visibleRecords} onOpen={openDetail} onAdd={openCreate} onViewAlmanac={openAlmanac} />
              <UpcomingTasks records={visibleRecords} onOpen={openDetail} onViewAll={() => setActiveKind("pending")} onAdd={openCreate} />
            </motion.div>
          ) : activeKind === "hub" ? (
            <OverviewHub key="hub" records={visibleRecords} onNavigate={setActiveKind} />
          ) : activeKind === "almanac" ? (
            <AlmanacView key="almanac" date={almanacDate} onDateChange={setAlmanacDate} records={visibleRecords} onOpen={openDetail} onAdd={openCreate} />
          ) : (
            <CollectionView key={activeKind} kind={activeKind} records={visibleRecords} query={query} onSelect={openDetail} onQuickAdd={openCreate} />
          )}
        </AnimatePresence>
        <footer><ShieldCheck size={17} />本地优先 · {lockConfig ? "保险箱已加密" : "未开启本地密码"} · {cloudEnabled ? "iCloud 密文同步已开启" : "无服务器账户"}</footer>
      </main>
      <AnimatePresence>{drawerOpen && selected ? <DetailDrawer record={selected} onClose={() => setDrawerOpen(false)} onHandled={markHandled} onDelete={deleteRecord} onEdit={openEdit} onAddRelated={addRelated} handledAnimation={handledAnimation} /> : null}</AnimatePresence>
      <MobileNav activeKind={activeKind} onNavigate={setActiveKind} onAdd={() => openCreate("pending")} onSettings={() => setSettingsOpen(true)} settingsOpen={settingsOpen} />
      <QuickRecordModal open={quickOpen} onClose={() => { setQuickOpen(false); setEditingRecord(null); }} onSave={saveRecord} initialRecord={editingRecord} defaultKind={createContext.kind} defaultDate={createContext.date} relatedProject={createContext.project} />
      <SecurityCenter
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        records={records}
        onMerge={mergeIncoming}
        onReset={() => { if (window.confirm("确定清空本机全部记录吗？此操作无法撤销。")) { setRecords([]); setSelected(null); setDrawerOpen(false); showToast("本机记录已清空"); } }}
        lockConfig={lockConfig}
        onEnableLock={enableLock}
        onDisableLock={disableLock}
        onLockNow={() => { setSessionKey(null); setSettingsOpen(false); setDrawerOpen(false); setBootState("locked"); }}
        biometric={biometric}
        onToggleBiometric={toggleBiometric}
        cloudEnabled={cloudEnabled}
        onEnableCloud={enableCloud}
        onDisableCloud={disableCloud}
        onCloudUpload={cloudUpload}
        onCloudDownload={cloudDownload}
        notify={showToast}
      />
      <AnimatePresence>{toast ? <motion.div className="toast glass-layer" initial={{ opacity: 0, y: 24, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12 }}><CheckCircle size={20} weight="fill" />{toast}</motion.div> : null}</AnimatePresence>
    </div>
  );
}
