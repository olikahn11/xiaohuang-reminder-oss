import React, { useMemo, useState } from "react";
import {
  CalendarBlank,
  CaretLeft,
  CaretRight,
  Plus,
  Sparkle,
} from "@phosphor-icons/react";
import {
  formatDateKey,
  getDaysInMonth,
  getOccurrencesInMonth,
} from "../../utils/cycleUtils.js";
import {
  lunarPreviewForDate,
  lunarSummaryForDate,
} from "../../lunarCalendar.js";
import { getCurrencySymbol } from "../../utils/currencyUtils.js";

export function CinematicCalendar({
  records,
  onSelectRecord,
  onAdvanceRecord,
  onAddRecord,
  onViewAlmanac,
}) {
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth() + 1); // 1-12
  const [selectedDate, setSelectedDate] = useState(
    formatDateKey(today.getFullYear(), today.getMonth() + 1, today.getDate())
  );

  // 切换月份
  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentYear(currentYear - 1);
      setCurrentMonth(12);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentYear(currentYear + 1);
      setCurrentMonth(1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const handleToday = () => {
    const y = today.getFullYear();
    const m = today.getMonth() + 1;
    const d = today.getDate();
    setCurrentYear(y);
    setCurrentMonth(m);
    setSelectedDate(formatDateKey(y, m, d));
  };

  // 生成日历网格数据：不仅收集本身属于当月的记录，更收集周期性推算投射到当月的日程
  const { monthGrid, occurrencesByDate, totalMonthCount } = useMemo(() => {
    const totalDays = getDaysInMonth(currentYear, currentMonth);
    const firstDayWeekday = new Date(currentYear, currentMonth - 1, 1).getDay(); // 0(周日) - 6(周六)

    const map = {};
    let count = 0;

    for (const record of records) {
      if (record.status === "handled" || record.status === "cancelled" || record.status === "archived") {
        continue;
      }
      const occurrences = getOccurrencesInMonth(record, currentYear, currentMonth);
      for (const occ of occurrences) {
        if (!map[occ.date]) map[occ.date] = [];
        map[occ.date].push({
          record,
          isProjected: occ.isProjected,
          cycleText: occ.cycleText,
        });
        count += 1;
      }
    }

    const cells = [];
    // 填充月初留白
    for (let i = 0; i < firstDayWeekday; i++) {
      cells.push(null);
    }
    // 填充月份每一天
    for (let d = 1; d <= totalDays; d++) {
      const dateKey = formatDateKey(currentYear, currentMonth, d);
      cells.push({
        day: d,
        dateKey,
        isToday: dateKey === formatDateKey(today.getFullYear(), today.getMonth() + 1, today.getDate()),
        events: map[dateKey] || [],
      });
    }

    return {
      monthGrid: cells,
      occurrencesByDate: map,
      totalMonthCount: count,
    };
  }, [records, currentYear, currentMonth]);

  // 当前选中日期的日程列表与黄历预览
  const selectedEvents = occurrencesByDate[selectedDate] || [];
  const selectedAlmanac = lunarPreviewForDate(selectedDate);
  const lunarSummary = lunarSummaryForDate(selectedDate);

  return (
    <div className="calendar-page-layout">
      {/* 紧凑日历主盘 */}
      <div className="calendar-main-stage content-surface">
        {/* 日历头部控制器 */}
        <div className="calendar-top-bar">
          <div className="calendar-title-group">
            <h2>
              {currentYear} 年 {currentMonth} 月
            </h2>
            <span className="calendar-month-badge">
              本月 {totalMonthCount} 项日程<span className="badge-hint">（周期已展开）</span>
            </span>
          </div>

          <div className="calendar-nav-controls">
            <button className="btn-icon" onClick={handlePrevMonth} title="上一月">
              <CaretLeft size={18} />
            </button>
            <button className="btn-text-sm" onClick={handleToday}>
              今天
            </button>
            <button className="btn-icon" onClick={handleNextMonth} title="下一月">
              <CaretRight size={18} />
            </button>
          </div>
        </div>

        {/* 星期行 */}
        <div className="calendar-weekdays-row">
          {["日", "一", "二", "三", "四", "五", "六"].map((w, idx) => (
            <span key={w} className={idx === 0 || idx === 6 ? "weekend" : ""}>
              周{w}
            </span>
          ))}
        </div>

        {/* 核心日期单元格网格（移动端超紧凑收纳，桌面端丰富展开） */}
        <div className="calendar-cells-grid">
          {monthGrid.map((cell, idx) => {
            if (!cell) {
              return <div key={`empty-${idx}`} className="calendar-cell-empty" />;
            }

            const { day, dateKey, isToday, events } = cell;
            const isSelected = dateKey === selectedDate;
            const cellLunar = lunarSummaryForDate(dateKey);
            const hasEvents = events.length > 0;

            return (
              <div
                key={dateKey}
                className={`calendar-cell ${isSelected ? "selected" : ""} ${isToday ? "today" : ""} ${hasEvents ? "has-events" : ""}`}
                onClick={() => setSelectedDate(dateKey)}
                onDoubleClick={() => onAddRecord?.("renewal", dateKey)}
                title={`${dateKey}：单击查看日程`}
              >
                <div className="calendar-cell__header">
                  <span className="solar-day">{day}</span>
                  <span className="lunar-day">
                    {cellLunar?.festivals?.[0] || cellLunar?.jieQi || cellLunar?.lunarLabel || ""}
                  </span>
                </div>

                {/* 移动端专属：精致彩色波普打点指示器（不挤占屏幕空间） */}
                {hasEvents && (
                  <div className="calendar-cell__dots">
                    {events.slice(0, 3).map((item, i) => (
                      <span
                        key={`dot-${i}`}
                        className={`calendar-dot ${item.isProjected ? "dot-projected" : "dot-direct"}`}
                      />
                    ))}
                    {events.length > 3 && <span className="dot-plus">+</span>}
                  </div>
                )}

                {/* 桌面端专属：完整日程胶囊 */}
                {hasEvents && (
                  <div className="calendar-cell__events">
                    {events.slice(0, 3).map((item, i) => (
                      <div
                        key={`${item.record.id}-${i}`}
                        className={`cell-event-pill ${item.isProjected ? "event-projected" : "event-direct"}`}
                        title={`${item.record.title} (${item.cycleText})`}
                      >
                        <span className="event-dot" />
                        <span className="event-name">{item.record.title}</span>
                      </div>
                    ))}
                    {events.length > 3 && (
                      <span className="cell-more-badge">+{events.length - 3}</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 下方/右侧：所选日期日程票据流与黄历宜忌速览 */}
      <aside className="calendar-agenda-sidebar content-surface">
        <div className="agenda-sidebar-header">
          <div>
            <span className="agenda-date-label">已选日期</span>
            <h3>{selectedDate}</h3>
            {lunarSummary && (
              <small className="agenda-lunar-desc">
                {lunarSummary.lunarDate} · {lunarSummary.dayGanZhi}
              </small>
            )}
          </div>
          <button
            className="btn-primary-sm"
            onClick={() => onAddRecord?.("renewal", selectedDate)}
            title="在这天新增日程或续费"
          >
            <Plus size={15} weight="bold" />
            <span>新增事项</span>
          </button>
        </div>

        {/* 当天黄历宜忌快速速览 */}
        {selectedAlmanac && (
          <div
            className="almanac-quick-card"
            onClick={() => onViewAlmanac?.(selectedDate)}
            title="点击查看当日完整择吉黄历"
          >
            <div className="almanac-quick-card__head">
              <div className="almanac-quick-title">
                <Sparkle size={16} weight="fill" className="text-accent" />
                <span>黄历择吉速览</span>
              </div>
              <CaretRight size={14} weight="bold" />
            </div>
            <div className="almanac-quick-yiji">
              <div className="yiji-line">
                <span className="tag-yi">宜</span>
                <span className="yiji-text">
                  {selectedAlmanac?.yi?.slice(0, 4).join("、") || "诸事皆宜"}
                </span>
              </div>
              <div className="yiji-line">
                <span className="tag-ji">忌</span>
                <span className="yiji-text">
                  {selectedAlmanac?.ji?.slice(0, 4).join("、") || "诸事不忌"}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 当天日程票据流 */}
        <div className="agenda-list">
          <div className="agenda-list-title">
            <span>当日日程与周期项目 ({selectedEvents.length})</span>
          </div>

          {selectedEvents.length > 0 ? (
            selectedEvents.map((item, idx) => (
              <div
                key={`${item.record.id}-${idx}`}
                className="agenda-item-card"
                onClick={() => onSelectRecord(item.record)}
              >
                <div className="agenda-item-card__head">
                  <div className="agenda-item-card__title-group">
                    <strong>{item.record.title}</strong>
                    {item.record.subtitle && (
                      <span className="agenda-item-subtitle">{item.record.subtitle}</span>
                    )}
                  </div>
                  {item.isProjected ? (
                    <span className="badge-cycle-projected">周期自动投影</span>
                  ) : (
                    <span className="badge-cycle-direct">本期实际到期</span>
                  )}
                </div>

                <div className="agenda-item-card__meta">
                  <span className="agenda-meta-cycle">🔄 {item.cycleText}</span>
                  {item.record.amount && <span className="agenda-meta-amount">{getCurrencySymbol(item.record.currency)}{item.record.amount}</span>}
                  <span className="agenda-meta-time">⏰ {item.record.dueTime || "全天"}</span>
                </div>

                {/* 快捷操作栏 */}
                <div className="agenda-item-card__actions" onClick={(e) => e.stopPropagation()}>
                  {item.record.cycle && item.record.cycle !== "一次性" && item.record.cycle !== "不设置" && (
                    <button
                      className="btn-quick-renew-agenda"
                      onClick={() => onAdvanceRecord?.(item.record)}
                      title="完成本期并推至下一周期"
                    >
                      <ArrowsClockwise size={13} weight="bold" />
                      <span>完成续费并推下月</span>
                    </button>
                  )}
                  <button
                    className="btn-detail-agenda"
                    onClick={() => onSelectRecord(item.record)}
                  >
                    <span>详情</span>
                    <CaretRight size={13} />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="agenda-empty">
              <CalendarBlank size={36} weight="duotone" />
              <p>这一天暂无排期事项</p>
              <small>点击右上角“+ 新增事项”添加记录</small>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

