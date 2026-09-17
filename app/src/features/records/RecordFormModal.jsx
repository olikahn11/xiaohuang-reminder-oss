import React, { useState } from "react";
import {
  ArrowsClockwise,
  CalendarBlank,
  Check,
  CreditCard,
  Info,
  X,
} from "@phosphor-icons/react";
import {
  calculateNextDueDate,
  formatDateKey,
} from "../../utils/cycleUtils.js";
import { PRESET_REMINDER_OPTIONS, parseReminderDays } from "../../utils/reminderEngine.js";

const KINDS = [
  { key: "renewal", label: "订阅续费" },
  { key: "pending", label: "待办 / 待确认" },
  { key: "project", label: "项目工程" },
  { key: "account", label: "账号与绑定" },
  { key: "server", label: "服务器" },
  { key: "developer", label: "开发者资质" },
  { key: "custom", label: "自定义" },
];

export const CURRENCY_RATES = {
  CNY: { symbol: "¥", rate: 1, label: "人民币 (CNY)" },
  USD: { symbol: "$", rate: 7.24, label: "美元 (USD)" },
  EUR: { symbol: "€", rate: 7.82, label: "欧元 (EUR)" },
  JPY: { symbol: "¥", rate: 0.048, label: "日元 (JPY)" },
  GBP: { symbol: "£", rate: 9.15, label: "英镑 (GBP)" },
  HKD: { symbol: "HK$", rate: 0.93, label: "港币 (HKD)" },
  KRW: { symbol: "₩", rate: 0.0053, label: "韩元 (KRW)" },
};

export function RecordFormModal({
  initialRecord = null,
  defaultKind = "renewal",
  defaultDate = "",
  onClose,
  onSave,
}) {
  const todayStr = formatDateKey(
    new Date().getFullYear(),
    new Date().getMonth() + 1,
    new Date().getDate()
  );

  const [form, setForm] = useState(() => ({
    id: initialRecord?.id || "",
    kind: initialRecord?.kind || defaultKind,
    title: initialRecord?.title || "",
    subtitle: initialRecord?.subtitle || "",
    dueDate: initialRecord?.dueDate || defaultDate || todayStr,
    dueTime: initialRecord?.dueTime || "09:00",
    cycle: initialRecord?.cycle || (defaultKind === "renewal" ? "每月" : ""),
    currency: initialRecord?.currency || "CNY",
    amount: initialRecord?.amount || "",
    payment: initialRecord?.payment || "",
    account: initialRecord?.account || "",
    password: initialRecord?.password || "",
    url: initialRecord?.url || "",
    notes: initialRecord?.notes || "",
    reminders: parseReminderDays(initialRecord?.reminders || [7, 3, 1, 0]),
  }));

  const handleFieldChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const toggleReminderTag = (days) => {
    setForm((prev) => {
      const current = Array.isArray(prev.reminders) ? [...prev.reminders] : [];
      if (current.includes(days)) {
        return { ...prev, reminders: current.filter((d) => d !== days) };
      } else {
        return { ...prev, reminders: [...current, days].sort((a, b) => b - a) };
      }
    });
  };

  // 动态计算下一个周期的到期日预览
  const nextDueDatePreview = form.cycle && form.cycle !== "一次性" && form.cycle !== "不设置" && form.dueDate
    ? calculateNextDueDate(form.dueDate, form.cycle)
    : null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      alert("请输入名称 / 事项标题");
      return;
    }
    if (form.kind === "renewal") {
      if (!form.cycle || form.cycle === "不设置") {
        alert("续费项目必须设置一个周期（例如：每月、每年或一次性）");
        return;
      }
      if (!form.dueDate) {
        alert("续费项目必须填写到期日 / 下次扣费日");
        return;
      }
      if (!form.amount) {
        alert("续费项目必须填写费用金额");
        return;
      }
    }
    onSave({
      ...form,
      title: form.title.trim(),
      updatedAt: new Date().toISOString(),
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="record-form-modal content-surface"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={initialRecord ? "编辑记录" : "新建记录"}
      >
        <div className="modal-header">
          <div className="modal-title-wrap">
            <h2>{initialRecord ? "编辑记录" : "新建记录与提醒"}</h2>
            <p>填写信息后，系统将自动进行周期推算与全生命周期提醒调度</p>
          </div>
          <button className="btn-icon" onClick={onClose} aria-label="关闭窗口">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form-body">
          {/* 类型切换 Pills */}
          <div className="form-group">
            <label className="form-label">记录分类</label>
            <div className="kind-pills">
              {KINDS.map((k) => (
                <button
                  key={k.key}
                  type="button"
                  className={`kind-pill ${form.kind === k.key ? "active" : ""}`}
                  onClick={() => {
                    handleFieldChange("kind", k.key);
                    if (k.key === "renewal" && !form.cycle) {
                      handleFieldChange("cycle", "每月");
                    }
                  }}
                >
                  {k.label}
                </button>
              ))}
            </div>
          </div>

          {/* 标题 */}
          <div className="form-group">
            <label className="form-label">
              名称 / 事项标题 <span className="required-star">*</span>
            </label>
            <input
              type="text"
              required
              className="form-input"
              placeholder="例如：ChatGPT Plus 订阅、服务器到期、社保缴费……"
              value={form.title}
              onChange={(e) => handleFieldChange("title", e.target.value)}
            />
          </div>

          {/* 日期与时间 */}
          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label">
                到期 / 扣费日期
              </label>
              <input
                type="date"
                className="form-input"
                value={form.dueDate}
                onChange={(e) => handleFieldChange("dueDate", e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">提醒时间</label>
              <input
                type="time"
                className="form-input"
                value={form.dueTime}
                onChange={(e) => handleFieldChange("dueTime", e.target.value)}
              />
            </div>
          </div>

          {/* 计费周期与金额 */}
          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label">续费周期</label>
              <select
                className="form-select"
                value={form.cycle}
                onChange={(e) => handleFieldChange("cycle", e.target.value)}
              >
                <option value="">不设置（单次日程）</option>
                <option value="每月">每月续费（自动推期）</option>
                <option value="每两个月">每两个月续费（双月）</option>
                <option value="每季度">每季度续费（3个月）</option>
                <option value="每半年">每半年续费（6个月）</option>
                <option value="每年">每年续费</option>
                <option value="每周">每周</option>
                <option value="一次性">一次性</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">币种及费用金额</label>
              <div style={{ display: "flex", gap: "8px" }}>
                <select
                  className="form-input"
                  style={{ width: "120px" }}
                  value={form.currency || "CNY"}
                  onChange={(e) => handleFieldChange("currency", e.target.value)}
                >
                  {Object.keys(CURRENCY_RATES).map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  step="any"
                  className="form-input"
                  style={{ flex: 1 }}
                  placeholder="例如：128"
                  value={form.amount}
                  onChange={(e) => handleFieldChange("amount", e.target.value)}
                />
              </div>
              {form.currency && form.currency !== "CNY" && form.amount && (
                <small style={{ display: "block", marginTop: "4px", color: "var(--text-secondary)" }}>
                  参考折合：¥ {(parseFloat(form.amount) * CURRENCY_RATES[form.currency].rate).toFixed(2)} CNY
                </small>
              )}
            </div>
          </div>

          {/* 智能周期推期预览提示框：直观解答用户核心痛点 */}
          {nextDueDatePreview && (
            <div className="cycle-preview-box">
              <Info size={18} weight="duotone" className="text-accent" />
              <div>
                <strong>智能周期联动已就绪</strong>
                <p>
                  当前设置本期到期日为 <strong>{form.dueDate}</strong>；下期预计续费日为{" "}
                  <strong>{nextDueDatePreview}</strong>。月历与系统通知将自动跨月投影，无需重复新建！
                </p>
              </div>
            </div>
          )}

          {/* 提醒规则多选 */}
          <div className="form-group">
            <label className="form-label">提前提醒通知</label>
            <div className="reminder-tags-grid">
              {PRESET_REMINDER_OPTIONS.map((opt) => {
                const isSelected = form.reminders.includes(opt.days);
                return (
                  <button
                    key={opt.days}
                    type="button"
                    className={`reminder-tag ${isSelected ? "selected" : ""}`}
                    onClick={() => toggleReminderTag(opt.days)}
                  >
                    {isSelected && <Check size={14} weight="bold" />}
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 补充信息：账号、支付方式、链接、备注 */}
          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label">关联账号 / 平台</label>
              <input
                type="text"
                className="form-input"
                placeholder="可选，如账号或邮箱"
                value={form.account}
                onChange={(e) => handleFieldChange("account", e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">支付方式</label>
              <input
                type="text"
                className="form-input"
                placeholder="例如：App Store、招商银行卡……"
                value={form.payment}
                onChange={(e) => handleFieldChange("payment", e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">管理 / 续费跳转链接</label>
            <input
              type="url"
              className="form-input"
              placeholder="https://"
              value={form.url}
              onChange={(e) => handleFieldChange("url", e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">备注说明</label>
            <textarea
              className="form-textarea"
              rows={2}
              placeholder="补充套餐详情、注意事项或取消规则……"
              value={form.notes}
              onChange={(e) => handleFieldChange("notes", e.target.value)}
            />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              取消
            </button>
            <button type="submit" className="btn-primary-gradient">
              {initialRecord ? "保存修改" : "保存并开启提醒"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
