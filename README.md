# 小黄提醒管家

一个用于统一管理项目、账号、绑定关系、订阅续费、服务器、开发者资质、发布记录、待办与待确认事项的本地优先应用。

应用源码位于 `app/`，提供电脑与手机自适应界面、本地数据增删、自由扩展字段、到期提醒、敏感信息遮挡、详情抽屉与续费/管理入口。原生版本支持系统级通知、续费链接跳转、本地加密保险箱、Touch ID / Face ID、一次性二维码局域网互传、加密文件/邮箱备份，以及可选的 iCloud 端到端加密同步。

所有业务字段均可留空。应用不提供、也不依赖小黄提醒管家服务器账户；邮箱仅用于保存用户自己生成的密文备份，不会被应用登录或读取。

## 本地运行

```bash
cd app
npm run dev
```

## 原生版本

- macOS：运行 `cd app && npm run native:build:mac` 生成 Apple Silicon `.app` 和 `.dmg`。
- iOS 模拟器：运行 `cd app && npm run native:ios:build:sim`。
- iPhone/iPad 真机：在 Xcode 打开 `app/src-tauri/gen/apple/xuji.xcodeproj`，登录 Apple ID 并选择签名团队。

具体安装与签名说明见 `NATIVE_BUILD.md`。

安全模型与恢复边界见 `SECURITY.md`。启用本地保险箱后，忘记本地密码无法由开发者找回，请提前导出加密备份。
