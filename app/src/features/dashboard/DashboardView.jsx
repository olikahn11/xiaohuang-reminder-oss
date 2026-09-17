import React from "react";
import {
  ArrowRight,
  ArrowsClockwise,
  CalendarBlank,
  CaretRight,
  CheckCircle,
  ClockCountdown,
  CreditCard,
  FolderSimple,
  IdentificationBadge,
  Sparkle,
} from "@phosphor-icons/react";
import { UrgentBanner } from "../../components/UrgentBanner.jsx";
import { getRemainingDays } from "../../utils/cycleUtils.js";
import { calculateCNYEquivalent, getCurrencySymbol } from "../../utils/currencyUtils.js";

function CountdownRing({ days }) {
  const isOverdue = days < 0;
  const isUrgent = days >= 0 && days <= 7;
  const strokeColor = isOverdue ? "#EF4444" : isUrgent ? "#FF5722" : "#FFD21E";
  const progress = Math.max(0, Math.min(100, isOverdue ? 100 : (30 - days) * 3.33));
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="countdown-ring-wrapper">
      <svg className="countdown-ring-svg" width="96" height="96" viewBox="0 0 96 96">
        <circle
          cx="48"
          cy="48"
          r={radius}
          fill="none"
          stroke="#E5E7EB"
          strokeWidth="7"
        />
        <circle
          cx="48"
          cy="48"
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth="7"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform="rotate(-90 48 48)"
        />
      </svg>
      <div className="countdown-ring-text">
        <strong>{isOverdue ? `逾期` : Math.max(0, days)}</strong>
        <small>{isOverdue ? `${Math.abs(days)}天` : `天`}</small>
      </div>
    </div>
  );
}

export function DashboardView({
  records,
  onSelectRecord,
  onAdvanceRecord,
  onQuickAdd,
  onNavigate,
}) {
  const activeRecords = records.filter(
    (r) => r.status !== "handled" && r.status !== "cancelled" && r.status !== "archived"
  );

  // 筛选出按到期日排序的有效记录
  const datedRecords = activeRecords
    .filter((r) => r.dueDate)
    .map((r) => ({ ...r, daysLeft: getRemainingDays(r.dueDate) }))
    .sort((a, b) => a.daysLeft - b.daysLeft);

  // 最近需要处理的续费或到期记录（Hero 卡片）
  const heroRecord = datedRecords[0] || null;

  // 统计概览
  const renewals = activeRecords.filter((r) => r.kind === "renewal" || r.cycle);
  const totalMonthlyExpense = renewals.reduce((sum, r) => {
    let amt = parseFloat(r.amount);
    if (isNaN(amt)) return sum;
    amt = calculateCNYEquivalent(amt, r.currency);
    
    if (r.cycle === "每月") return sum + amt;
    if (r.cycle === "每季度") return sum + amt / 3;
    if (r.cycle === "每半年") return sum + amt / 6;
    if (r.cycle === "每年") return sum + amt / 12;
    if (r.cycle === "每两个月") return sum + amt / 2;
    if (r.cycle === "每周") return sum + (amt * 52) / 12;
    return sum;
  }, 0);

  const pendingTasks = activeRecords.filter((r) => r.kind === "pending" || !r.cycle);

  return (
    <div className="dashboard-container">
      {/* 顶部紧急事项横幅 */}
      <UrgentBanner
        records={records}
        onSelectRecord={onSelectRecord}
        onAdvanceRecord={onAdvanceRecord}
      />

      {/* 核心展示区：左侧 Hero 倒计时 + 右侧核心统计指标 */}
      <div className="dashboard-grid-top">
        {heroRecord ? (
          <section className="hero-card content-surface">
            <div className="hero-card__badge">
              <Sparkle size={16} weight="fill" className="text-accent" />
              <span>下一件需关注事项</span>
            </div>

            <div className="hero-card__body">
              <CountdownRing days={heroRecord.daysLeft} />

              <div className="hero-card__info">
                <span className="hero-category-tag">
                  {heroRecord.cycle || "单次到期"}
                </span>
                <h2 className="hero-title">{heroRecord.title}</h2>
                <p className="hero-notes">
                  {heroRecord.subtitle || heroRecord.notes || "暂无更多说明"}
                </p>

                <div className="hero-meta-row">
                  {heroRecord.amount && (
                    <span className="meta-pill">
                      <CreditCard size={16} />
                      {getCurrencySymbol(heroRecord.currency)}{heroRecord.amount} {heroRecord.cycle ? `/${heroRecord.cycle}` : ""}
                    </span>
                  )}
                  <span className="meta-pill">
                    <CalendarBlank size={16} />
                    {heroRecord.dueDate} 到期
                  </span>
                </div>
              </div>
            </div>

            <div className="hero-card__footer">
              {heroRecord.cycle && heroRecord.cycle !== "一次性" && heroRecord.cycle !== "不设置" ? (
                <button
                  className="btn-primary-gradient"
                  onClick={() => onAdvanceRecord(heroRecord)}
                >
                  <ArrowsClockwise size={18} weight="bold" />
                  <span>完成本期续费（推至下月）</span>
                </button>
              ) : (
                <button
                  className="btn-primary-gradient"
                  onClick={() => onSelectRecord(heroRecord)}
                >
                  <CheckCircle size={18} weight="bold" />
                  <span>处理事项</span>
                </button>
              )}

              <button
                className="btn-glass"
                onClick={() => onSelectRecord(heroRecord)}
              >
                <span>查看详情</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </section>
        ) : (
          <section className="hero-card hero-card--empty content-surface">
            <CheckCircle size={48} weight="duotone" className="text-success" />
            <h2>所有事项均已处理完毕</h2>
            <p>目前没有紧急需要关注的到期或待办记录。</p>
            <button className="btn-primary-gradient" onClick={() => onQuickAdd()}>
              新建一条记录
            </button>
          </section>
        )}

        {/* 核心指标微卡片 */}
        <div className="dashboard-stats-column">
          <div
            className="stat-card content-surface stat-card--clickable"
            onClick={() => onNavigate("renewal")}
          >
            <div className="stat-card__icon bg-indigo">
              <CreditCard size={22} weight="duotone" />
            </div>
            <div className="stat-card__content">
              <span className="stat-label">预估月均订阅开销</span>
              <strong className="stat-value">
                ¥{totalMonthlyExpense > 0 ? totalMonthlyExpense.toFixed(2) : "0.00"}
              </strong>
              <small>{renewals.length} 项周期性订阅</small>
            </div>
            <CaretRight size={18} className="stat-card__arrow" />
          </div>

          <div
            className="stat-card content-surface stat-card--clickable"
            onClick={() => onNavigate("pending")}
          >
            <div className="stat-card__icon bg-violet">
              <CalendarBlank size={22} weight="duotone" />
            </div>
            <div className="stat-card__content">
              <span className="stat-label">待提醒日程项</span>
              <strong className="stat-value">{datedRecords.length} 项</strong>
              <small>点击查看具体清单</small>
            </div>
            <CaretRight size={18} className="stat-card__arrow" />
          </div>

          <div
            className="stat-card content-surface stat-card--clickable"
            onClick={() => onNavigate("assets")}
          >
            <div className="stat-card__icon bg-teal">
              <FolderSimple size={22} weight="duotone" />
            </div>
            <div className="stat-card__content">
              <span className="stat-label">数字资产与账号</span>
              <strong className="stat-value">{records.length} 条记录</strong>
              <small>集中安全管理</small>
            </div>
            <CaretRight size={18} className="stat-card__arrow" />
          </div>
        </div>
      </div>

      {/* 近期临近日程日程流 */}
      <section className="dashboard-section content-surface">
        <div className="section-head">
          <div className="section-title">
            <ClockCountdown size={20} weight="duotone" className="text-accent" />
            <h3>近期需要关注的日程</h3>
          </div>
          <button className="btn-link" onClick={() => onNavigate("calendar")}>
            查看完整月历轨道 <CaretRight size={16} />
          </button>
        </div>

        <div className="upcoming-flow-list">
          {datedRecords.slice(0, 5).map((record) => {
            const isOverdue = record.daysLeft < 0;
            const isToday = record.daysLeft === 0;

            return (
              <div
                key={record.id}
                className="upcoming-row"
                onClick={() => onSelectRecord(record)}
              >
                <div className="upcoming-row__date">
                  <strong>{record.dueDate.slice(5)}</strong>
                  <span className={isOverdue ? "text-danger" : isToday ? "text-warning" : ""}>
                    {isOverdue ? `逾期 ${Math.abs(record.daysLeft)} 天` : isToday ? `今天` : `${record.daysLeft} 天后`}
                  </span>
                </div>

                <div className="upcoming-row__title">
                  <strong>{record.title}</strong>
                  <span>
                    {record.cycle ? `周期：${record.cycle}` : record.subtitle || "日程提醒"}
                    {record.amount ? ` · ${getCurrencySymbol(record.currency)}${record.amount}` : ""}
                  </span>
                </div>

                <div className="upcoming-row__action">
                  {record.cycle && record.cycle !== "一次性" && record.cycle !== "不设置" ? (
                    <button
                      className="btn-quick-action"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAdvanceRecord(record);
                      }}
                      title="完成本期并顺延至下一月"
                    >
                      完成续费
                    </button>
                  ) : null}
                  <CaretRight size={18} />
                </div>
              </div>
            );
          })}

          {datedRecords.length === 0 && (
            <div className="flow-empty">
              <CalendarBlank size={32} />
              <p>暂无临近排期的日程</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
