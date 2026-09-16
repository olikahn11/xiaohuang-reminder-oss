# 项目开发任务清单 (TASKS.md)

## 1. 架构审计与问题定位
- [x] 全局审查代码库结构与实现现状
- [x] 定位通知提醒无法触发的根本原因
- [x] 定位按月/按周期续费在下月不显示、不提醒的根本原因
- [x] 定位 UI 与前端框架冗余、重复、单体文件膨胀的架构问题

## 2. 核心问题修复：提醒系统改造 (Notification Engine)
- [x] 增加全局提醒自动化调度器（应用启动、数据增删改时自动调度，不再依赖手动点铃铛）
- [x] 补齐 macOS 原生通知权限申请流程（解决 UNUserNotificationCenter 未经授权静默失效）
- [x] 增加前台与后台运行时提醒巡检机制（分钟级检查今日到期与临近提醒）
- [x] 增加应用内“今日待办 / 即将到期 / 已逾期”常驻提醒卡片与弹窗警报
- [x] 改造记录中的提醒规则（支持多选提前天数/时间，并由调度器精确计算）

## 3. 核心问题修复：周期性续费与智能推期逻辑 (Recurring Logic)
- [x] 编写周期计算器模块 `cycleUtils.js`（支持每月、每季度、每年、每周、一次性推算）
- [x] 日历组件支持周期性日程多月展开投影（在切换到未来月份时自动计算并展示该周期的提醒）
- [x] 重构“续费完成”闭环逻辑（完成本期续费后自动推进到下一到期日，保留正常状态，绝不直接隐藏消失）
- [x] 增加逾期智能诊断提示与“完成本期并推至下期 / 调整周期”快捷操作
- [x] 记录详情中展示完整周期信息（本期到期、下期预计到期、已续费历史记录）

## 4. 前端框架重构与代码解耦 (Architecture Refactoring)
- [x] 拆解 1500+ 行单体 `App.jsx` 为高内聚低耦合的模块化结构：
  - `src/components/`：通用基础组件（Topbar, Sidebar, BottomNav, UrgentBanner, etc.）
  - `src/features/dashboard/`：全景看板视图 (DashboardView)
  - `src/features/records/`：记录管理 (RecordFormModal, RecordDrawer, RecordList)
  - `src/features/calendar/`：日历与时间轨道 (CinematicCalendar, AlmanacView)
  - `src/features/reminders/`：提醒中心与下拉面板 (NotificationDropdown)
  - `src/features/security/`：保险箱与同步 (SecurityCenter)
  - `src/utils/`：周期计算、提醒引擎、格式化、加密工具库
- [x] 采用高阶现代化暗夜液态玻璃质感设计体系 `theme.css`，大幅提升视觉品质与文字对比度
- [x] 抽象统一列表组件 `RecordList`，合并原 `RenewalTable`、`PendingTable`、`UpcomingTable`、`RecordTable` 四套重复代码

## 5. UI 与信息架构重新设计 (UI / UX Redesign)
- [x] 消除“首页”与“总览”在导航栏和内容上的严重重复，明确“全景看板”与“资产分类”分工
- [x] 重新规划左侧边栏导航层级（精简为：看板全景、时间轨道、订阅续费、待办事项、数字资产、择吉黄历、安全中心）
- [x] 优化移动端底栏导航与桌面端布局的一致性
- [x] 优化新增与编辑表单交互（周期选择时即时预览下个到期日，提醒规则支持标签化直观选择）

## 6. 测试与交付验证 (Testing & Verification)
- [x] 编写周期推算与日历展开单元测试 (`tests/cycle.test.mjs`)
- [x] 编写提醒调度与过期判定单元测试 (`tests/reminder.test.mjs`)
- [x] 运行既有日历与安全测试，确保无破坏性变更（全部通过）
- [x] 执行 Vite 生产构建与 Sites 打包验证（全部通过）

## 7. iPhone (iOS / IPA) 同步修复与构建验证
- [x] 在 `reminderEngine.js` 中接入 iOS 原生本地排期提醒调度 (`Schedule.at` + `cancelAll`)，彻底解决 iPhone 无法后台到期弹窗问题
- [x] 适配移动端触控交互、Safe Area 避让与全新流光悬浮吸底导航 (`BottomNav.jsx`)
- [x] 构建生成最新真机版 iPhone IPA 安装包并同步到 deliverables 目录 (`deliverables/小黄提醒管家-0.6.1-iPhone-Unsigned.ipa`)

## 8. 双端潮酷波普新野兽派 (Playful Neo-Brutalism & Pop Bento) 风格重构
- [x] 重构全套设计系统变量与核心规则（暖黄奶油底色、波普点阵网格、粗黑硬朗描边 2.5px、纯黑硬阴影 4px、物理按键按压下沉动效）
- [x] 重构 macOS 桌面端侧边栏与卡牌（便签卡牌容器、像素风萌趣笑脸挂件 🙂、明黄高亮导航）
- [x] 重构 iPhone 移动端波普 Dock（纯白高对比底栏、中心突出亮橙 + 按钮、Safe Area 贴合）
- [x] 重构顶部状态胶囊与全局操作按钮（复古扁平搜索栏、亮橙波普 CTA 按钮、金币状态药丸）
- [x] 自动化测试套件全量回归（17/17 测试用例全部通过）
- [x] 重新打包交付最新 macOS Apple Silicon DMG 与真机未签名版 iOS IPA 安装包

## 9. 移动端全屏幕适配与抗晃动稳定性修复 (iPhone 13 Pro Max 等各机型)
- [x] 解决页面晃动不稳：锁定 html/body/root 容器（`height: 100dvh; overflow: hidden; overscroll-behavior: none; touch-action: pan-y;`），禁用双击缩放与全页橡皮筋漂移
- [x] 解决顶部顶到电量与时间：TopBar 接入动态安全区 `env(safe-area-inset-top)`，精准避让刘海、状态栏与灵动岛
- [x] 解决底部被遮挡：BottomNav 独立安全区垫底（`max(10px, env(safe-area-inset-bottom))`），主列表增加 `calc(115px + env(safe-area-inset-bottom))` 滚动空间，确保底部卡片完全展开露出
- [x] 重新构建并同步最新 iPhone IPA (`deliverables/小黄提醒管家-0.6.1-iPhone-Unsigned.ipa`) 与 macOS DMG

## 10. 移动端架构彻底重构（日历全屏内收纳+日程票据流、续费/资产卡片流架构、首页空间收敛）
- [x] 彻底重构日历页面 (`CinematicCalendar.jsx`)：手机端上部紧凑月历全屏内收纳（~240px），下部展开选中日日程票据流，彻底解决方格难看、文字截断与屏幕溢出
- [x] 彻底重构续费与资产页面 (`RecordList.jsx`)：废除手机端 6 列 Table，重构为双端响应式波普 Bento 票据卡片流，重构资产分类横向滑动胶囊与快速操作
- [x] 优化首页空间与留白收敛 (`DashboardView.jsx` & `theme.css`)：重构移动端统计卡片紧凑排布与近期日程饱满呈现，消除底部过度留白
- [x] 运行自动化测试与编译构建，确保历史数据 100% 保持、周期续费与提醒功能无损
- [x] 重新构建交付最新真机版 iPhone IPA 与 macOS DMG，并在移动视口截屏验证

## 11. 全局文字高对比度彻底治理与全机型底栏紧凑自适应优化
- [x] 彻底移除旧主题 CSS 引用（消除 legacy 淡青/半透明文字与 backdrop-filter 导致的布局漂移）
- [x] 重构黄历择吉速览与详情（宜/忌及用事文字采用 18:1 纯墨黑高对比粗体，全 App 杜绝任何看不清的浅灰淡色）
- [x] 底栏菜单解耦重构（移出内部滚动容器，直接贴底并紧凑化高度至 46px + safe-area，彻底消除下方大块虚空留白）
- [x] 全机型（小屏、标准、Pro Max）顶部与底部 Safe Area 动态紧凑自适应，呼吸感舒适自然
- [x] 重新构建交付最新 macOS DMG (5.2MB) 与 iPhone 真机 IPA (4.18MB)

## 12. 数据彻底脱敏、多国语言 (i18n) 系统接入与双端公开版构建
- [x] 彻底排查并清理所有个人隐私与演示数据（`INITIAL_RECORDS` 默认纯空 `[]`，全库无任何用户隐私数据，安装包适合全球用户开箱即用）
- [x] 设置面板中新增“多国语言 (Display Language)”独立配置（支持 🇨🇳 简体中文、🇭🇰 繁體中文、🇺🇸 English、🇯🇵 日本語、🇪🇸 Español）
- [x] 顶栏与侧边栏接入设置与多语言快捷入口，支持全系统界面与导航实时动态切换
- [x] 全量回归自动化测试（日历、周期推期、提醒引擎、安全隔离测试全部 100% 通过）
- [x] 重新编译生成最新 macOS DMG (`小黄提醒管家-0.6.1-macOS-AppleSilicon.dmg`, 5.57MB) 与 iPhone 真机未签名版 IPA (`小黄提醒管家-0.6.1-iPhone-Unsigned.ipa`, 4.20MB)
- [x] 提交最新多语言代码并推送到 GitHub 私有仓库 (`origin: https://github.com/olikahn11/xiaohuang-reminder-private.git`)
- [x] 将全新脱敏通用公开版双端安装包与新版本说明发布至 GitHub 公开仓库与官方下载站 (`oss: xiaohuang-reminder-oss` & `xiaohuang-reminder-public`)

## 13. 数据存储机制与防丢失指南 (软件设置内嵌 + README/Release 全面阐释)
- [x] 多语言与设置中心接入“数据与指南”模块（覆盖安装不丢数据原理、严禁先卸载后装警示、导出 .xuji 备份指南、换机迁移与智能周期推期）
- [x] GitHub 核心说明文档 (README.md) 详细增补“数据存储机制与防丢失指南”
- [x] 重新构建编译 macOS DMG 并更新 deliverables 目录 (`小黄提醒管家-0.6.1-macOS-AppleSilicon.dmg`)
- [x] 重新构建编译带有最新设置指南界面的 iPhone IPA 并更新 deliverables 目录 (`小黄提醒管家-0.6.1-iPhone-Unsigned.ipa`)
- [x] 提交最新代码并推送到 GitHub 私有仓库 (origin main)
- [x] 同步推送到 GitHub 开源公开仓库 (oss main)
- [x] 更新 GitHub Release 说明与最新双端安装包文件
- [x] 详细向用户解答“重新安装数据是否会丢失”及“如何正确储存与备份数据”的全部疑问
