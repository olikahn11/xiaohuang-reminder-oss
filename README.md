# 小黄提醒管家

一个用于统一管理项目、账号、绑定关系、订阅续费、服务器、开发者资质、发布记录、待办与待确认事项的本地优先应用。

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.6.1-f0bd54.svg)](CHANGELOG.md)

这是“小黄提醒管家”的公开源码仓库。项目处于早期公开维护阶段，欢迎提交可复现的问题、测试用例、文档改进与跨平台适配贡献。安装包与面向普通用户的说明位于 [公开下载仓库](https://github.com/olikahn11/xiaohuang-reminder-public)。

应用源码位于 `app/`，提供电脑与手机自适应界面、本地数据增删、自由扩展字段、到期提醒、敏感信息遮挡、详情抽屉与续费/管理入口。原生版本支持系统级通知、续费链接跳转、本地加密保险箱、Touch ID / Face ID、一次性二维码局域网互传、加密文件/邮箱备份，以及可选的 iCloud 端到端加密同步。

## 主要能力

- 在一处管理项目、账号、订阅续费、服务器、开发者资质、发布记录、待办和完全自定义记录。
- 电影分镜式月历同时显示公历、农历、节气与传统节日，并提供独立农历黄历页面。
- 本地优先，无开发者自建账户服务器；支持 AES-256-GCM 加密保险箱、系统生物识别与加密备份。
- 内置全球 11 种主流语言即时切换（🇨🇳 简体中文、🇭🇰 繁體中文、🇯🇵 日本語、🇰🇷 한국어、🇺🇸 English、🇫🇷 Français、🇩🇪 Deutsch、🇪🇸 Español、🇮🇹 Italiano、🇵🇹 Português、🇷🇺 Русский）。
- 支持 macOS、iPhone、iPad 与响应式 Web/PWA；移动端针对 WebView 性能和触控流程单独优化。
- 数据模型包含更新时间与删除标记，跨设备合并时避免旧数据覆盖或删除记录复活。

所有业务字段均可留空。应用不提供、也不依赖小黄提醒管家服务器账户；邮箱仅用于保存用户自己生成的密文备份，不会被应用登录或读取。

## 💾 数据存储机制与防丢失指南 (Data Storage & Safety)

### 1. 数据保存在哪里？
- **100% 本地安全沙盒**：所有记录（订阅、资产、账号、提醒）仅保存在您当前设备本地系统的 WebKit LocalStorage 和钥匙串安全沙盒中。
- **零云端上传**：没有自建云端数据库，没有任何遥测跟踪或隐私泄露风险。

### 2. 覆盖安装 / 更新升级，数据会丢失吗？
- **直接覆盖安装 100% 不会丢失**：
  - **macOS**：打开新的 `.dmg`，直接把新版应用拖入“应用程序 (Applications)”并选择**“替换”**，系统会自动完整保留所有的沙盒数据。
  - **iPhone**：通过 TrollStore、AltStore、TestFlight 或个人证书直接**覆盖安装**新版本 IPA，iOS 会仅更新应用二进制文件，应用数据完整保留。
- ⚠️ **唯一会导致数据丢失的操作**：**长按删除/卸载旧 App**！如果先卸载了 App 再安装新版，操作系统的安全策略会强制清空该 App 的全部沙盒存储。因此**切勿在升级前卸载旧 App**。

### 3. 如何做到 100% 绝对不丢失？（极力推荐）
- 打开应用内的 **「设置与安全中心 (Settings)」** → 进入 **「加密备份 (Backup)」**；
- 点击 **「导出 .xuji 文件」** 或 **「复制加密文本」**；
- 将备份文件或文本保存在您的微信文件传输助手、苹果备忘录、U 盘或发送给自己的邮箱；
- 无论手机丢失、电脑重装系统或意外损坏，在任何新设备上打开应用，点击**「选择文件恢复」**，1 秒钟完整找回所有数据！

### 4. 更换手机或电脑怎么迁移数据？
- **方式一（局域网直传）**：两台设备连接同一 Wi-Fi，打开「设备互传」，一台点击“发送”生成二维码，另一台点击“接收”扫码，即时安全合并。
- **方式二（隔空投送 / 文件传输）**：导出 `.xuji` 备份文件后，通过 AirDrop、微信或邮件发送到新设备，在新设备上点击导入。
- **方式三（iCloud 密文同步）**：在设置的「iCloud」标签页输入同步密码，即可在您的 Apple 设备之间通过私人 iCloud 实现端到端加密同步。

## 本地运行

```bash
cd app
npm install
npm run dev
```

## 原生版本

- macOS：运行 `cd app && npm run native:build:mac` 生成 Apple Silicon `.app` 和 `.dmg`。
- iOS 模拟器：运行 `cd app && npm run native:ios:build:sim`。
- iPhone/iPad 真机：在 Xcode 打开 `app/src-tauri/gen/apple/xuji.xcodeproj`，登录 Apple ID 并选择签名团队。

具体安装与签名说明见 `NATIVE_BUILD.md`。

安全模型与恢复边界见 `SECURITY.md`。启用本地保险箱后，忘记本地密码无法由开发者找回，请提前导出加密备份。

## 参与贡献

提交问题或代码前请阅读 [CONTRIBUTING.md](CONTRIBUTING.md) 与 [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)。安全问题请按照 [SECURITY.md](SECURITY.md) 中的方式私下报告，不要在公开 Issue 中披露可利用细节。

## 开源许可与品牌

除另有注明外，本仓库代码与文档按 [Apache License 2.0](LICENSE) 授权。依赖与 `app/src-tauri/vendor/` 中的第三方代码继续适用各自许可证。

“小黄提醒管家”“小黄系列”、吉祥物、Logo 和品牌图标不包含在 Apache-2.0 授权中；详见 [TRADEMARKS.md](TRADEMARKS.md)。
