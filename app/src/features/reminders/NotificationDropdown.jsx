import React from "react";
import {
  Bell,
  BellRinging,
  CalendarBlank,
  CaretRight,
  CheckCircle,
  ClockCountdown,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { getUrgentSummary } from "../../utils/reminderEngine.js";

export function NotificationDropdown({
  records,
  onClose,
  onSelectRecord,
  onAdvanceRecord,
  onRequestPermission,
  permissionGranted,
}) {
  const { overdue, today, upcoming, totalUrgentCount } = getUrgentSummary(records);

  return (
    <div className="notif-dropdown-overlay" onClick={onClose}>
      <div
        className="notif-dropdown content-surface"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="提醒通知中心"
      >
        <div className="notif-dropdown__head">
          <div className="notif-dropdown__title">
            <BellRinging size={20} weight="fill" className="text-accent" />
            <span>提醒通知中心</span>
            {totalUrgentCount > 0 && (
              <span className="notif-badge">{totalUrgentCount}</span>
            )}
          </div>
          <button className="icon-button-sm" onClick={onClose} aria-label="关闭">
            <X size={16} />
          </button>
        </div>

        {!permissionGranted && (
          <div className="notif-permission-alert">
            <span>系统通知未授权，点击开启桌面提醒：</span>
            <button
              className="notif-permission-btn"
              onClick={onRequestPermission}
            >
              开启通知
            </button>
          </div>
        )}

        <div className="notif-dropdown__body">
          {totalUrgentCount === 0 ? (
            <div className="notif-empty">
              <CheckCircle size={32} weight="duotone" className="text-success" />
              <p>暂无待处理或即将到期的提醒</p>
              <small>所有日程与续费均处于安全期</small>
            </div>
          ) : (
            <>
              {/* 已逾期 */}
              {overdue.length > 0 && (
                <div className="notif-group">
                  <div className="notif-group__title text-danger">
                    <WarningCircle size={16} weight="fill" />
                    <span>已逾期待处理 ({overdue.length})</span>
                  </div>
                  {overdue.map((record) => (
                    <div
                      key={record.id}
                      className="notif-item notif-item--overdue"
                      onClick={() => {
                        onSelectRecord(record);
                        onClose();
                      }}
                    >
                      <div className="notif-item__info">
                        <strong>{record.title}</strong>
                        <span>
                          逾期 {Math.abs(record.daysLeft)} 天 · 到期日：{record.dueDate}
                          {record.amount ? ` · ¥${record.amount}` : ""}
                        </span>
                      </div>
                      <div className="notif-item__action">
                        {record.cycle && record.cycle !== "一次性" && record.cycle !== "不设置" ? (
                          <button
                            className="btn-quick-renew"
                            onClick={(e) => {
                              e.stopPropagation();
                              onAdvanceRecord(record);
                            }}
                            title="完成本期续费并顺延到下一周期"
                          >
                            完成续费
                          </button>
                        ) : (
                          <CaretRight size={16} />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 今日到期 */}
              {today.length > 0 && (
                <div className="notif-group">
                  <div className="notif-group__title text-warning">
                    <ClockCountdown size={16} weight="fill" />
                    <span>今天需要处理 ({today.length})</span>
                  </div>
                  {today.map((record) => (
                    <div
                      key={record.id}
                      className="notif-item notif-item--today"
                      onClick={() => {
                        onSelectRecord(record);
                        onClose();
                      }}
                    >
                      <div className="notif-item__info">
                        <strong>{record.title}</strong>
                        <span>
                          今天到期 · {record.dueTime || "全天"}
                          {record.amount ? ` · ¥${record.amount}` : ""}
                        </span>
                      </div>
                      <div className="notif-item__action">
                        {record.cycle && record.cycle !== "一次性" && record.cycle !== "不设置" ? (
                          <button
                            className="btn-quick-renew"
                            onClick={(e) => {
                              e.stopPropagation();
                              onAdvanceRecord(record);
                            }}
                          >
                            完成续费
                          </button>
                        ) : (
                          <CaretRight size={16} />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 3天内到期 */}
              {upcoming.length > 0 && (
                <div className="notif-group">
                  <div className="notif-group__title text-accent">
                    <CalendarBlank size={16} weight="fill" />
                    <span>即将到期 ({upcoming.length})</span>
                  </div>
                  {upcoming.map((record) => (
                    <div
                      key={record.id}
                      className="notif-item"
                      onClick={() => {
                        onSelectRecord(record);
                        onClose();
                      }}
                    >
                      <div className="notif-item__info">
                        <strong>{record.title}</strong>
                        <span>
                          剩余 {record.daysLeft} 天 ({record.dueDate})
                          {record.amount ? ` · ¥${record.amount}` : ""}
                        </span>
                      </div>
                      <CaretRight size={16} />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
