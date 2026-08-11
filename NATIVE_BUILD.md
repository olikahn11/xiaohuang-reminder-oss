# 小黄提醒管家原生安装与签名说明

## macOS 安装

当前交付的是 Apple Silicon（M1/M2/M3/M4/M5）版本：

1. 双击 `小黄提醒管家-0.6.1-macOS-AppleSilicon.dmg`。
2. 把“小黄提醒管家”拖入“应用程序”。
3. 首次启动若 macOS 提示来源未认证，请在“系统设置 → 隐私与安全性”中选择“仍要打开”。

安装包已完成本地临时签名和磁盘镜像校验，但尚未使用付费 Apple Developer 证书公证，因此不适合直接公开分发。

## iPhone / iPad 安装

项目已生成原生 iOS Xcode 工程，并通过 iPhone 17 Pro 模拟器安装测试。由于本机当前没有 Apple Developer 签名证书，无法生成能直接安装到真机的已签名 IPA。

同时提供 `小黄提醒管家-0.6.1-iPhone-Unsigned.ipa`，这是 `iphoneos arm64` 真机版本，可交给全能签等工具使用你自己的证书和描述文件重签。Bundle ID 为 `cn.xiaohuang.reminder`，最低系统版本为 iOS 16.0。若签名描述文件没有 iCloud capability，本地保险箱、二维码互传和加密文件仍可使用，但 iCloud 自动同步不可用。

当前未签名 IPA 已去除仅供编译链接使用的 Rust 静态库副本，安装包中只保留真机运行所需文件。

真机安装步骤：

1. 用 Xcode 打开 `app/src-tauri/gen/apple/xuji.xcodeproj`。
2. 在 Xcode 的 Settings → Accounts 登录你的 Apple ID。
3. 选择 `xuji_iOS` Target → Signing & Capabilities，勾选 Automatically manage signing，并选择你的 Team。
4. 连接 iPhone/iPad，选择设备后点击 Run。

普通 Apple ID 可用于个人设备调试，但签名有效期和能力有限；稳定安装、TestFlight、App Store 分发以及 iCloud 键值同步能力需要加入 Apple Developer Program，并为 App ID 启用 iCloud Key-value storage capability。

## 重新构建

```bash
cd app
npm install
npm run native:build:mac
npm run native:ios:build:sim
npm run native:ios:build:device
```

两个 iOS 构建命令都会先把 `src-tauri/icons/ios` 的最新图标同步到现有 Xcode 工程，避免安装包继续使用旧 AppIcon 缓存。

原生版本支持系统通知、所有带日期记录的 7/3/1 天及当天具体时间提醒、调用默认浏览器打开续费或管理链接、本地保险箱、生物识别、同一 Wi-Fi 一次性互传和加密备份。二维码互传需要相机与本地网络权限。
