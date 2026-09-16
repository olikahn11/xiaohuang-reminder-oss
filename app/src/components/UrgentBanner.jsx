import React from "react";
import {
  ArrowsClockwise,
  Check,
  ClockCountdown,
  WarningCircle,
} from "@phosphor-icons/react";
import { getUrgentSummary } from "../utils/reminderEngine.js";

export function UrgentBanner({ records, onSelectRecord, onAdvanceRecord }) {
  const { overdue, today } = getUrgentSummary(records);

  if (overdue.length === 0 && today.length === 0) {
    return null;
  }

  return (
    <div className="urgent-banner">
      <div className="urgent-banner__indicator">
        {overdue.length > 0 ? (
          <WarningCircle size={22} weight="fill" className="text-danger" />
        ) : (
          <ClockCountdown size={22} weight="fill" className="text-warning" />
        )}
      </div>

      <div className="urgent-banner__content">
        <h4>
          {overdue.length > 0
            ? `${overdue.length} 项已逾期待处理`
            : `${today.length} 项今天到期`}
        </h4>
        <p>
          {overdue.length > 0
            ? `最早已逾期：${overdue[0].title}（${overdue[0].dueDate}）`
            : `今日事项：${today[0].title}`}
        </p>
      </div>

      <div className="urgent-banner__actions">
        {overdue.length > 0 ? (
          <button
            className="urgent-action-btn urgent-action-btn--danger"
            onClick={() => onSelectRecord(overdue[0])}
          >
            立即查看处理
          </button>
        ) : (
          <button
            className="urgent-action-btn urgent-action-btn--warning"
            onClick={() => onSelectRecord(today[0])}
          >
            查看今日日程
          </button>
        )}
      </div>
    </div>
  );
}
