/**
 * 全局提醒调度与巡检引擎
 * 自动接管应用启动、记录增删改、前台定时轮询与系统级通知
 */

import { invoke, isTauri } from "@tauri-apps/api/core";
import {
  cancelAll,
  isPermissionGranted,
  requestPermission,
  Schedule,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { getRemainingDays, parseDateString } from "./cycleUtils.js";

// 默认支持的提醒时间规则（提前天数）
export const PRESET_REMINDER_OPTIONS = [
  { days: 0, label: "当天", text: "当天到期" },
  { days: 1, label: "提前 1 天", text: "提前 1 天" },
  { days: 3, label: "提前 3 天", text: "提前 3 天" },
  { days: 7, label: "提前 7 天", text: "提前 7 天" },
  { days: 15, label: "提前 15 天", text: "提前 15 天" },
  { days: 30, label: "提前 30 天", text: "提前 30 天" },
];

/**
 * 解析记录中的提醒规则为天数数组
 * 兼顾历史自由文本和新版数组格式
 */
export function parseReminderDays(remindersField) {
  if (Array.isArray(remindersField)) {
    return remindersField.map(Number).filter((d) => !isNaN(d));
  }
  if (typeof remindersField === "string" && remindersField.trim()) {
    const numbers = remindersField.match(/\d+/g);
    if (numbers && numbers.length) {
      return [...new Set(numbers.map(Number))];
    }
  }
  // 默认：提前 7 天、3 天、1 天、当天
  return [7, 3, 1, 0];
}

/**
 * 生成稳定的 32 位数字提醒 ID（Tauri 与原生通知要求整数）
 */
export function generateReminderId(recordId, daysBefore) {
  const seed = `${recordId}_${daysBefore}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash || daysBefore + 1);
}

/**
 * 申请系统通知权限
 */
export async function ensureNotificationPermission() {
  if (isTauri()) {
    try {
      const isMac = /Macintosh/i.test(navigator.userAgent);
      if (isMac) {
        // 调用 Rust 端申请 UNUserNotificationCenter 授权
        await invoke("request_macos_notification_permission").catch(() => {});
      }
      const granted = (await isPermissionGranted()) || (await requestPermission()) === "granted";
      return granted;
    } catch {
      return false;
    }
  }

  if (typeof window !== "undefined" && "Notification" in window) {
    if (Notification.permission === "granted") return true;
    if (Notification.permission !== "denied") {
      const perm = await Notification.requestPermission();
      return perm === "granted";
    }
  }
  return false;
}

/**
 * 全自动提醒调度：计算所有有效记录的提醒时间点并注册到系统
 * @param {Array} records
 * @returns {Promise<number>} 成功调度的提醒数量
 */
export async function syncSystemReminders(records) {
  if (!Array.isArray(records)) return 0;
  const isMac = typeof navigator !== "undefined" && /Macintosh/i.test(navigator.userAgent);
  const isMobileTauri = isTauri() && !isMac;
  const now = new Date();
  let scheduledCount = 0;

  const macReminders = [];

  // 如果是在 iOS 原生应用中，先清空先前的待触发提醒，防止重复堆叠
  if (isMobileTauri) {
    await cancelAll().catch(() => {});
  }

  for (const record of records) {
    // 已完成或已取消的不安排未来提醒
    if (!record.dueDate || record.status === "handled" || record.status === "cancelled" || record.status === "archived") {
      continue;
    }

    const reminderDays = parseReminderDays(record.reminders);
    const title = record.title || "提醒事项";
    const timeStr = record.dueTime || "09:00";

    for (const daysBefore of reminderDays) {
      const remindDate = new Date(`${record.dueDate}T${timeStr}:00`);
      remindDate.setDate(remindDate.getDate() - daysBefore);

      // 如果提醒时间已经过去，跳过
      if (remindDate.getTime() <= now.getTime()) continue;

      const notifId = generateReminderId(record.id, daysBefore);
      const alertTitle = daysBefore === 0
        ? `【今日到期】${title}`
        : `【即将到期】${title} 将在 ${daysBefore} 天后到期`;
      
      const alertBody = [
        record.amount ? `金额：¥${record.amount}` : "",
        record.cycle ? `周期：${record.cycle}` : "",
        record.subtitle || record.notes || "点击查看详情并处理",
      ].filter(Boolean).join(" · ");

      if (isTauri() && isMac) {
        macReminders.push({
          id: String(notifId),
          title: alertTitle,
          body: alertBody,
          year: remindDate.getFullYear(),
          month: remindDate.getMonth() + 1,
          day: remindDate.getDate(),
          hour: remindDate.getHours(),
          minute: remindDate.getMinutes(),
        });
      } else if (isMobileTauri) {
        // iPhone / iPad 原生通知排期：通过 UNUserNotificationCenter 后台定时唤醒系统弹窗
        try {
          await sendNotification({
            id: notifId,
            title: alertTitle,
            body: alertBody,
            sound: "default",
            schedule: Schedule.at(remindDate),
          });
        } catch (err) {
          console.warn("iOS 注册排期提醒失败:", err);
        }
      }
      scheduledCount += 1;
    }
  }

  if (isTauri() && isMac) {
    try {
      await invoke("schedule_macos_reminders", { reminders: macReminders });
    } catch (e) {
      console.warn("调度 macOS 原生提醒失败:", e);
    }
  }

  return scheduledCount;
}

/**
 * 实时获取需要紧急关注的记录（逾期、今天、3天内）
 * @param {Array} records
 */
export function getUrgentSummary(records) {
  if (!Array.isArray(records)) {
    return { overdue: [], today: [], upcoming: [], totalUrgentCount: 0 };
  }

  const overdue = [];
  const today = [];
  const upcoming = [];

  const activeRecords = records.filter(
    (r) => r.dueDate && r.status !== "handled" && r.status !== "cancelled" && r.status !== "archived"
  );

  for (const record of activeRecords) {
    const days = getRemainingDays(record.dueDate);
    if (days < 0) {
      overdue.push({ ...record, daysLeft: days });
    } else if (days === 0) {
      today.push({ ...record, daysLeft: 0 });
    } else if (days <= 3) {
      upcoming.push({ ...record, daysLeft: days });
    }
  }

  // 排序：逾期越久越靠前，今日排在前面，即将到期按天数升序
  overdue.sort((a, b) => a.daysLeft - b.daysLeft);
  upcoming.sort((a, b) => a.daysLeft - b.daysLeft);

  return {
    overdue,
    today,
    upcoming,
    totalUrgentCount: overdue.length + today.length + upcoming.length,
  };
}

/**
 * 播放清脆悦耳的双音提示铃声 (E5 -> A5)
 * 纯 Web Audio 原生合成，全平台（macOS、iOS、浏览器）无需外部音频文件即可即时发声
 */
export function playNotificationChime() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    // 音符 1: E5 (659.25 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0.35, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    // 音符 2: A5 (880 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(880, now + 0.12);
    gain2.gain.setValueAtTime(0.4, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.6);
  } catch (e) {
    // ignore
  }
}

/**
 * 立即发送一条前台/系统测试或触发通知
 */
export async function triggerImmediateNotification(title, body) {
  playNotificationChime();
  if (isTauri()) {
    try {
      await sendNotification({ title, body, sound: "default" });
      return true;
    } catch {
      // fallback
    }
  }
  if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
    new Notification(title, { body, icon: "/assets/app-icon-flat.png" });
    return true;
  }
  return false;
}
