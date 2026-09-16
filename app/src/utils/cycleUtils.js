/**
 * 周期推算与智能续费工具库
 * 全面支持：每月、每两个月、每季度(3个月)、每半年(6个月)、每年、每周以及任意自然周期推算
 */

// 标准化周期键名与预设
export const CYCLE_TYPES = {
  MONTHLY: "每月",
  BI_MONTHLY: "每两个月",
  QUARTERLY: "每季度",
  SEMI_ANNUALLY: "每半年",
  YEARLY: "每年",
  WEEKLY: "每周",
  ONCE: "一次性",
};

/**
 * 解析周期字符串为标准化的时间间隔对象
 * 智能识别：“每月”、“每两个月”、“每2个月”、“每季度”、“每半年”、“每年”、“每周”等
 * @param {string} cycleStr
 * @returns {{ type: 'month' | 'week' | 'day', count: number } | null}
 */
export function parseCycleInterval(cycleStr) {
  if (!cycleStr || typeof cycleStr !== "string") return null;
  const s = cycleStr.trim();
  if (s === "一次性" || s === "不设置" || s === "") return null;

  // 快捷常量匹配
  if (s === "每月" || s === "每1个月" || s === "按月" || s === "月付") {
    return { type: "month", count: 1 };
  }
  if (s === "每两个月" || s === "每2个月" || s === "每双月" || s === "双月") {
    return { type: "month", count: 2 };
  }
  if (s === "每季度" || s === "每3个月" || s === "按季度" || s === "季付" || s === "季度") {
    return { type: "month", count: 3 };
  }
  if (s === "每半年" || s === "每6个月" || s === "半年" || s === "半年付") {
    return { type: "month", count: 6 };
  }
  if (s === "每年" || s === "每1年" || s === "每12个月" || s === "按年" || s === "年付") {
    return { type: "month", count: 12 };
  }
  if (s === "每周" || s === "每1周" || s === "周付") {
    return { type: "week", count: 1 };
  }
  if (s === "每两周" || s === "每2周") {
    return { type: "week", count: 2 };
  }

  // 灵活正则匹配任意跨度
  const monthMatch = s.match(/每?\s*(\d+)\s*个?月/);
  if (monthMatch) {
    const c = parseInt(monthMatch[1], 10);
    if (c > 0) return { type: "month", count: c };
  }

  const weekMatch = s.match(/每?\s*(\d+)\s*周/);
  if (weekMatch) {
    const c = parseInt(weekMatch[1], 10);
    if (c > 0) return { type: "week", count: c };
  }

  const dayMatch = s.match(/每?\s*(\d+)\s*天/);
  if (dayMatch) {
    const c = parseInt(dayMatch[1], 10);
    if (c > 0) return { type: "day", count: c };
  }

  const yearMatch = s.match(/每?\s*(\d+)\s*年/);
  if (yearMatch) {
    const c = parseInt(yearMatch[1], 10);
    if (c > 0) return { type: "month", count: c * 12 };
  }

  return null;
}

/**
 * 解析 YYYY-MM-DD 为 UTC/本地安全日期部件
 */
export function parseDateString(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return null;
  const parts = dateStr.trim().split("-").map(Number);
  if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) return null;
  return { year: parts[0], month: parts[1], day: parts[2] };
}

/**
 * 格式化年月日为 YYYY-MM-DD
 */
export function formatDateKey(year, month, day) {
  const y = String(year);
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * 获取某年某月的总天数
 */
export function getDaysInMonth(year, month) {
  // month: 1-12
  return new Date(year, month, 0).getDate();
}

/**
 * 计算下一个周期的到期日
 * 精确处理月末边界（如 1月31日 无论每两月、每季度均能平滑处理并在31号月份恢复）
 * @param {string} currentDueDate "YYYY-MM-DD"
 * @param {string} cycle 如 "每月" | "每两个月" | "每季度" | "每半年" | "每年" 等
 * @param {number} [targetDay] 原始设定的每月几号（可选，防止月末坍塌后丢失原本的31号）
 * @returns {string} "YYYY-MM-DD"
 */
export function calculateNextDueDate(currentDueDate, cycle, targetDay = null) {
  const parsed = parseDateString(currentDueDate);
  const interval = parseCycleInterval(cycle);
  if (!parsed || !interval) {
    return currentDueDate;
  }

  const { year, month, day } = parsed;
  const originalDay = targetDay || day;

  if (interval.type === "month") {
    let nextYear = year;
    let nextMonth = month + interval.count;
    if (nextMonth > 12) {
      nextYear += Math.floor((nextMonth - 1) / 12);
      nextMonth = ((nextMonth - 1) % 12) + 1;
    }
    const maxDays = getDaysInMonth(nextYear, nextMonth);
    const nextDay = Math.min(originalDay, maxDays);
    return formatDateKey(nextYear, nextMonth, nextDay);
  }

  if (interval.type === "week") {
    const date = new Date(`${currentDueDate}T12:00:00`);
    date.setDate(date.getDate() + interval.count * 7);
    return formatDateKey(date.getFullYear(), date.getMonth() + 1, date.getDate());
  }

  if (interval.type === "day") {
    const date = new Date(`${currentDueDate}T12:00:00`);
    date.setDate(date.getDate() + interval.count);
    return formatDateKey(date.getFullYear(), date.getMonth() + 1, date.getDate());
  }

  return currentDueDate;
}

/**
 * 推进周期记录到下一期，并保留历史记录
 * @param {Object} record
 * @returns {Object} updatedRecord
 */
export function advanceRecurringRecord(record) {
  const interval = parseCycleInterval(record?.cycle);
  if (!record || !record.dueDate || !interval) {
    // 非周期性记录，标记为已处理
    return {
      ...record,
      status: "handled",
      updatedAt: new Date().toISOString(),
    };
  }

  const nextDueDate = calculateNextDueDate(
    record.dueDate,
    record.cycle,
    record.cycleAnchorDay || parseDateString(record.dueDate)?.day
  );
  const nowIso = new Date().toISOString();

  // 记录本期续费历史
  const historyItem = {
    id: `history-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    date: record.dueDate,
    amount: record.amount || "",
    cycle: record.cycle,
    renewedAt: nowIso,
    note: `完成本期续费（已自动顺延至 ${nextDueDate}）`,
  };

  const existingHistory = Array.isArray(record.history) ? record.history : [];

  return {
    ...record,
    dueDate: nextDueDate,
    status: "active", // 周期性记录保持正常生效状态
    cycleAnchorDay: record.cycleAnchorDay || parseDateString(record.dueDate)?.day,
    updatedAt: nowIso,
    history: [historyItem, ...existingHistory],
  };
}

/**
 * 计算某条记录在指定年份和月份（公历）中的所有发生日期 (YYYY-MM-DD 列表)
 * 无论按月、按两月、按季度、按半年还是按年，均能在对应发生的月份精确显示与提醒
 * @param {Object} record
 * @param {number} targetYear
 * @param {number} targetMonth 1-12
 * @returns {Array<{ date: string, isProjected: boolean, cycleText: string }>}
 */
export function getOccurrencesInMonth(record, targetYear, targetMonth) {
  if (!record || !record.dueDate) return [];
  const parsed = parseDateString(record.dueDate);
  if (!parsed) return [];

  const interval = parseCycleInterval(record.cycle);
  if (!interval) {
    // 一次性记录：仅在本身当月显示
    if (parsed.year === targetYear && parsed.month === targetMonth) {
      return [{ date: record.dueDate, isProjected: false, cycleText: record.cycle || "一次性" }];
    }
    return [];
  }

  // 已经取消或归档的不继续投影未来周期
  if (record.status === "cancelled" || record.status === "archived") {
    if (parsed.year === targetYear && parsed.month === targetMonth) {
      return [{ date: record.dueDate, isProjected: false, cycleText: record.cycle }];
    }
    return [];
  }

  const targetDateKey = `${targetYear}-${String(targetMonth).padStart(2, "0")}`;
  const recordMonthKey = `${parsed.year}-${String(parsed.month).padStart(2, "0")}`;

  // 如果目标月份早于记录起始月份，不出现
  if (targetDateKey < recordMonthKey) return [];

  const anchorDay = record.cycleAnchorDay || parsed.day;
  const occurrences = [];

  if (interval.type === "month") {
    const monthDiff = (targetYear - parsed.year) * 12 + (targetMonth - parsed.month);
    // 只有相差的月份能被周期整除时，才在该月发生！
    // 例如：按两月 (count=2)，7月起始，则 7月(diff=0), 9月(diff=2), 11月(diff=4), 次年1月(diff=6) 精确发生；8月、10月、12月绝不误报！
    // 例如：按季度 (count=3)，7月起始，则 7月(diff=0), 10月(diff=3), 次年1月(diff=6) 精确发生；8月、9月、11月绝不误报！
    if (monthDiff >= 0 && monthDiff % interval.count === 0) {
      const maxDays = getDaysInMonth(targetYear, targetMonth);
      const day = Math.min(anchorDay, maxDays);
      const dateStr = formatDateKey(targetYear, targetMonth, day);
      const isProjected = dateStr !== record.dueDate;
      occurrences.push({
        date: dateStr,
        isProjected,
        cycleText: record.cycle,
      });
    }
  } else if (interval.type === "week" || interval.type === "day") {
    const stepDays = interval.type === "week" ? interval.count * 7 : interval.count;
    const startDate = new Date(`${record.dueDate}T12:00:00`);
    const totalDays = getDaysInMonth(targetYear, targetMonth);
    for (let d = 1; d <= totalDays; d++) {
      const current = new Date(`${targetYear}-${String(targetMonth).padStart(2, "0")}-${String(d).padStart(2, "0")}T12:00:00`);
      if (current >= startDate) {
        const diffDays = Math.round((current - startDate) / (1000 * 60 * 60 * 24));
        if (diffDays % stepDays === 0) {
          const dateStr = formatDateKey(targetYear, targetMonth, d);
          occurrences.push({ date: dateStr, isProjected: dateStr !== record.dueDate, cycleText: record.cycle });
        }
      }
    }
  }

  return occurrences;
}

/**
 * 计算剩余天数（相对于今天本地日期）
 * @param {string} dueDate "YYYY-MM-DD"
 * @returns {number} 0 为今天到期，正数为未来，负数为已逾期
 */
export function getRemainingDays(dueDate) {
  if (!dueDate) return 0;
  const today = new Date();
  const todayStr = formatDateKey(today.getFullYear(), today.getMonth() + 1, today.getDate());
  
  const target = new Date(`${dueDate}T00:00:00`);
  const base = new Date(`${todayStr}T00:00:00`);
  return Math.round((target - base) / (1000 * 60 * 60 * 24));
}

/**
 * 诊断周期记录是否已跨周期逾期（例如设置了每月18日，当前已经隔了几个周期未续费）
 * @param {Object} record
 * @returns {{ isOverdue: boolean, cyclesMissed: number, suggestedDueDate: string }}
 */
export function diagnoseOverdueStatus(record) {
  const interval = parseCycleInterval(record?.cycle);
  if (!record || !record.dueDate || !interval) {
    const days = getRemainingDays(record?.dueDate);
    return { isOverdue: days < 0, cyclesMissed: 0, suggestedDueDate: record?.dueDate || "" };
  }

  const days = getRemainingDays(record.dueDate);
  if (days >= 0) {
    return { isOverdue: false, cyclesMissed: 0, suggestedDueDate: record.dueDate };
  }

  // 计算错过了多少期
  let current = record.dueDate;
  let cycles = 0;
  const anchorDay = record.cycleAnchorDay || parseDateString(record.dueDate)?.day;

  while (getRemainingDays(current) < 0 && cycles < 120) {
    current = calculateNextDueDate(current, record.cycle, anchorDay);
    cycles += 1;
  }

  return {
    isOverdue: true,
    cyclesMissed: cycles,
    suggestedDueDate: current,
  };
}
