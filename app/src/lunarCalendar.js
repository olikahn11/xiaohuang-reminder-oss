import { Lunar, LunarYear, Solar } from "lunar-javascript";

const lunarSummaryCache = new Map();
const lunarPreviewCache = new Map();
const almanacCache = new Map();

export const ALMANAC_REFERENCES = [
  {
    title: "《钦定协纪辨方书》",
    badge: "官修集成",
    edition: "清允禄等奉敕编 · 三十六卷 · 乾隆六年序刊本",
    focus: "系统整理择吉本原、义例、神煞、宜忌、用事与辨伪，是清代官修择日体系的重要集成。",
    reliability: "书名、卷数与编修关系较明确；具体判断仍须核对卷次、版本和用事条件。",
  },
  {
    title: "《鳌头通书》",
    badge: "明代通书",
    edition: "明熊宗立撰辑 · 后世有多种增补、重刊本",
    focus: "民间日用通书体系的重要代表，内容涉及历法、选择与生活用事，流传范围较广。",
    reliability: "版本分支较多，引用具体规则时应说明所据刻本，不能只写书名。",
  },
  {
    title: "《象吉通书》",
    badge: "应用重镇",
    edition: "又名《增补象吉备要通书大全》 · 常见本题清魏明远编 · 二十九卷",
    focus: "以造葬、修方、嫁娶、出行等分类用事见长，在民间实用择日传统中影响显著。",
    reliability: "作者题署、增补层次与现代整理本存在差异，实际采用前需核对版本。",
  },
  {
    title: "《玉匣记》",
    badge: "民俗广传",
    edition: "现存书名、卷数、题署差异明显 · 明清以来多种通书与杂占合刊本",
    focus: "在家庭日用、婚丧礼俗和民间禁忌中传播广，但内容混杂、后世增补较多。",
    reliability: "不作为唯一高权重依据；若家中沿用某本，应优先记录具体版本或家传口径。",
  },
];

function parseDateKey(dateKey) {
  const [year, month, day] = String(dateKey || "").split("-").map(Number);
  if (!year || !month || !day) return null;
  return { year, month, day };
}

export function lunarSummaryForDate(dateKey) {
  if (lunarSummaryCache.has(dateKey)) return lunarSummaryCache.get(dateKey);
  const parts = parseDateKey(dateKey);
  if (!parts) return null;
  try {
    const lunar = Solar.fromYmd(parts.year, parts.month, parts.day).getLunar();
    const isLeapMonth = lunar.getMonth() < 0;
    const rawMonthName = lunar.getMonthInChinese();
    const monthName = `${isLeapMonth && !rawMonthName.startsWith("闰") ? "闰" : ""}${rawMonthName}月`;
    const dayName = lunar.getDayInChinese();
    const festivals = [...lunar.getFestivals(), ...lunar.getOtherFestivals()];
    const jieQi = lunar.getJieQi();
    const result = {
      dateKey,
      lunarLabel: dayName === "初一" ? monthName : dayName,
      lunarDate: `农历${monthName}${dayName}`,
      lunarYear: `${lunar.getYearInGanZhi()}年 · ${lunar.getYearShengXiao()}年`,
      dayGanZhi: `${lunar.getDayInGanZhi()}日`,
      jieQi,
      festivals,
    };
    lunarSummaryCache.set(dateKey, result);
    return result;
  } catch {
    return null;
  }
}

export function lunarPreviewForDate(dateKey) {
  if (lunarPreviewCache.has(dateKey)) return lunarPreviewCache.get(dateKey);
  const parts = parseDateKey(dateKey);
  const summary = lunarSummaryForDate(dateKey);
  if (!parts || !summary) return null;
  try {
    const lunar = Solar.fromYmd(parts.year, parts.month, parts.day).getLunar();
    const dayNineStar = lunar.getDayNineStar();
    const result = {
      ...summary,
      yi: lunar.getDayYi(),
      ji: lunar.getDayJi(),
      goodSpirits: lunar.getDayJiShen(),
      cautionItems: lunar.getDayXiongSha(),
      clash: `冲${lunar.getDayChongDesc()} · 煞${lunar.getDaySha()}`,
      duty: `${lunar.getZhiXing()}日`,
      dayOfficer: `${lunar.getDayTianShen()} · ${lunar.getDayTianShenType()} · ${lunar.getDayTianShenLuck()}`,
      luckyDirections: `喜神${lunar.getPositionXiDesc()} · 福神${lunar.getPositionFuDesc()} · 财神${lunar.getPositionCaiDesc()}`,
      naYin: lunar.getDayNaYin(),
      mansion: `${lunar.getXiu()}宿 · ${lunar.getXiuLuck()}`,
      pengZu: [lunar.getPengZuGan(), lunar.getPengZuZhi()],
      fetalGod: lunar.getDayPositionTai(),
      taiSui: `年太岁${lunar.getYearPositionTaiSuiDesc()} · 月太岁${lunar.getMonthPositionTaiSuiDesc()} · 日太岁${lunar.getDayPositionTaiSuiDesc()}`,
      moonPhase: lunar.getYueXiang() || "无特别月相名",
      liuYao: lunar.getLiuYao(),
      seasonalPhenology: `${lunar.getHou()} · ${lunar.getWuHou()}`,
      dayLu: lunar.getDayLu(),
      nineStar: `${dayNineStar.toString()} · ${dayNineStar.getPosition()}（${dayNineStar.getPositionDesc()}） · 玄空${dayNineStar.getNameInXuanKong()}${dayNineStar.getLuckInXuanKong()}`,
    };
    lunarPreviewCache.set(dateKey, result);
    return result;
  } catch {
    return null;
  }
}

export function lunarInfoForDate(dateKey) {
  if (almanacCache.has(dateKey)) return almanacCache.get(dateKey);
  const parts = parseDateKey(dateKey);
  const preview = lunarPreviewForDate(dateKey);
  if (!parts || !preview) return null;
  try {
    const lunar = Solar.fromYmd(parts.year, parts.month, parts.day).getLunar();
    const result = {
      ...preview,
      timeSlots: lunar.getTimes().map((time) => ({
        range: `${time.getMinHm()}—${time.getMaxHm()}`,
        ganZhi: time.getGanZhi(),
        officer: time.getTianShen(),
        luck: time.getTianShenLuck(),
        yi: time.getYi(),
        ji: time.getJi(),
      })),
    };
    almanacCache.set(dateKey, result);
    return result;
  } catch {
    return null;
  }
}

export function lunarCellLabel(dateKey) {
  const info = lunarSummaryForDate(dateKey);
  if (!info) return "";
  return info.jieQi || info.festivals[0] || info.lunarLabel;
}

export function lunarPartsForSolarDate(dateKey) {
  const parts = parseDateKey(dateKey);
  if (!parts) return null;
  try {
    const lunar = Solar.fromYmd(parts.year, parts.month, parts.day).getLunar();
    return { year: lunar.getYear(), month: lunar.getMonth(), day: lunar.getDay() };
  } catch {
    return null;
  }
}

export function lunarMonthOptions(year) {
  try {
    return LunarYear.fromYear(Number(year)).getMonthsInYear().map((month) => {
      const monthNumber = month.getMonth();
      const lunar = Lunar.fromYmd(Number(year), monthNumber, 1);
      return {
        value: monthNumber,
        label: `${monthNumber < 0 && !lunar.getMonthInChinese().startsWith("闰") ? "闰" : ""}${lunar.getMonthInChinese()}月`,
        dayCount: month.getDayCount(),
      };
    });
  } catch {
    return [];
  }
}

export function lunarDayLabel(year, month, day) {
  try {
    return Lunar.fromYmd(Number(year), Number(month), Number(day)).getDayInChinese();
  } catch {
    return String(day);
  }
}

export function solarDateKeyFromLunar(year, month, day) {
  try {
    return Lunar.fromYmd(Number(year), Number(month), Number(day)).getSolar().toYmd();
  } catch {
    return "";
  }
}
