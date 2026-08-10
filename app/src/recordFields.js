export const FORM_DEFAULTS = {
  title: "",
  subtitle: "",
  dueDate: "",
  dueTime: "09:00",
  amount: "",
  cycle: "",
  status: "active",
  account: "",
  password: "",
  email: "",
  phone: "",
  identity: "",
  project: "",
  payment: "",
  reminders: "到期前 7 天、3 天、1 天",
  url: "",
  notes: "",
  traditionMatter: "",
  participants: "",
  location: "",
  traditionSource: "当前通用算法（默认）",
  realWorldConstraints: "",
  customFields: [],
};

const status = (options, defaultValue) => ({ key: "status", label: "状态", type: "select", options, defaultValue });
const dateTime = (dateLabel = "日期", timeLabel = "具体时间") => [
  { key: "dueDate", label: dateLabel, type: "date" },
  { key: "dueTime", label: timeLabel, type: "time" },
];
const reminders = { key: "reminders", label: "提醒设置", wide: true, placeholder: "例如：提前 7 天、3 天、1 天" };
const notes = (placeholder) => ({ key: "notes", label: "备注", type: "textarea", wide: true, placeholder });

export const RECORD_FORM_CONFIG = {
  project: {
    titleLabel: "项目名称",
    titlePlaceholder: "例如：小黄天气 App",
    helper: "管理项目目标、负责人、节点与入口。",
    fields: [
      { key: "subtitle", label: "项目说明", wide: true, placeholder: "这个项目要完成什么" },
      { key: "identity", label: "负责人 / 主体", placeholder: "个人、团队或公司" },
      status([["active", "进行中"], ["planned", "计划中"], ["paused", "已暂停"], ["completed", "已完成"]], "active"),
      ...dateTime("目标日期", "目标时间"),
      { key: "url", label: "项目入口", type: "url", wide: true, placeholder: "https://" },
      notes("项目目标、阶段、协作说明……"),
    ],
  },
  account: {
    titleLabel: "平台 / 服务名称",
    titlePlaceholder: "例如：GitHub、Apple ID",
    helper: "集中记录登录方式、绑定信息与安全状态。",
    fields: [
      { key: "account", label: "登录账号", placeholder: "用户名或账号" },
      { key: "password", label: "密码 / API Key", type: "password", placeholder: "可留空，默认不进入备份" },
      { key: "email", label: "绑定邮箱", type: "email", placeholder: "可选" },
      { key: "phone", label: "绑定手机号", placeholder: "可选" },
      { key: "identity", label: "登录身份 / 主体", placeholder: "个人、企业或管理员" },
      status([["secure", "已保护"], ["active", "正常使用"], ["verifying", "验证中"], ["disabled", "已停用"]], "secure"),
      { key: "project", label: "关联项目", wide: true, placeholder: "这个账号服务于哪个项目" },
      { key: "url", label: "登录 / 管理地址", type: "url", wide: true, placeholder: "https://" },
      notes("二次验证、恢复方式、用途说明……"),
    ],
  },
  renewal: {
    titleLabel: "订阅 / 服务名称",
    titlePlaceholder: "例如：iCloud+、服务器年费",
    helper: "只显示续费真正需要的日期、金额、周期和付款信息。",
    fields: [
      ...dateTime("续费 / 到期日期", "扣款时间"),
      { key: "amount", label: "费用（元）", type: "number", placeholder: "128" },
      { key: "cycle", label: "计费周期", type: "select", options: [["", "不设置"], ["每月", "每月"], ["每季度", "每季度"], ["每年", "每年"], ["一次性", "一次性"]] },
      { key: "payment", label: "付款方式", placeholder: "银行卡、App Store、支付宝……" },
      status([["normal", "正常"], ["due", "即将到期"], ["handled", "已续费"], ["cancelled", "已取消"]], "normal"),
      { key: "account", label: "订阅账号", placeholder: "账号或遮挡后的邮箱" },
      { key: "project", label: "关联项目", placeholder: "可选" },
      reminders,
      { key: "url", label: "续费 / 管理链接", type: "url", wide: true, placeholder: "https://" },
      notes("套餐、自动续费规则、发票等信息……"),
    ],
  },
  server: {
    titleLabel: "服务器 / 主机名称",
    titlePlaceholder: "例如：香港生产服务器",
    helper: "记录服务商、登录凭据、到期和运维信息。",
    fields: [
      { key: "identity", label: "服务商 / 区域", placeholder: "例如：阿里云 · 香港" },
      { key: "account", label: "登录账号 / IP", placeholder: "账号、IP 或实例 ID" },
      { key: "password", label: "密码 / 密钥", type: "password", placeholder: "可留空，默认不进入备份" },
      status([["active", "运行中"], ["maintenance", "维护中"], ["due", "即将到期"], ["stopped", "已停用"]], "active"),
      ...dateTime("到期日期", "提醒时间"),
      { key: "amount", label: "费用（元）", type: "number", placeholder: "可选" },
      { key: "cycle", label: "计费周期", type: "select", options: [["", "不设置"], ["每月", "每月"], ["每季度", "每季度"], ["每年", "每年"]] },
      { key: "project", label: "承载项目", wide: true, placeholder: "服务器承载哪些项目" },
      reminders,
      { key: "url", label: "控制台地址", type: "url", wide: true, placeholder: "https://" },
      notes("配置、备份、运维窗口等信息……"),
    ],
  },
  developer: {
    titleLabel: "资质 / 证书名称",
    titlePlaceholder: "例如：Apple Developer Program",
    helper: "管理开发者账号、证书、主体和有效期。",
    fields: [
      { key: "identity", label: "资质主体", placeholder: "个人或公司主体" },
      { key: "account", label: "开发者账号", placeholder: "账号或 Team ID" },
      { key: "password", label: "密码 / 私钥信息", type: "password", placeholder: "可留空，默认不进入备份" },
      { key: "email", label: "联系邮箱", type: "email", placeholder: "可选" },
      ...dateTime("到期日期", "提醒时间"),
      { key: "amount", label: "费用（元）", type: "number", placeholder: "可选" },
      status([["active", "有效"], ["due", "即将到期"], ["verifying", "审核中"], ["expired", "已过期"]], "active"),
      { key: "project", label: "关联应用 / 项目", wide: true, placeholder: "关联哪些应用" },
      reminders,
      { key: "url", label: "开发者后台", type: "url", wide: true, placeholder: "https://" },
      notes("证书、描述文件、续期条件等信息……"),
    ],
  },
  publish: {
    titleLabel: "发布内容 / 版本",
    titlePlaceholder: "例如：iOS 1.2.0 发布",
    helper: "记录发布平台、审核节点、版本和上线结果。",
    fields: [
      { key: "subtitle", label: "发布说明", wide: true, placeholder: "本次发布包含什么" },
      { key: "project", label: "发布平台 / 项目", placeholder: "App Store、公众号、网站……" },
      { key: "identity", label: "提交 / 审核主体", placeholder: "负责人或审核方" },
      ...dateTime("计划 / 实际发布日期", "发布时间"),
      status([["draft", "草稿"], ["review", "审核中"], ["published", "已发布"], ["rejected", "被退回"]], "draft"),
      { key: "url", label: "发布地址", type: "url", wide: true, placeholder: "https://" },
      notes("版本号、审核意见、回滚方案……"),
    ],
  },
  pending: {
    titleLabel: "待办 / 待确认事项",
    titlePlaceholder: "例如：确认审核结果",
    helper: "聚焦负责人、截止时间、关联项目和提醒。",
    fields: [
      { key: "subtitle", label: "要做什么", wide: true, placeholder: "写清下一步动作或等待结果" },
      { key: "identity", label: "负责人 / 待确认方", placeholder: "谁来处理或回复" },
      { key: "project", label: "关联项目", placeholder: "可选" },
      ...dateTime("截止 / 查看日期", "提醒时间"),
      status([["pending", "待处理"], ["review", "等待确认"], ["handled", "已完成"], ["cancelled", "已取消"]], "pending"),
      reminders,
      { key: "url", label: "相关链接", type: "url", wide: true, placeholder: "https://" },
      notes("所需资料、确认标准、后续安排……"),
    ],
  },
  almanac: {
    titleLabel: "传统事项名称",
    titlePlaceholder: "例如：婚礼仪式、搬家入宅",
    helper: "黄历宜忌属于传统民俗参考，不替代天气、健康、法律和现实安排。",
    fields: [
      { key: "traditionMatter", label: "事项类别", type: "select", options: [["", "请选择"], ["嫁娶", "嫁娶 / 婚礼"], ["订婚", "订婚 / 纳采"], ["丧葬", "丧葬 / 追思"], ["祭祀", "祭祀 / 纪念"], ["搬家", "搬家 / 入宅"], ["开业", "开业 / 交易"], ["动土", "动土 / 装修"], ["安床", "安床"], ["出行", "出行"], ["签约", "签约"], ["其他", "其他"]] },
      { key: "traditionSource", label: "参考口径 / 典籍线索", type: "select", options: [["当前通用算法（默认）", "当前通用算法（默认）"], ["钦定协纪辨方书", "《钦定协纪辨方书》官修框架"], ["鳌头通书", "《鳌头通书》民间通书"], ["象吉通书", "《象吉通书》应用体系"], ["玉匣记", "《玉匣记》民俗口径"], ["家中习俗", "家中习俗 / 家传本"], ["当地通胜", "当地通胜"], ["专业人士建议", "专业人士建议"], ["其他", "其他"]] },
      ...dateTime("查看 / 计划日期", "计划时间"),
      { key: "participants", label: "相关人员", placeholder: "可只写称呼，不填敏感身份信息" },
      { key: "location", label: "地点 / 城市", placeholder: "无需填写精确门牌" },
      { key: "project", label: "关联项目 / 家庭事项", wide: true, placeholder: "可选" },
      { key: "realWorldConstraints", label: "现实限制与优先条件", type: "textarea", wide: true, placeholder: "天气、交通、健康、合同、场地和家人时间等应优先考虑" },
      status([["planned", "计划中"], ["confirmed", "已确认"], ["handled", "已完成"], ["cancelled", "已取消"]], "planned"),
      reminders,
      notes("家中习俗、仪式安排或需要确认的细节……"),
    ],
  },
};

export function defaultStatusForKind(kind) {
  const field = RECORD_FORM_CONFIG[kind]?.fields.find((item) => item.key === "status");
  return field?.defaultValue || "active";
}

export function fieldsForKind(kind) {
  return RECORD_FORM_CONFIG[kind]?.fields || RECORD_FORM_CONFIG.account.fields;
}
