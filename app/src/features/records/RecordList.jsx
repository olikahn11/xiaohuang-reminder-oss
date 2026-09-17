import React, { useMemo, useState } from "react";
import {
  ArrowsClockwise,
  CalendarBlank,
  CaretRight,
  CheckCircle,
  ClockCountdown,
  Coins,
  CreditCard,
  CurrencyCny,
  DeviceMobile,
  FileText,
  FolderSimple,
  HardDrives,
  IdentificationBadge,
  MagnifyingGlass,
  Plus,
  Rocket,
  Tag,
  User,
  WarningCircle,
} from "@phosphor-icons/react";
import { getRemainingDays } from "../../utils/cycleUtils.js";
import { getCurrencySymbol } from "../../utils/currencyUtils.js";

const ASSET_KINDS = [
  { key: "all", label: "全部资产", icon: FolderSimple },
  { key: "project", label: "项目工程", icon: FolderSimple },
  { key: "account", label: "账号与绑定", icon: User },
  { key: "server", label: "服务器资源", icon: HardDrives },
  { key: "developer", label: "开发者资质", icon: IdentificationBadge },
  { key: "publish", label: "发布记录", icon: Rocket },
  { key: "custom", label: "自定义资产", icon: Tag },
];

function getKindIcon(kind) {
  switch (kind) {
    case "renewal":
      return <CreditCard size={16} weight="duotone" />;
    case "project":
      return <FolderSimple size={16} weight="duotone" />;
    case "account":
      return <User size={16} weight="duotone" />;
    case "server":
      return <HardDrives size={16} weight="duotone" />;
    case "developer":
      return <IdentificationBadge size={16} weight="duotone" />;
    case "publish":
      return <Rocket size={16} weight="duotone" />;
    default:
      return <Tag size={16} weight="duotone" />;
  }
}

function getKindLabel(kind) {
  switch (kind) {
    case "renewal":
      return "订阅续费";
    case "pending":
      return "待办事项";
    case "project":
      return "项目工程";
    case "account":
      return "账号绑定";
    case "server":
      return "服务器";
    case "developer":
      return "资质证照";
    case "publish":
      return "应用发布";
    default:
      return "资产记录";
  }
}

export function RecordList({
  records,
  viewType = "renewal", // "renewal" | "pending" | "assets"
  onSelectRecord,
  onAdvanceRecord,
  onAddRecord,
}) {
  const [statusFilter, setStatusFilter] = useState("active"); // "all" | "active" | "urgent" | "handled"
  const [assetKindFilter, setAssetKindFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  // 各资产类别的记录数统计
  const assetCounts = useMemo(() => {
    const counts = { all: 0 };
    for (const r of records) {
      if (r.kind !== "renewal" && r.kind !== "pending") {
        counts.all += 1;
        counts[r.kind] = (counts[r.kind] || 0) + 1;
      }
    }
    return counts;
  }, [records]);

  // 记录筛选
  const filteredRecords = useMemo(() => {
    return records
      .filter((record) => {
        // 视图类型过滤
        if (viewType === "renewal") {
          if (record.kind !== "renewal" && !record.cycle) return false;
        } else if (viewType === "pending") {
          if (record.kind !== "pending" && Boolean(record.cycle)) return false;
        } else if (viewType === "assets") {
          if (assetKindFilter !== "all") {
            if (record.kind !== assetKindFilter) return false;
          } else {
            // "all" assets: 显示非单纯续费/待办的资产，或者所有记录
            if (record.kind === "renewal" || record.kind === "pending") return false;
          }
        }

        // 状态过滤
        if (statusFilter === "active") {
          if (record.status === "handled" || record.status === "cancelled" || record.status === "archived") {
            return false;
          }
        } else if (statusFilter === "urgent") {
          if (!record.dueDate || record.status === "handled") return false;
          const days = getRemainingDays(record.dueDate);
          if (days > 7) return false;
        } else if (statusFilter === "handled") {
          if (record.status !== "handled") return false;
        }

        // 搜索关键词过滤
        if (searchTerm.trim()) {
          const term = searchTerm.toLowerCase();
          const matchTitle = record.title?.toLowerCase().includes(term);
          const matchSubtitle = record.subtitle?.toLowerCase().includes(term);
          const matchNotes = record.notes?.toLowerCase().includes(term);
          const matchAccount = record.account?.toLowerCase().includes(term);
          if (!matchTitle && !matchSubtitle && !matchNotes && !matchAccount) return false;
        }

        return true;
      })
      .map((r) => ({
        ...r,
        daysLeft: r.dueDate ? getRemainingDays(r.dueDate) : null,
      }))
      .sort((a, b) => {
        if (a.daysLeft !== null && b.daysLeft !== null) {
          return a.daysLeft - b.daysLeft;
        }
        return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
      });
  }, [records, viewType, statusFilter, assetKindFilter, searchTerm]);

  const viewTitle =
    viewType === "renewal"
      ? "周期性续费与订阅"
      : viewType === "pending"
      ? "单次待办与到期提醒"
      : "数字资产与全生命周期";

  const addLabel =
    viewType === "renewal"
      ? "新增续费"
      : viewType === "pending"
      ? "新增待办"
      : "新增资产";

  return (
    <div className="unified-record-list">
      {/* 头部控制栏 */}
      <div className="list-toolbar">
        <div className="list-header-title-row">
          <div>
            <h2>{viewTitle}</h2>
            <span className="list-subtitle-badge">
              共 {filteredRecords.length} 项记录
            </span>
          </div>

          <button
            className="btn-primary-gradient add-record-btn"
            onClick={() =>
              onAddRecord?.(
                viewType === "renewal"
                  ? "renewal"
                  : viewType === "pending"
                  ? "pending"
                  : assetKindFilter !== "all"
                  ? assetKindFilter
                  : "project"
              )
            }
          >
            <Plus size={16} weight="bold" />
            <span>{addLabel}</span>
          </button>
        </div>

        {/* 资产专属：横向平滑滚动药丸胶囊 */}
        {viewType === "assets" && (
          <div className="asset-pills-scroll-container">
            <div className="asset-pills-row">
              {ASSET_KINDS.map((item) => {
                const IconComponent = item.icon;
                const count = item.key === "all" ? (assetCounts.all || 0) : (assetCounts[item.key] || 0);
                return (
                  <button
                    key={item.key}
                    className={`asset-pill ${assetKindFilter === item.key ? "active" : ""}`}
                    onClick={() => setAssetKindFilter(item.key)}
                  >
                    <IconComponent size={14} weight={assetKindFilter === item.key ? "bold" : "regular"} />
                    <span>{item.label}</span>
                    <span className="asset-pill-count">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 状态与搜索栏 */}
        <div className="list-filters-bar">
          <div className="status-tabs-scroll">
            <div className="status-tabs">
              <button
                className={`status-tab ${statusFilter === "active" ? "active" : ""}`}
                onClick={() => setStatusFilter("active")}
              >
                进行中
              </button>
              {viewType !== "assets" && (
                <button
                  className={`status-tab ${statusFilter === "urgent" ? "active" : ""}`}
                  onClick={() => setStatusFilter("urgent")}
                >
                  临近/已逾期
                </button>
              )}
              <button
                className={`status-tab ${statusFilter === "handled" ? "active" : ""}`}
                onClick={() => setStatusFilter("handled")}
              >
                已处理
              </button>
              <button
                className={`status-tab ${statusFilter === "all" ? "active" : ""}`}
                onClick={() => setStatusFilter("all")}
              >
                全部
              </button>
            </div>
          </div>

          <div className="list-search-box">
            <MagnifyingGlass size={16} />
            <input
              type="text"
              placeholder="搜索名称、账号、备注..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* 核心数据展示：移动端专属波普 Bento 票据卡片流 */}
      <div className="record-cards-stream mobile-cards-only">
        {filteredRecords.length > 0 ? (
          filteredRecords.map((record) => {
            const isOverdue = record.daysLeft !== null && record.daysLeft < 0;
            const isToday = record.daysLeft === 0;
            const isUrgent = record.daysLeft !== null && record.daysLeft > 0 && record.daysLeft <= 7;

            return (
              <div
                key={record.id}
                className="record-bento-card"
                onClick={() => onSelectRecord(record)}
              >
                {/* 卡片头部：左侧分类/周期徽章，右侧到期倒计时 */}
                <div className="record-bento-card__header">
                  <div className="record-bento-card__badge-group">
                    <span className="bento-badge-kind">
                      {getKindIcon(record.kind)}
                      <span>{getKindLabel(record.kind)}</span>
                    </span>
                    {record.cycle && record.cycle !== "一次性" && (
                      <span className="bento-badge-cycle">🔄 {record.cycle}</span>
                    )}
                  </div>

                  {record.daysLeft !== null ? (
                    <span
                      className={`bento-days-pill ${
                        isOverdue
                          ? "pill-overdue"
                          : isToday
                          ? "pill-today"
                          : isUrgent
                          ? "pill-urgent"
                          : "pill-normal"
                      }`}
                    >
                      {isOverdue
                        ? `逾期 ${Math.abs(record.daysLeft)} 天`
                        : isToday
                        ? "今天到期"
                        : `${record.daysLeft} 天后到期`}
                    </span>
                  ) : (
                    <span className="bento-days-pill pill-neutral">永久/无到期</span>
                  )}
                </div>

                {/* 卡片核心主体：标题与账号 */}
                <div className="record-bento-card__body">
                  <h3 className="bento-card-title">{record.title}</h3>
                  {record.subtitle && (
                    <p className="bento-card-subtitle">{record.subtitle}</p>
                  )}
                  {record.account && (
                    <div className="bento-card-account">
                      <User size={13} />
                      <span>{record.account}</span>
                    </div>
                  )}
                </div>

                {/* 卡片底部：费用、到期时间与快捷操作 */}
                <div className="record-bento-card__footer" onClick={(e) => e.stopPropagation()}>
                  <div className="bento-footer-left">
                    {record.amount ? (
                      <div className="bento-amount-box">
                        <span className="bento-amount-currency">{getCurrencySymbol(record.currency)}</span>
                        <strong className="bento-amount-num">{record.amount}</strong>
                        {record.cycle && <small>/{record.cycle}</small>}
                      </div>
                    ) : (
                      <div className="bento-date-info">
                        <CalendarBlank size={14} />
                        <span>{record.dueDate || "无设定"}</span>
                      </div>
                    )}
                    {record.amount && record.dueDate && (
                      <div className="bento-date-sub">
                        <span>{record.dueDate} 到期</span>
                      </div>
                    )}
                  </div>

                  <div className="bento-footer-actions">
                    {record.cycle && record.cycle !== "一次性" && record.cycle !== "不设置" && (
                      <button
                        className="btn-bento-renew"
                        onClick={() => onAdvanceRecord?.(record)}
                        title="完成本期并推至下一周期"
                      >
                        <ArrowsClockwise size={14} weight="bold" />
                        <span>续费下月</span>
                      </button>
                    )}
                    <button
                      className="btn-bento-detail"
                      onClick={() => onSelectRecord(record)}
                    >
                      <span>详情</span>
                      <CaretRight size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="records-empty">
            <CheckCircle size={40} weight="duotone" />
            <p>暂无符合筛选条件的记录</p>
            <small>可切换上方分类或状态，或点击右上角新增。</small>
          </div>
        )}
      </div>

      {/* 桌面端：保留整齐清晰的桌面表格 */}
      <div className="records-table-wrapper desktop-table-only">
        <div className="records-table-header">
          <span className="col-main">名称 / 服务</span>
          <span className="col-cycle">周期 / 类型</span>
          <span className="col-date">到期日</span>
          <span className="col-days">剩余时间</span>
          <span className="col-amount">费用</span>
          <span className="col-actions">操作</span>
        </div>

        <div className="records-table-body">
          {filteredRecords.length > 0 ? (
            filteredRecords.map((record) => {
              const isOverdue = record.daysLeft !== null && record.daysLeft < 0;
              const isToday = record.daysLeft === 0;
              const isUrgent = record.daysLeft !== null && record.daysLeft > 0 && record.daysLeft <= 7;

              return (
                <div
                  key={record.id}
                  className="records-table-row"
                  onClick={() => onSelectRecord(record)}
                >
                  <div className="col-main">
                    <strong className="record-row-title">{record.title}</strong>
                    {record.subtitle && (
                      <span className="record-row-subtitle">{record.subtitle}</span>
                    )}
                    {record.account && (
                      <span className="record-row-account">账号：{record.account}</span>
                    )}
                  </div>

                  <div className="col-cycle">
                    <span className="cycle-badge">
                      {record.cycle || getKindLabel(record.kind)}
                    </span>
                  </div>

                  <div className="col-date">
                    <span>{record.dueDate || "未设置"}</span>
                    {record.dueTime && <small>{record.dueTime}</small>}
                  </div>

                  <div className="col-days">
                    {record.daysLeft !== null ? (
                      <span
                        className={`days-tag ${
                          isOverdue
                            ? "tag-overdue"
                            : isToday
                            ? "tag-today"
                            : isUrgent
                            ? "tag-urgent"
                            : "tag-normal"
                        }`}
                      >
                        {isOverdue
                          ? `逾期 ${Math.abs(record.daysLeft)} 天`
                          : isToday
                          ? "今天到期"
                          : `${record.daysLeft} 天`}
                      </span>
                    ) : (
                      <span className="text-muted">-</span>
                    )}
                  </div>

                  <div className="col-amount">
                    {record.amount ? (
                      <span className="amount-text">{getCurrencySymbol(record.currency)}{record.amount}</span>
                    ) : (
                      <span className="text-muted">-</span>
                    )}
                  </div>

                  <div className="col-actions" onClick={(e) => e.stopPropagation()}>
                    {record.cycle && record.cycle !== "一次性" && record.cycle !== "不设置" ? (
                      <button
                        className="btn-quick-renew-table"
                        onClick={() => onAdvanceRecord(record)}
                        title="完成本期并顺延至下一周期"
                      >
                        <ArrowsClockwise size={14} />
                        <span>续费下月</span>
                      </button>
                    ) : null}
                    <button
                      className="btn-icon-table"
                      title="查看详情"
                      onClick={() => onSelectRecord(record)}
                    >
                      <CaretRight size={16} />
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="records-empty">
              <CheckCircle size={36} weight="duotone" />
              <p>暂无符合筛选条件的记录</p>
              <small>可以尝试切换上方状态标签，或直接点击新增。</small>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}



