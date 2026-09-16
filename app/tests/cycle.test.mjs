import assert from "node:assert/strict";
import test from "node:test";

import {
  advanceRecurringRecord,
  calculateNextDueDate,
  diagnoseOverdueStatus,
  formatDateKey,
  getDaysInMonth,
  getOccurrencesInMonth,
  parseDateString,
} from "../src/utils/cycleUtils.js";

test("基础日期函数解析与月天数计算准确", () => {
  assert.deepEqual(parseDateString("2026-07-18"), { year: 2026, month: 7, day: 18 });
  assert.equal(formatDateKey(2026, 7, 18), "2026-07-18");
  assert.equal(getDaysInMonth(2026, 2), 28);
  assert.equal(getDaysInMonth(2024, 2), 29); // 闰年
  assert.equal(getDaysInMonth(2026, 7), 31);
});

test("解决用户核心问题：7月18号到期按月续费，下月精确推期至 8月18日", () => {
  const nextMonthly = calculateNextDueDate("2026-07-18", "每月");
  assert.equal(nextMonthly, "2026-08-18");

  const nextQuarterly = calculateNextDueDate("2026-07-18", "每季度");
  assert.equal(nextQuarterly, "2026-10-18");

  const nextYearly = calculateNextDueDate("2026-07-18", "每年");
  assert.equal(nextYearly, "2027-07-18");

  const nextWeekly = calculateNextDueDate("2026-07-18", "每周");
  assert.equal(nextWeekly, "2026-07-25");
});

test("跨年与月末边界日期严谨处理", () => {
  // 12月跨年到次年1月
  assert.equal(calculateNextDueDate("2026-12-15", "每月"), "2027-01-15");
  // 1月31日推到2月（平年28天）
  assert.equal(calculateNextDueDate("2026-01-31", "每月"), "2026-02-28");
  // 2月推到3月时，如果保留锚定日31号，能够恢复为3月31日
  assert.equal(calculateNextDueDate("2026-02-28", "每月", 31), "2026-03-31");
});

test("解决用户核心问题：日历多月展开，在未来各月份均能显示周期日程", () => {
  const testRecord = {
    id: "sub-1",
    title: "ChatGPT Plus",
    dueDate: "2026-07-18",
    cycle: "每月",
    status: "active",
  };

  // 7月有一次
  const julyOccur = getOccurrencesInMonth(testRecord, 2026, 7);
  assert.equal(julyOccur.length, 1);
  assert.equal(julyOccur[0].date, "2026-07-18");
  assert.equal(julyOccur[0].isProjected, false);

  // 8月能自动投影出 8月18日！
  const augustOccur = getOccurrencesInMonth(testRecord, 2026, 8);
  assert.equal(augustOccur.length, 1);
  assert.equal(augustOccur[0].date, "2026-08-18");
  assert.equal(augustOccur[0].isProjected, true);

  // 9月、12月也能投影！
  const decOccur = getOccurrencesInMonth(testRecord, 2026, 12);
  assert.equal(decOccur.length, 1);
  assert.equal(decOccur[0].date, "2026-12-18");

  // 起始之前的月份（如2026年6月）不出现
  const juneOccur = getOccurrencesInMonth(testRecord, 2026, 6);
  assert.equal(juneOccur.length, 0);
});

test("解决用户核心问题：完成本期续费后，自动推期并完整保留历史记录", () => {
  const record = {
    id: "sub-netflix",
    title: "Netflix",
    dueDate: "2026-07-18",
    cycle: "每月",
    amount: "79",
    status: "active",
  };

  const renewed = advanceRecurringRecord(record);

  // 到期日自动变为 2026-08-18
  assert.equal(renewed.dueDate, "2026-08-18");
  // 状态依然是 active，没有被粗暴标记为 handled 而消失
  assert.equal(renewed.status, "active");
  // 续费历史被成功保留
  assert.ok(Array.isArray(renewed.history));
  assert.equal(renewed.history.length, 1);
  assert.equal(renewed.history[0].date, "2026-07-18");
  assert.equal(renewed.history[0].amount, "79");

  // 再次续费，推进到 9月18日，历史累积到 2 条
  const renewedAgain = advanceRecurringRecord(renewed);
  assert.equal(renewedAgain.dueDate, "2026-08-18" === "2026-08-18" ? "2026-09-18" : "");
  assert.equal(renewedAgain.history.length, 2);
});

test("按两个月与按季度续费：推期与多月日历投影精准，绝无错报漏报", () => {
  // 1. 测试按两个月（双月）推期
  const biMonthlyRecord = {
    id: "sub-bimonthly",
    title: "双月服务器维护",
    dueDate: "2026-07-18",
    cycle: "每两个月",
    status: "active",
  };

  // 7月起始 -> 下次推期必须是 9月18日
  const nextBiMonth = calculateNextDueDate("2026-07-18", "每两个月");
  assert.equal(nextBiMonth, "2026-09-18");

  // 9月18日再推一次 -> 11月18日
  assert.equal(calculateNextDueDate("2026-09-18", "每两个月"), "2026-11-18");
  // 11月18日再推一次 -> 跨年到次年 2027-01-18
  assert.equal(calculateNextDueDate("2026-11-18", "每两个月"), "2027-01-18");

  // 日历投影验证：7月有、8月没有、9月有、10月没有、11月有！
  assert.equal(getOccurrencesInMonth(biMonthlyRecord, 2026, 7).length, 1);
  assert.equal(getOccurrencesInMonth(biMonthlyRecord, 2026, 8).length, 0); // 8月不应该出现！
  assert.equal(getOccurrencesInMonth(biMonthlyRecord, 2026, 9).length, 1);
  assert.equal(getOccurrencesInMonth(biMonthlyRecord, 2026, 9)[0].date, "2026-09-18");
  assert.equal(getOccurrencesInMonth(biMonthlyRecord, 2026, 10).length, 0); // 10月不应该出现！
  assert.equal(getOccurrencesInMonth(biMonthlyRecord, 2026, 11).length, 1);
  assert.equal(getOccurrencesInMonth(biMonthlyRecord, 2026, 11)[0].date, "2026-11-18");

  // 2. 测试按季度（3个月）推期
  const quarterlyRecord = {
    id: "sub-quarterly",
    title: "季度会员",
    dueDate: "2026-07-18",
    cycle: "每季度",
    status: "active",
  };

  // 7月起始 -> 下期必须是 10月18日
  assert.equal(calculateNextDueDate("2026-07-18", "每季度"), "2026-10-18");
  // 10月再推一次 -> 跨年到次年 2027-01-18
  assert.equal(calculateNextDueDate("2026-10-18", "每季度"), "2027-01-18");

  // 日历投影验证：7月有、8月没有、9月没有、10月有！
  assert.equal(getOccurrencesInMonth(quarterlyRecord, 2026, 7).length, 1);
  assert.equal(getOccurrencesInMonth(quarterlyRecord, 2026, 8).length, 0);
  assert.equal(getOccurrencesInMonth(quarterlyRecord, 2026, 9).length, 0);
  assert.equal(getOccurrencesInMonth(quarterlyRecord, 2026, 10).length, 1);
  assert.equal(getOccurrencesInMonth(quarterlyRecord, 2026, 10)[0].date, "2026-10-18");
  assert.equal(getOccurrencesInMonth(quarterlyRecord, 2026, 11).length, 0);
  assert.equal(getOccurrencesInMonth(quarterlyRecord, 2027, 1).length, 1);
  assert.equal(getOccurrencesInMonth(quarterlyRecord, 2027, 1)[0].date, "2027-01-18");
});

