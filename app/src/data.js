export const INITIAL_RECORDS = [];

// IDs from pre-production builds are retained only so upgrades can remove the
// records that those builds seeded into local storage or encrypted sync data.
export const LEGACY_DEMO_IDS = new Set([
  "renewal-apple",
  "renewal-football-api",
  "renewal-server-hk",
  "pending-mini-review",
  "pending-video-review",
  "pending-domain",
  "project-xuguang",
  "project-shiyongji",
  "account-github",
  "account-google",
  "server-api",
  "developer-android",
  "publish-article",
]);

export const NAVIGATION = [
  { label: "首页", kind: "overview", icon: "home" },
  { label: "总览", kind: "hub", icon: "overview" },
  { label: "项目", kind: "project", icon: "project" },
  { label: "账号与绑定", kind: "account", icon: "account" },
  { label: "订阅续费", kind: "renewal", icon: "renewal" },
  { label: "服务器", kind: "server", icon: "server" },
  { label: "开发者资质", kind: "developer", icon: "developer" },
  { label: "发布记录", kind: "publish", icon: "publish" },
  { label: "待办与确认", kind: "pending", icon: "pending" },
  { label: "自定义记录", kind: "custom", icon: "custom" },
  { label: "农历黄历", kind: "almanac", icon: "almanac" },
];

export const KIND_LABELS = {
  renewal: "订阅续费",
  pending: "待办与确认",
  project: "项目",
  account: "账号与绑定",
  server: "服务器",
  developer: "开发者资质",
  publish: "发布记录",
  custom: "自定义记录",
  almanac: "农历黄历",
};
