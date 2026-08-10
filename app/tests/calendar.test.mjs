import assert from "node:assert/strict";
import test from "node:test";

import {
  ALMANAC_REFERENCES,
  lunarInfoForDate,
  lunarMonthOptions,
  lunarPartsForSolarDate,
  solarDateKeyFromLunar,
} from "../src/lunarCalendar.js";
import { RECORD_FORM_CONFIG, defaultStatusForKind, fieldsForKind } from "../src/recordFields.js";

test("公历日期可生成农历日期与黄历条目", () => {
  const info = lunarInfoForDate("2026-08-10");
  assert.equal(info.lunarDate, "农历六月廿八");
  assert.equal(info.dayGanZhi, "丙辰日");
  assert.ok(info.yi.length > 0);
  assert.ok(info.ji.length > 0);
  assert.equal(info.timeSlots.length, 13);
  assert.match(info.fetalGod, /外|内/);
  assert.ok(info.pengZu.length === 2);
  assert.equal(ALMANAC_REFERENCES.length, 4);
});

test("农历快速选择支持闰月并准确换算公历", () => {
  const months = lunarMonthOptions(2025);
  assert.deepEqual(months.find((month) => month.value === -6), {
    value: -6,
    label: "闰六月",
    dayCount: 29,
  });
  assert.equal(solarDateKeyFromLunar(2025, -6, 1), "2025-07-25");
  assert.deepEqual(lunarPartsForSolarDate("2025-07-25"), { year: 2025, month: -6, day: 1 });
  assert.equal(lunarInfoForDate("2025-07-25").lunarDate, "农历闰六月初一");
});

test("不同记录类型只显示各自需要的字段", () => {
  const renewalKeys = fieldsForKind("renewal").map((field) => field.key);
  const pendingKeys = fieldsForKind("pending").map((field) => field.key);
  const almanacKeys = fieldsForKind("almanac").map((field) => field.key);

  assert.ok(renewalKeys.includes("amount"));
  assert.ok(!pendingKeys.includes("amount"));
  assert.ok(almanacKeys.includes("traditionMatter"));
  assert.ok(almanacKeys.includes("realWorldConstraints"));
  assert.ok(!renewalKeys.includes("traditionMatter"));
  assert.equal(defaultStatusForKind("almanac"), "planned");
  assert.equal(Object.keys(RECORD_FORM_CONFIG).length, 8);
});
