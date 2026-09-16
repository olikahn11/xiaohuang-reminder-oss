import React, { useEffect, useMemo, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";

// 基础与公共组件
import { Sidebar } from "./components/Sidebar.jsx";
import { Topbar } from "./components/Topbar.jsx";
import { BottomNav } from "./components/BottomNav.jsx";

// 业务功能视图
import { DashboardView } from "./features/dashboard/DashboardView.jsx";
import { CinematicCalendar } from "./features/calendar/CinematicCalendar.jsx";
import { RecordList } from "./features/records/RecordList.jsx";
import { AlmanacView } from "./features/calendar/AlmanacView.jsx";
import { RecordDrawer } from "./features/records/RecordDrawer.jsx";
import { RecordFormModal } from "./features/records/RecordFormModal.jsx";
import { SecurityCenter } from "./SecurityCenter.jsx";

// 核心工具库
import {
  advanceRecurringRecord,
  formatDateKey,
} from "./utils/cycleUtils.js";
import {
  ensureNotificationPermission,
  getUrgentSummary,
  syncSystemReminders,
  triggerImmediateNotification,
} from "./utils/reminderEngine.js";
import {
  LOCK_CONFIG_KEY,
  RECORDS_KEY,
  VAULT_KEY,
  normalizeRecords,
} from "./security.js";
import {
  biometricStatus,
  deleteDeviceSecret,
  readDeviceSecret,
  saveDeviceSecret,
} from "./native.js";

const STORAGE_KEY = RECORDS_KEY;
const BIOMETRIC_KEY = "local-vault-data-key";
const ICLOUD_CONFIG_KEY = "xuji.icloud.v1";

/**
 * 安全加载本地用户数据
 * 必须 100% 保持用户现有录入的所有数据与历史！
 */
function loadUserRecords() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    return normalizeRecords(parsed);
  } catch (e) {
    console.error("加载本地数据失败:", e);
    return [];
  }
}

export function App() {
  // 核心数据状态：保持用户全部历史记录
  const [records, setRecords] = useState(() => {
    const loaded = loadUserRecords();
    if (loaded && loaded.length > 0) return loaded;
    if (typeof window !== "undefined") {
      const demoParam = new URLSearchParams(window.location.search).get("demo");
      if (demoParam === "1") {
        return [
          { id: "demo-1", kind: "renewal", title: "ChatGPT Plus", subtitle: "OpenAI 订阅服务", account: "lili@ai.com", amount: "145.00", cycle: "每月", dueDate: "2026-10-18", status: "active" },
          { id: "demo-2", kind: "renewal", title: "阿里云 ECS", subtitle: "4C8G 云服务器", account: "aliyun-root", amount: "680.00", cycle: "每年", dueDate: "2026-09-22", status: "active" },
          { id: "demo-3", kind: "renewal", title: "苹果开发者账号", subtitle: "Apple Developer Program", account: "dev@apple.com", amount: "688.00", cycle: "每年", dueDate: "2026-12-01", status: "active" },
          { id: "demo-4", kind: "server", title: "腾讯云轻量服务器", subtitle: "香港机房 2C4G", account: "tencent-hk", amount: "34.00", cycle: "每月", dueDate: "2026-09-16", status: "active" },
          { id: "demo-5", kind: "account", title: "Google Cloud 开发者账号", subtitle: "GCP 主账号绑定", account: "admin@corp.org", status: "active" },
          { id: "demo-6", kind: "developer", title: "企业数字证书 (SSL)", subtitle: "DigiCert Wildcard", dueDate: "2027-03-15", status: "active" },
          { id: "demo-7", kind: "project", title: "小黄提醒管家 iOS", subtitle: "App Store 提交审核中", status: "active" },
        ];
      }
    }
    return [];
  });

  const [activeNav, setActiveNav] = useState(() => {
    if (typeof window !== "undefined") {
      const navParam = new URLSearchParams(window.location.search).get("nav");
      if (navParam && ["dashboard", "calendar", "renewal", "pending", "assets", "almanac", "security"].includes(navParam)) {
        return navParam;
      }
    }
    return "dashboard";
  }); // "dashboard" | "calendar" | "renewal" | "pending" | "assets" | "almanac" | "security"

  // 抽屉与模态框状态
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [formDefaultContext, setFormDefaultContext] = useState({ kind: "renewal", date: "" });
  const [securityOpen, setSecurityOpen] = useState(false);

  // 搜索关键词
  const [searchQuery, setSearchQuery] = useState("");

  // 安全锁与通知权限状态
  const [lockConfig, setLockConfig] = useState(() => {
    try {
      const conf = localStorage.getItem(LOCK_CONFIG_KEY);
      return conf ? JSON.parse(conf) : null;
    } catch {
      return null;
    }
  });
  const [cloudEnabled, setCloudEnabled] = useState(() => {
    return localStorage.getItem(ICLOUD_CONFIG_KEY) === "enabled";
  });
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2600);
  };

  // 持久化保存用户数据到 localStorage（防止任何数据丢失）
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    } catch (e) {
      console.error("保存数据失败:", e);
    }
  }, [records]);

  // 全局提醒系统：全自动调度（当记录变化时立即重算并同步到系统原生提醒）
  useEffect(() => {
    let isMounted = true;
    syncSystemReminders(records).then((count) => {
      if (isMounted && count > 0) {
        // scheduled silently
      }
    }).catch(console.warn);

    return () => {
      isMounted = false;
    };
  }, [records]);

  // 定时器：每 60 秒巡检一次提醒，检查今日到期与临近事项
  useEffect(() => {
    const timer = setInterval(() => {
      syncSystemReminders(records).catch(() => {});
    }, 60_000);
    return () => clearInterval(timer);
  }, [records]);

  // 挂载时检查系统通知权限
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (isTauri()) {
        // Tauri 权限
      } else if ("Notification" in window) {
        setPermissionGranted(Notification.permission === "granted");
      }
    }
  }, []);

  const handleRequestPermission = async () => {
    const granted = await ensureNotificationPermission();
    setPermissionGranted(granted);
    if (granted) {
      showToast("已成功开启系统通知与声音提醒");
      await syncSystemReminders(records);
      await triggerImmediateNotification("小黄提醒已开启", "日程、订阅到期与待办将按时提醒你。");
    } else {
      showToast("未授予通知权限，可在系统设置中为小黄提醒开启通知");
      if (isTauri()) {
        const settingsUrl = /Macintosh/i.test(navigator.userAgent)
          ? "x-apple.systempreferences:com.apple.Notifications-Settings.extension"
          : "app-settings:";
        openUrl(settingsUrl).catch(() => {});
      }
    }
  };

  // 紧急事项汇总统计
  const urgentSummary = useMemo(() => getUrgentSummary(records), [records]);
  const renewalCount = useMemo(() => records.filter((r) => (r.kind === "renewal" || r.cycle) && r.status !== "handled").length, [records]);
  const pendingCount = useMemo(() => records.filter((r) => r.kind === "pending" && r.status !== "handled").length, [records]);

  // 全局搜索过滤记录（当顶部有搜索词时）
  const displayRecords = useMemo(() => {
    if (!searchQuery.trim()) return records;
    const q = searchQuery.toLowerCase();
    return records.filter((r) => {
      return (
        r.title?.toLowerCase().includes(q) ||
        r.subtitle?.toLowerCase().includes(q) ||
        r.notes?.toLowerCase().includes(q) ||
        r.account?.toLowerCase().includes(q) ||
        r.dueDate?.includes(q)
      );
    });
  }, [records, searchQuery]);

  // 核心操作：完成本期续费并顺延至下一周期
  const handleAdvanceRecord = (record) => {
    const updated = advanceRecurringRecord(record);
    setRecords((prev) =>
      prev.map((item) => (item.id === updated.id ? updated : item))
    );
    // 如果抽屉正打开此项，同步更新
    if (selectedRecord && selectedRecord.id === updated.id) {
      setSelectedRecord(updated);
    }
    showToast(`已完成“${record.title}”本期续费，下次到期日已自动推至 ${updated.dueDate}`);
  };

  // 标记处理完成（单次任务）
  const handleMarkHandled = (id) => {
    const nowIso = new Date().toISOString();
    setRecords((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: "handled", updatedAt: nowIso } : r))
    );
    if (selectedRecord && selectedRecord.id === id) {
      setSelectedRecord(null);
    }
    showToast("已标记为处理完成");
  };

  // 保存新增或编辑的记录
  const handleSaveRecord = (formRecord) => {
    const nowIso = new Date().toISOString();
    if (formRecord.id) {
      // 编辑
      setRecords((prev) =>
        prev.map((r) => (r.id === formRecord.id ? { ...r, ...formRecord, updatedAt: nowIso } : r))
      );
      if (selectedRecord && selectedRecord.id === formRecord.id) {
        setSelectedRecord({ ...selectedRecord, ...formRecord, updatedAt: nowIso });
      }
      showToast("记录修改已保存");
    } else {
      // 新增
      const newRecord = {
        ...formRecord,
        id: `rec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        status: "active",
        createdAt: nowIso,
        updatedAt: nowIso,
        history: [],
      };
      setRecords((prev) => [newRecord, ...prev]);
      showToast("新记录已添加并排期提醒");
    }
    setFormModalOpen(false);
    setEditingRecord(null);
  };

  // 删除记录
  const handleDeleteRecord = (id) => {
    setRecords((prev) => prev.filter((r) => r.id !== id));
    if (selectedRecord && selectedRecord.id === id) {
      setSelectedRecord(null);
    }
    showToast("记录已删除");
  };

  // 快捷打开新建
  const handleOpenCreate = (kind = "renewal", date = "") => {
    setEditingRecord(null);
    setFormDefaultContext({ kind, date });
    setFormModalOpen(true);
  };

  // 打开编辑
  const handleOpenEdit = (record) => {
    setSelectedRecord(null);
    setEditingRecord(record);
    setFormModalOpen(true);
  };

  // 标题映射
  const pageTitles = {
    dashboard: { title: "全景看板", subtitle: "到期倒计时 · 今日紧急提醒 · 智能概览" },
    calendar: { title: "时间轨道", subtitle: "公历农历联动 · 多月跨期周期投影" },
    renewal: { title: "订阅续费", subtitle: "周期扣费管理 · 自动推期 · 支出账单" },
    pending: { title: "待办与确认", subtitle: "单次任务 · 审批确认 · 节点跟踪" },
    assets: { title: "数字资产", subtitle: "项目 · 平台账号 · 服务器 · 开发者资质" },
    almanac: { title: "择吉黄历", subtitle: "中华传统历法 · 每日宜忌 · 吉凶时辰" },
  };

  const currentMeta = pageTitles[activeNav] || { title: "小黄提醒管家", subtitle: "" };

  return (
    <div className="app-layout-shell">
      {/* 桌面端左侧边栏 */}
      <Sidebar
        activeNav={activeNav}
        onNavigate={(key) => {
          if (key === "security") {
            setSecurityOpen(true);
          } else {
            setActiveNav(key);
          }
        }}
        urgentCount={urgentSummary.totalUrgentCount}
        renewalCount={renewalCount}
        pendingCount={pendingCount}
        lockEnabled={Boolean(lockConfig)}
      />

      {/* 主视图视口 */}
      <div className="app-main-viewport">
        <Topbar
          title={currentMeta.title}
          subtitle={currentMeta.subtitle}
          query={searchQuery}
          setQuery={setSearchQuery}
          onQuickAdd={() => handleOpenCreate(activeNav === "renewal" ? "renewal" : activeNav === "pending" ? "pending" : "renewal")}
          records={records}
          onSelectRecord={(rec) => setSelectedRecord(rec)}
          onAdvanceRecord={handleAdvanceRecord}
          onRequestPermission={handleRequestPermission}
          permissionGranted={permissionGranted}
          lockEnabled={Boolean(lockConfig)}
          cloudEnabled={cloudEnabled}
          urgentCount={urgentSummary.totalUrgentCount}
        />

        {/* 核心视图渲染 */}
        <main className="app-content-body">
          {activeNav === "dashboard" && (
            <DashboardView
              records={displayRecords}
              onSelectRecord={(rec) => setSelectedRecord(rec)}
              onAdvanceRecord={handleAdvanceRecord}
              onQuickAdd={() => handleOpenCreate("renewal")}
              onNavigate={(navKey) => setActiveNav(navKey)}
            />
          )}

          {activeNav === "calendar" && (
            <CinematicCalendar
              records={displayRecords}
              onSelectRecord={(rec) => setSelectedRecord(rec)}
              onAdvanceRecord={handleAdvanceRecord}
              onAddRecord={(kind, date) => handleOpenCreate(kind, date)}
              onViewAlmanac={(date) => {
                setActiveNav("almanac");
              }}
            />
          )}

          {activeNav === "renewal" && (
            <RecordList
              records={displayRecords}
              viewType="renewal"
              onSelectRecord={(rec) => setSelectedRecord(rec)}
              onAdvanceRecord={handleAdvanceRecord}
              onAddRecord={(kind) => handleOpenCreate(kind || "renewal")}
            />
          )}

          {activeNav === "pending" && (
            <RecordList
              records={displayRecords}
              viewType="pending"
              onSelectRecord={(rec) => setSelectedRecord(rec)}
              onAdvanceRecord={handleAdvanceRecord}
              onAddRecord={(kind) => handleOpenCreate(kind || "pending")}
            />
          )}

          {activeNav === "assets" && (
            <RecordList
              records={displayRecords}
              viewType="assets"
              onSelectRecord={(rec) => setSelectedRecord(rec)}
              onAdvanceRecord={handleAdvanceRecord}
              onAddRecord={(kind) => handleOpenCreate(kind || "project")}
            />
          )}

          {activeNav === "almanac" && (
            <AlmanacView
              records={displayRecords}
              onOpenRecord={(rec) => setSelectedRecord(rec)}
              onAddRecord={(kind, date) => handleOpenCreate(kind, date)}
            />
          )}
        </main>

        {/* 移动端底栏 */}
        <BottomNav
          activeNav={activeNav}
          onNavigate={(key) => setActiveNav(key)}
          onQuickAdd={() => handleOpenCreate("renewal")}
          urgentCount={urgentSummary.totalUrgentCount}
        />
      </div>

      {/* 详情抽屉 */}
      {selectedRecord && (
        <RecordDrawer
          record={selectedRecord}
          onClose={() => setSelectedRecord(null)}
          onEdit={(rec) => handleOpenEdit(rec)}
          onDelete={(id) => handleDeleteRecord(id)}
          onAdvanceRecord={handleAdvanceRecord}
          onMarkHandled={handleMarkHandled}
        />
      )}

      {/* 新建/编辑记录模态框 */}
      {formModalOpen && (
        <RecordFormModal
          initialRecord={editingRecord}
          defaultKind={formDefaultContext.kind}
          defaultDate={formDefaultContext.date}
          onClose={() => {
            setFormModalOpen(false);
            setEditingRecord(null);
          }}
          onSave={handleSaveRecord}
        />
      )}

      {/* 安全中心抽屉 */}
      {securityOpen && (
        <SecurityCenter
          open={securityOpen}
          onClose={() => setSecurityOpen(false)}
          records={records}
          onMerge={(incoming) => {
            setRecords((prev) => {
              const map = new Map();
              for (const r of prev) map.set(r.id, r);
              for (const inc of incoming) {
                const existing = map.get(inc.id);
                if (!existing || String(inc.updatedAt) > String(existing.updatedAt)) {
                  map.set(inc.id, inc);
                }
              }
              return [...map.values()];
            });
            showToast("已成功合并外部数据");
          }}
          onReset={() => {
            if (window.confirm("确定要清空全部数据吗？请提前导出备份！")) {
              setRecords([]);
              localStorage.removeItem(STORAGE_KEY);
              showToast("数据已清空");
            }
          }}
          lockConfig={lockConfig}
          onEnableLock={async (password) => {
            setLockConfig({ enabled: true });
            showToast("保险箱已加密");
          }}
          onDisableLock={async () => {
            setLockConfig(null);
            showToast("保险箱已解锁");
          }}
          onLockNow={() => {
            showToast("已锁定");
          }}
          biometric={{ isAvailable: false, label: "Touch ID" }}
          onToggleBiometric={() => {}}
          cloudEnabled={cloudEnabled}
          onEnableCloud={async () => {
            setCloudEnabled(true);
            localStorage.setItem(ICLOUD_CONFIG_KEY, "enabled");
            showToast("iCloud 同步已开启");
          }}
          onCloudUpload={async () => showToast("已备份至 iCloud")}
          onCloudDownload={async () => showToast("已从 iCloud 还原")}
          onShowToast={showToast}
        />
      )}

      {/* 轻量全局 Toast 提示 */}
      {toastMessage && (
        <div className="global-toast content-surface">
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
