import React, { useState } from "react";
import {
  Article,
  CaretRight,
  ClockCountdown,
  Plus,
  ShieldCheck,
  Sparkle,
} from "@phosphor-icons/react";
import {
  ALMANAC_REFERENCES,
  lunarInfoForDate,
} from "../../lunarCalendar.js";
import { formatDateKey } from "../../utils/cycleUtils.js";

export function AlmanacDetailCard({ date }) {
  const info = lunarInfoForDate(date);
  if (!info) {
    return (
      <div className="almanac-unavailable">
        当前日期超出农历计算范围，请选择 1900—2100 年。
      </div>
    );
  }

  return (
    <div className="almanac-detail-card content-surface">
      <div className="almanac-hero-copy">
        <span className="almanac-emblem">
          <Sparkle size={30} weight="fill" className="text-accent" />
        </span>
        <div>
          <small>{date}</small>
          <h3>{info.lunarDate}</h3>
          <p>
            {info.lunarYear} · {info.dayGanZhi}
            {info.jieQi ? ` · ${info.jieQi}` : ""}
          </p>
        </div>
        <span
          className={`almanac-day-type ${
            info.dayOfficer.includes("黄道") ? "good" : "neutral"
          }`}
        >
          {info.dayOfficer}
        </span>
      </div>

      <div className="almanac-fact-grid">
        <div>
          <small>十二值日</small>
          <strong>{info.duty}</strong>
        </div>
        <div>
          <small>冲煞</small>
          <strong>{info.clash}</strong>
        </div>
        <div>
          <small>纳音五行</small>
          <strong>{info.naYin}</strong>
        </div>
        <div>
          <small>二十八宿</small>
          <strong>{info.mansion}</strong>
        </div>
      </div>

      <div className="almanac-yi-ji">
        <section className="almanac-yi">
          <h4>
            <span className="tag-yi">宜</span>传统择吉用事
          </h4>
          <div className="yi-ji-tags">
            {info.yi.length ? (
              info.yi.map((item) => <span key={item}>{item}</span>)
            ) : (
              <span>诸事皆宜</span>
            )}
          </div>
        </section>

        <section className="almanac-ji">
          <h4>
            <span className="tag-ji">忌</span>传统规避条目
          </h4>
          <div className="yi-ji-tags">
            {info.ji.length ? (
              info.ji.map((item) => <span key={item}>{item}</span>)
            ) : (
              <span>诸事不忌</span>
            )}
          </div>
        </section>
      </div>

      <details className="almanac-time-details">
        <summary>
          <span>
            <ClockCountdown size={18} />
            传统时辰吉凶参考
          </span>
          <small>展开查看 13 个时段的神煞与宜忌</small>
        </summary>
        <div className="almanac-time-grid">
          {info.timeSlots.map((slot) => (
            <div
              className={`almanac-time-card ${
                slot.luck === "吉" ? "good" : "caution"
              }`}
              key={`${slot.range}-${slot.ganZhi}`}
            >
              <div>
                <strong>{slot.range}</strong>
                <span>
                  {slot.ganZhi}时 · {slot.officer}
                </span>
                <em>{slot.luck}</em>
              </div>
              <p>
                <b>宜</b>
                {slot.yi.slice(0, 4).join("、") || "无特别条目"}
              </p>
              <p>
                <b>忌</b>
                {slot.ji.slice(0, 4).join("、") || "无特别条目"}
              </p>
            </div>
          ))}
        </div>
      </details>

      <div className="almanac-disclaimer">
        <ShieldCheck size={18} />
        <p>
          <strong>传统民俗文化参考</strong>
          <span>
            黄历宜忌属于中国传统民间择日文献整理，仅供文化参考与生活调适；签约、动土、出行等重要事项应以现实安全、法律法规、天气与个人实际安排为首要准则。
          </span>
        </p>
      </div>
    </div>
  );
}

export function AlmanacView({
  date = formatDateKey(new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate()),
  onDateChange,
  records,
  onOpenRecord,
  onAddRecord,
}) {
  const [currentDate, setCurrentDate] = useState(date);

  const handleDateChange = (newDate) => {
    setCurrentDate(newDate);
    onDateChange?.(newDate);
  };

  const scheduled = records.filter(
    (record) => record.kind === "almanac" && record.dueDate === currentDate
  );

  return (
    <section className="almanac-view-container">
      <div className="almanac-view-head">
        <div>
          <h2>中华传统历法与择吉黄历</h2>
          <p>
            查看指定公历日的干支纪年、农历月日、物候节气、十二值日与吉凶宜忌
          </p>
        </div>
        <div className="almanac-picker-row">
          <input
            type="date"
            className="form-input almanac-date-input"
            value={currentDate}
            onChange={(e) => handleDateChange(e.target.value)}
          />
          <button
            className="btn-primary-gradient"
            onClick={() => onAddRecord?.("almanac", currentDate)}
          >
            <Plus size={16} weight="bold" />
            <span>记录该日传统安排</span>
          </button>
        </div>
      </div>

      <AlmanacDetailCard date={currentDate} />

      {scheduled.length > 0 && (
        <div className="almanac-scheduled-section content-surface">
          <h3>这一天的传统备忘事项 ({scheduled.length})</h3>
          <div className="almanac-scheduled-list">
            {scheduled.map((rec) => (
              <div
                key={rec.id}
                className="almanac-scheduled-item"
                onClick={() => onOpenRecord?.(rec)}
              >
                <div>
                  <strong>{rec.title}</strong>
                  <span>{rec.notes || "无特别说明"}</span>
                </div>
                <CaretRight size={16} />
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
