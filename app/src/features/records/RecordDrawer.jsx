import React, { useState } from "react";
import {
  ArrowsClockwise,
  CalendarBlank,
  Check,
  CheckCircle,
  Copy,
  CreditCard,
  Eye,
  EyeSlash,
  PencilSimple,
  Trash,
  X,
} from "@phosphor-icons/react";
import { calculateNextDueDate, getRemainingDays } from "../../utils/cycleUtils.js";

export function RecordDrawer({
  record,
  onClose,
  onEdit,
  onDelete,
  onAdvanceRecord,
  onMarkHandled,
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [copiedKey, setCopiedKey] = useState(null);

  if (!record) return null;

  const daysLeft = record.dueDate ? getRemainingDays(record.dueDate) : null;
  const isOverdue = daysLeft !== null && daysLeft < 0;
  const isRecurring = Boolean(record.cycle && record.cycle !== "一次性" && record.cycle !== "不设置");
  const nextProjectedDate = isRecurring
    ? calculateNextDueDate(record.dueDate, record.cycle, record.cycleAnchorDay)
    : null;

  const handleCopy = (text, key) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const history = Array.isArray(record.history) ? record.history : [];

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside
        className="record-drawer content-surface"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="记录详情"
      >
        {/* 抽屉头部 */}
        <div className="drawer-header">
          <div className="drawer-title-area">
            <span className="drawer-category-badge">{record.cycle || record.kind || "记录详情"}</span>
            <h2>{record.title}</h2>
            {record.subtitle && <p className="drawer-subtitle">{record.subtitle}</p>}
          </div>
          <button className="btn-icon" onClick={onClose} aria-label="关闭抽屉">
            <X size={20} />
          </button>
        </div>

        {/* 核心到期 / 续费操作横幅 */}
        {record.dueDate && (
          <div className={`drawer-status-card ${isOverdue ? "status-overdue" : "status-normal"}`}>
            <div className="status-card-main">
              <CalendarBlank size={24} weight="duotone" />
              <div>
                <strong>
                  {isOverdue ? `已逾期 ${Math.abs(daysLeft)} 天` : daysLeft === 0 ? "今天到期" : `剩余 ${daysLeft} 天到期`}
                </strong>
                <small>到期日：{record.dueDate} {record.dueTime || "09:00"}</small>
              </div>
            </div>

            {isRecurring ? (
              <div className="drawer-recur-action">
                <button
                  className="btn-primary-gradient"
                  onClick={() => onAdvanceRecord(record)}
                >
                  <ArrowsClockwise size={18} weight="bold" />
                  <span>完成本期续费</span>
                </button>
                <small className="next-projected-hint">
                  点击后到期日将顺延至：<strong>{nextProjectedDate}</strong>，并记录续费账单
                </small>
              </div>
            ) : (
              <button
                className="btn-primary-gradient"
                onClick={() => onMarkHandled(record.id)}
              >
                <CheckCircle size={18} weight="bold" />
                <span>标记处理完成</span>
              </button>
            )}
          </div>
        )}

        <div className="drawer-body">
          {/* 详细字段展示 */}
          <div className="drawer-field-group">
            <h4 className="field-group-title">基本信息</h4>

            <div className="detail-field-row">
              <span className="field-label">计费周期</span>
              <span className="field-val">{record.cycle || "一次性 / 未设周期"}</span>
            </div>

            {record.amount && (
              <div className="detail-field-row">
                <span className="field-label">金额 / 费用</span>
                <span className="field-val highlight-val">¥{record.amount}</span>
              </div>
            )}

            {record.payment && (
              <div className="detail-field-row">
                <span className="field-label">支付方式</span>
                <span className="field-val">{record.payment}</span>
              </div>
            )}

            {record.account && (
              <div className="detail-field-row">
                <span className="field-label">登录账号</span>
                <div className="field-val-with-copy">
                  <span>{record.account}</span>
                  <button
                    className="copy-btn"
                    onClick={() => handleCopy(record.account, "account")}
                    title="复制账号"
                  >
                    {copiedKey === "account" ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
            )}

            {record.password && (
              <div className="detail-field-row">
                <span className="field-label">密码 / 凭据</span>
                <div className="field-val-with-copy">
                  <span className="masked-pwd">
                    {showPassword ? record.password : "••••••••••••"}
                  </span>
                  <button
                    className="copy-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    title={showPassword ? "隐藏" : "显示"}
                  >
                    {showPassword ? <EyeSlash size={14} /> : <Eye size={14} />}
                  </button>
                  <button
                    className="copy-btn"
                    onClick={() => handleCopy(record.password, "password")}
                    title="复制密码"
                  >
                    {copiedKey === "password" ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
            )}

            {record.url && (
              <div className="detail-field-row">
                <span className="field-label">链接地址</span>
                <a
                  href={record.url}
                  target="_blank"
                  rel="noreferrer"
                  className="link-out"
                >
                  {record.url}
                </a>
              </div>
            )}

            {record.notes && (
              <div className="detail-field-block">
                <span className="field-label">备注说明</span>
                <p className="field-notes-text">{record.notes}</p>
              </div>
            )}
          </div>

          {/* 续费历史时间线：严格满足用户“必须保持我现在录入的历史” */}
          <div className="drawer-field-group">
            <h4 className="field-group-title">
              <span>续费与履约历史</span>
              <span className="history-count-tag">{history.length} 次</span>
            </h4>

            {history.length > 0 ? (
              <div className="history-timeline">
                {history.map((h, i) => (
                  <div key={h.id || i} className="timeline-item">
                    <div className="timeline-dot" />
                    <div className="timeline-content">
                      <div className="timeline-date">
                        <strong>{h.date}</strong>
                        {h.amount && <span className="timeline-amount">¥{h.amount}</span>}
                      </div>
                      <p className="timeline-note">{h.note || "完成续费"}</p>
                      {h.renewedAt && (
                        <small className="timeline-ts">
                          处理时间：{new Date(h.renewedAt).toLocaleString("zh-CN")}
                        </small>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="history-empty">
                <p>暂无续费历史</p>
                <small>每次点击“完成本期续费”后会自动在这里永久留存记录</small>
              </div>
            )}
          </div>
        </div>

        {/* 抽屉底部操作条 */}
        <div className="drawer-footer">
          <button
            className="btn-danger-ghost"
            onClick={() => {
              if (window.confirm(`确定要删除“${record.title}”吗？此操作无法撤销。`)) {
                onDelete(record.id);
              }
            }}
          >
            <Trash size={16} />
            <span>删除记录</span>
          </button>

          <button className="btn-secondary" onClick={() => onEdit(record)}>
            <PencilSimple size={16} />
            <span>编辑内容</span>
          </button>
        </div>
      </aside>
    </div>
  );
}
