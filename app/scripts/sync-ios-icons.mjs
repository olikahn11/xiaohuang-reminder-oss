#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const masterSvg = path.join(root, "design-assets", "app-icon-ios.svg");
const source = path.join(root, "src-tauri", "icons", "ios");
const target = path.join(root, "src-tauri", "gen", "apple", "Assets.xcassets", "AppIcon052.appiconset");
const sizes = {
  "AppIcon-20x20@1x.png": 20,
  "AppIcon-20x20@2x-1.png": 40,
  "AppIcon-20x20@2x.png": 40,
  "AppIcon-20x20@3x.png": 60,
  "AppIcon-29x29@1x.png": 29,
  "AppIcon-29x29@2x-1.png": 58,
  "AppIcon-29x29@2x.png": 58,
  "AppIcon-29x29@3x.png": 87,
  "AppIcon-40x40@1x.png": 40,
  "AppIcon-40x40@2x-1.png": 80,
  "AppIcon-40x40@2x.png": 80,
  "AppIcon-40x40@3x.png": 120,
  "AppIcon-60x60@2x.png": 120,
  "AppIcon-60x60@3x.png": 180,
  "AppIcon-76x76@1x.png": 76,
  "AppIcon-76x76@2x.png": 152,
  "AppIcon-83.5x83.5@2x.png": 167,
  "AppIcon-512@2x.png": 1024,
};

if (!existsSync(masterSvg) || !existsSync(target)) {
  throw new Error("请先运行 tauri icon 与 tauri ios init，再同步 iOS 图标。");
}

mkdirSync(source, { recursive: true });
const temporaryMaster = path.join(os.tmpdir(), `xiaohuang-ios-icon-${process.pid}.png`);
const opaqueMaster = path.join(os.tmpdir(), `xiaohuang-ios-icon-${process.pid}.jpg`);
execFileSync("sips", ["-s", "format", "png", masterSvg, "--out", temporaryMaster], { stdio: "ignore" });
execFileSync("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "100", temporaryMaster, "--out", opaqueMaster], { stdio: "ignore" });
for (const [name, size] of Object.entries(sizes)) {
  const generated = path.join(source, name);
  execFileSync("sips", ["-s", "format", "png", "-z", String(size), String(size), opaqueMaster, "--out", generated], { stdio: "ignore" });
  copyFileSync(generated, path.join(target, name));
}
rmSync(temporaryMaster, { force: true });
rmSync(opaqueMaster, { force: true });

console.log(`已从两色 Logo 重新生成并同步 ${Object.keys(sizes).length} 个 iOS AppIcon 文件。`);
