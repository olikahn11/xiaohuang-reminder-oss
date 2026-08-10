# 小黄提醒管家开发说明

## 环境

- Node.js 20 或更高版本
- Rust stable 与 Apple Silicon macOS 开发环境
- Xcode（构建 iOS 时需要）

## 网页开发

```bash
cd app
npm install
npm run dev
```

## 构建与测试

```bash
cd app
npm run build
npm run test:calendar
npm run test:security
npm run test:sites
```

## 原生构建

```bash
cd app
npx tauri build --bundles app --target aarch64-apple-darwin
npx tauri ios build --target aarch64 --no-sign --ci
```

macOS 正式公开分发需要 Apple Developer ID 签名与公证。iOS 真机包需要开发者使用自己的证书、描述文件和 Team 重新签名。

## 数据与安全

- 首次启动不得注入演示或测试记录。
- 不要提交 `.env`、证书、描述文件、私钥、Token、密码或用户导出的备份。
- `deliverables/`、`node_modules/`、Rust target、Xcode build 与其他生成物均保持忽略。
- 修改数据模型、加密、同步或提醒逻辑后，必须重新执行对应自动测试。

## 发布边界

完整代码仅同步到私有仓库。公开仓库只维护产品介绍、安装说明、下载 Release、截图、更新日志、FAQ 与版权说明。
