# 项目交接文档 (HANDOVER.md)

## 1. 项目简介
- **项目名称**：小黄提醒管家 (Xiao Huang Reminder)
- **版本号**：0.6.2
- **双端支持**：macOS (Apple Silicon / aarch64 DMG) + iOS (iPhone 真机 aarch64 IPA)
- **技术栈**：Tauri 2.x, Rust, React 19, Vite 6, Phosphor Icons, WebKit LocalStorage

## 2. 最近完成工作（本轮重点）
1. **提醒系统核心修复**：
   - 彻底解决提醒不可用问题，增加全局自动调度引擎 `reminderEngine.js`，启动与数据变更时全生命周期自动排期。
   - macOS 原生接入 `UNUserNotificationCenter` 权限申请 (`requestAuthorizationWithOptions`) 与声音通知。
   - iOS 原生接入本地通知排期 (`Schedule.at` + `cancelAll`)。
2. **周期续费与多月日历展开**：
   - 实现通用周期推算引擎 `cycleUtils.js`，支持每月、每双月、每季度、每半年、每年以及月末边界推算。
   - 彻底解决“7月18日按月续费，下月不显示不提醒”问题，切换至未来月份在日历中自动展开周期投影。
   - “完成本期续费”顺延至下一周期，并在 `record.history` 中永久追加记录，保留用户历史。
3. **UI 风格全面重塑为潮酷波普新野兽派 (Playful Neo-Brutalism & Pop Bento)**：
   - 全套设计系统统一在 `theme.css`：暖黄奶油底色、波普半调点阵网格、2.5px 纯黑硬朗描边、4px 纯黑无模糊几何硬阴影。
   - 按钮带物理按压下沉手感 (`transform: translate(2px, 2px)`)。
   - macOS 桌面端复古立体侧边栏 + iPhone 移动端纯白波普 Dock 底栏。
4. **移动端全屏幕适配与抗晃动稳定性修复 (iPhone 13 Pro Max 等大屏/刘海屏/灵动岛机型)**：
   - 解决页面晃动不稳（容器 100dvh 锁定，禁用橡皮筋全页漂移与缩放）。
   - 解决顶部顶到电量与时间（TopBar 动态接入 `env(safe-area-inset-top)` 避让）。
   - 解决底部遮挡（BottomNav 独立安全区垫底，主列表预留滚动空间）。
5. **移动端信息架构与页面深度重构 (日历收纳、票据流、资产滑动胶囊、首页饱满空间)**：
   - 日历紧凑收纳于屏幕上半屏，下半屏展开当日日程票据流。
   - 续费与资产页面重构为波普 Bento 票据卡片流，支持横向滑动胶囊分类。
6. **全局文字高对比度彻底治理与全机型底栏紧凑下移自适应**：
   - 全局墨黑 18:1 高对比度，黄历宜忌与条目高亮粗体清晰可见。
   - 底栏菜单向下贴底紧凑化，消除多余空白。
7. **数据彻底脱敏与多语言 (i18n) 全球化系统扩充**：
   - `INITIAL_RECORDS` 默认纯空，全库脱敏无用户隐私。
   - 内置中、日、韩、英及欧洲主要语言共 11 种主流语言（🇨🇳 简体中文、🇭🇰 繁體中文、🇯🇵 日本語、🇰🇷 한국어、🇺🇸 English、🇫🇷 Français、🇩🇪 Deutsch、🇪🇸 Español、🇮🇹 Italiano、🇵🇹 Português、🇷🇺 Русский），全部 92 个词条 100% 完整覆盖，设置与顶栏即时动态切换。
8. **软件内设置中心与 GitHub 说明增补「数据存储机制与防丢失指南」**：
   - 在设置中心默认首位新增「数据与指南 (Data Guide)」模块，用 5 大问答卡片全面拆解数据存储原理。
   - 明确指出：**直接覆盖安装/升级 100% 不会丢失数据**；严肃警示：**切勿在升级前长按删除/卸载旧 App**。
   - 详细指引如何通过「加密备份」一键导出 `.xuji` 备份文件或复制加密文本到备忘录，做到永久双保险。
   - 补充说明局域网互传、AirDrop 投送以及端到端加密 iCloud 换机数据迁移方式。
   - 根目录 `README.md` 与 GitHub Release 发版说明同步完整呈现该指南。

## 3. 核心交付物文件
- **macOS 安装包**：`deliverables/小黄提醒管家-0.6.1-macOS-AppleSilicon.dmg` (5.3MB, 最新含数据指南+多语言构建)
- **iPhone 安装包**：`deliverables/小黄提醒管家-0.6.1-iPhone-Unsigned.ipa` (4.0MB, 最新真机免签含数据指南+多语言构建)

## 4. 自动化验证结果
- `npm run test:calendar`：4/4 全部通过。
- `npm run test:security`：4/4 全部通过。
- `npm run test:sites`：4/4 全部通过。
- `npm run build`：生产构建通过。
- 双端本地打包：DMG / IPA 生成完成。

## 5. 远端代码与公开版本发布状态
- 私有仓库 (`origin: https://github.com/olikahn11/xiaohuang-reminder-private.git`) 已推送至最新 main。
- 开源仓库 (`oss: https://github.com/olikahn11/xiaohuang-reminder-oss.git`) 已同步推送至最新 main。
- 公开下载站 (`olikahn11/xiaohuang-reminder-public` & `olikahn11/xiaohuang-reminder-oss`) 的 `v0.6.2` Release 已上传最新 DMG 与 IPA，并发布了详细的数据安全指南说明。

