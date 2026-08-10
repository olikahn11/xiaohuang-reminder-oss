import { invoke, isTauri } from "@tauri-apps/api/core";
import { authenticate, checkStatus } from "@tauri-apps/plugin-biometric";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { openUrl, revealItemInDir } from "@tauri-apps/plugin-opener";

export function isNativeApp() {
  return isTauri();
}

export async function saveEncryptedFile(content) {
  if (!isTauri()) {
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `小黄提醒管家备份-${new Date().toISOString().slice(0, 10)}.xuji`;
    anchor.click();
    URL.revokeObjectURL(url);
    return "浏览器下载";
  }
  const path = await save({
    title: "保存小黄提醒管家加密备份",
    defaultPath: `小黄提醒管家备份-${new Date().toISOString().slice(0, 10)}.xuji`,
    filters: [{ name: "小黄提醒管家加密备份", extensions: ["xuji"] }],
  });
  if (!path) return null;
  await writeTextFile(path, content);
  if (/Macintosh/i.test(navigator.userAgent)) await revealItemInDir(path).catch(() => {});
  return path;
}

export async function openEncryptedFile() {
  if (!isTauri()) return null;
  const path = await open({
    title: "选择小黄提醒管家加密备份",
    multiple: false,
    directory: false,
    filters: [{ name: "小黄提醒管家加密备份", extensions: ["xuji", "json", "txt"] }],
  });
  if (!path || Array.isArray(path)) return null;
  return readTextFile(path);
}

export async function openEmailDraft(email = "") {
  const recipient = encodeURIComponent(email.trim());
  const subject = encodeURIComponent("小黄提醒管家加密备份");
  const body = encodeURIComponent("小黄提醒管家备份已经端到端加密。请粘贴复制的加密备份文本，或添加刚刚导出的 .xuji 文件作为附件。请勿在邮件正文中写备份密码。");
  const url = `mailto:${recipient}?subject=${subject}&body=${body}`;
  if (isTauri()) return openUrl(url);
  window.location.href = url;
}

export async function copyText(value) {
  await navigator.clipboard.writeText(value);
}

export async function saveDeviceSecret(key, value) {
  if (!isTauri()) throw new Error("网页版不提供系统钥匙串");
  return invoke("save_device_secret", { key, value });
}

export async function readDeviceSecret(key) {
  if (!isTauri()) throw new Error("网页版不提供系统钥匙串");
  return invoke("read_device_secret", { key });
}

export async function deleteDeviceSecret(key) {
  if (!isTauri()) return;
  return invoke("delete_device_secret", { key });
}

export async function biometricStatus() {
  if (!isTauri()) return { isAvailable: false, label: "不可用" };
  if (/Macintosh/i.test(navigator.userAgent)) {
    const result = await invoke("macos_biometric_status");
    return { ...result, label: "Touch ID" };
  }
  try {
    const status = await checkStatus();
    return { ...status, label: status.biometryType === 2 ? "Face ID" : "Touch ID" };
  } catch {
    return { isAvailable: false, label: "不可用" };
  }
}

export async function authenticateBiometric(reason = "解锁小黄提醒管家的本地加密资料") {
  if (!isTauri()) throw new Error("当前版本不支持生物识别");
  if (/Macintosh/i.test(navigator.userAgent)) return invoke("authenticate_macos", { reason });
  return authenticate(reason, { allowDeviceCredential: true, title: "解锁小黄提醒管家" });
}

export async function startNearbyTransfer(token, payload) {
  if (!isTauri()) throw new Error("二维码近距离互传需要安装版应用");
  return invoke("start_nearby_transfer", { token, payload });
}

export async function receiveNearbyTransfer(host, port, token) {
  if (!isTauri()) throw new Error("二维码近距离互传需要安装版应用");
  return invoke("receive_nearby_transfer", { host, port, token });
}

export async function writeICloud(payload) {
  if (!isTauri()) throw new Error("iCloud 同步仅在 Apple 安装版中提供");
  return invoke("icloud_write", { payload });
}

export async function readICloud() {
  if (!isTauri()) throw new Error("iCloud 同步仅在 Apple 安装版中提供");
  return invoke("icloud_read");
}

export async function synchronizeICloud() {
  if (!isTauri()) throw new Error("iCloud 同步仅在 Apple 安装版中提供");
  return invoke("icloud_synchronize");
}
