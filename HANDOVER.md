# 项目交接文档 (HANDOVER.md)

## 1. 项目简介
- **项目名称**：小黄提醒管家 (Xiao Huang Reminder)
- **版本号**：0.6.3
- **双端支持**：macOS (Apple Silicon / aarch64 DMG) + iOS (iPhone 真机 aarch64 IPA)
- **技术栈**：Tauri 2.x, Rust, React 19, Vite 6, Phosphor Icons, WebKit LocalStorage

## 2. 最近完成工作（本轮重点）
1. **多币种结算体系与汇率折算**：
   - 在新增续费表单中加入了货币选择功能（支持 CNY, USD, EUR, JPY, GBP, HKD, KRW）。
   - 并在仪表盘的“预估月均开销”以及各列表页自动进行汇率折算预估（按基准静态汇率转为 CNY），同时统一展示当前所选货币的专属符号（如 `$`, `¥`, `€`, `£`）。
2. **临近到期提醒判定阈值放宽**：
   - 将首页的“近期紧急事项”与指示灯判定规则（`getUrgentSummary`）由原本的 `<=` 3 天，大幅放宽至 `<=` 7 天，确保提前更多时间警示用户。
3. **日程票据流与日历防崩溃白屏修复**：
   - 彻底修复用户反馈的“点击日历上的某一天直接白屏死机”问题。通过优化对 `lunar-javascript` 中部分非常规日期的安全降级及对 `selectedAlmanac.yi/.ji` 的可选链 `?.` 访问防御，消除前端 React 渲染的致命异常。
4. **强校验补全与首页导航动向纠正**：
   - 当新建记录选择“订阅续费”类型时，系统现会强制要求填入“费用”、“到期日”与“周期（不可为不设置）”，避免填漏导致自动化推算失效。
   - 首页的“待提醒日程项”指示卡点击后不再跳入大日历全景，而是直接更务实地跳转到“待办列表（`pending`）”页的详细清单，一目了然。
5. **通知铃音系统再优化与适配**：
   - 对于 macOS 和 iOS 对自带声音 `sound` 参数的区别要求（iOS 需要传 `default`，而 macOS 需要传具体内置声效如 `Ping`）做了动态系统环境判定区分，确保多平台通知响铃行为如期生效。
6. **移动端底栏空间再次紧凑化**：
   - 彻底移除了 `.mobile-bottom-nav` 的强制固定高度 `height: calc(...)`，改为由 padding 自动撑开，确保各机型无论是否有 Home 触控条均能自适应压紧，解决“菜单栏太靠上来”的问题。

## 3. 核心交付物文件
- **macOS 安装包**：`deliverables/小黄提醒管家-0.6.3-macOS-AppleSilicon.dmg` (包含稳定性与多币种功能更新)
- **iPhone 安装包**：`deliverables/小黄提醒管家-0.6.3-iPhone-Unsigned.ipa` (包含稳定性与多币种功能更新)

## 4. 自动化验证结果
- 全量自动化测试回归：日历推期、安全机制全部通过。
- 双端本地打包：macOS DMG 与 iPhone IPA 重新编译生成完成（已绕过沙盒签名）。

## 5. 远端代码与公开版本发布状态
- 修复代码已提交并推送至私有仓库 (`origin: https://github.com/olikahn11/xiaohuang-reminder-private.git`) 与开源仓库 (`oss: https://github.com/olikahn11/xiaohuang-reminder-oss.git`)。
- GitHub Release `v0.6.3` 附件生成并发布。
