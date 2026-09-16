import assert from "node:assert/strict";
import test from "node:test";

import {
  generateReminderId,
  getUrgentSummary,
  parseReminderDays,
} from "../src/utils/reminderEngine.js";

test("提醒天数字符串与数组解析精准兼容", () => {
  assert.deepEqual(parseReminderDays("到期前 7 天、3 天、1 天"), [7, 3, 1]);
  assert.deepEqual(parseReminderDays("提前 15 天"), [15]);
  assert.deepEqual(parseReminderDays([0, 1, 3]), [0, 1, 3]);
  assert.deepEqual(parseReminderDays(""), [7, 3, 1, 0]); // 默认值
});

test("提醒 ID 生成符合 32 位整型且稳定唯一", () => {
  const id1 = generateReminderId("rec-123", 7);
  const id2 = generateReminderId("rec-123", 7);
  const id3 = generateReminderId("rec-123", 3);
  assert.equal(id1, id2);
  assert.notEqual(id1, id3);
  assert.ok(id1 > 0 && id1 <= 0x7fffffff);
});

test("紧急提醒汇总准确分类（已逾期、今日到期、即将到期）", () => {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const d = String(today.getDate()).padStart(2, "0");
  const todayStr = `${y}-${m}-${d}`;

  const pastDate = new Date(today.getTime() - 86400000 * 2);
  const pastStr = `${pastDate.getFullYear()}-${String(pastDate.getMonth() + 1).padStart(2, "0")}-${String(pastDate.getDate()).padStart(2, "0")}`;

  const futureDate = new Date(today.getTime() + 86400000 * 2);
  const futureStr = `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, "0")}-${String(futureDate.getDate()).padStart(2, "0")}`;

  const farFutureDate = new Date(today.getTime() + 86400000 * 30);
  const farFutureStr = `${farFutureDate.getFullYear()}-${String(farFutureDate.getMonth() + 1).padStart(2, "0")}-${String(farFutureDate.getDate()).padStart(2, "0")}`;

  const sampleRecords = [
    { id: "1", title: "逾期任务", dueDate: pastStr, status: "active" },
    { id: "2", title: "今日任务", dueDate: todayStr, status: "active" },
    { id: "3", title: "两天后任务", dueDate: futureStr, status: "active" },
    { id: "4", title: "下月任务", dueDate: farFutureStr, status: "active" },
    { id: "5", title: "已处理的逾期", dueDate: pastStr, status: "handled" }, // 不计入
  ];

  const summary = getUrgentSummary(sampleRecords);
  assert.equal(summary.overdue.length, 1);
  assert.equal(summary.overdue[0].id, "1");
  assert.equal(summary.today.length, 1);
  assert.equal(summary.today[0].id, "2");
  assert.equal(summary.upcoming.length, 1);
  assert.equal(summary.upcoming[0].id, "3");
  assert.equal(summary.totalUrgentCount, 3);
});
