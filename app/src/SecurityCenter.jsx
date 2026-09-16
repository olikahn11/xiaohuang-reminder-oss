import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import QRCode from "qrcode";
import { BrowserQRCodeReader } from "@zxing/browser";
import {
  ArrowCircleDown,
  ArrowCircleUp,
  ArrowsLeftRight,
  BookOpen,
  Camera,
  Check,
  CloudArrowDown,
  CloudArrowUp,
  Copy,
  EnvelopeSimple,
  Fingerprint,
  FolderOpen,
  Globe,
  Key,
  LockKey,
  PaperPlaneTilt,
  QrCode,
  ShieldCheck,
  X,
} from "@phosphor-icons/react";
import {
  createEncryptedBackup,
  createNearbyPayload,
  decryptBackup,
  decryptNearbyPayload,
  randomToken,
} from "./security.js";
import {
  copyText,
  openEmailDraft,
  openEncryptedFile,
  receiveNearbyTransfer,
  saveEncryptedFile,
  startNearbyTransfer,
} from "./native.js";
import { useSwipeDownToClose } from "./ThemedSelect.jsx";
import {
  SUPPORTED_LANGUAGES,
  getStoredLanguage,
  setStoredLanguage,
  t,
} from "./utils/i18n.js";

const QR_FORMAT = "xuji-nearby-link";

function ActionButton({ icon: Icon, children, className = "", ...props }) {
  return <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }} className={`security-action ${className}`} {...props}><Icon size={20} /><span>{children}</span></motion.button>;
}

function Toggle({ active, onClick, label }) {
  return <button type="button" aria-label={label} className={`toggle ${active ? "active" : ""}`} onClick={onClick}><span /></button>;
}

export function SecurityCenter({
  open,
  onClose,
  records,
  onMerge,
  onReset,
  lockConfig,
  onEnableLock,
  onDisableLock,
  onLockNow,
  biometric,
  onToggleBiometric,
  cloudEnabled,
  onEnableCloud,
  onDisableCloud,
  onCloudUpload,
  onCloudDownload,
  notify,
  currentLang = "zh-CN",
  onSelectLanguage,
}) {
  const swipe = useSwipeDownToClose(onClose);
  const [tab, setTab] = useState("guide");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [backupPassword, setBackupPassword] = useState("");
  const [restoreText, setRestoreText] = useState("");
  const [email, setEmail] = useState(() => localStorage.getItem("xuji.backup.email") || "");
  const [includeSecrets, setIncludeSecrets] = useState(false);
  const [busy, setBusy] = useState(false);
  const [qrImage, setQrImage] = useState("");
  const [qrExpiresAt, setQrExpiresAt] = useState(0);
  const [scanOpen, setScanOpen] = useState(false);
  const [manualQr, setManualQr] = useState("");
  const [cloudPassword, setCloudPassword] = useState("");
  const videoRef = useRef(null);
  const scannerControls = useRef(null);

  useEffect(() => () => scannerControls.current?.stop(), []);
  useEffect(() => {
    if (!scanOpen || !videoRef.current) return undefined;
    const reader = new BrowserQRCodeReader();
    let cancelled = false;
    reader.decodeFromVideoDevice(undefined, videoRef.current, async (result) => {
      if (!result || cancelled) return;
      cancelled = true;
      scannerControls.current?.stop();
      setScanOpen(false);
      await receiveCode(result.getText());
    }).then((controls) => { scannerControls.current = controls; }).catch(() => {
      setScanOpen(false);
      notify("无法打开摄像头，请检查相机权限或粘贴传输码");
    });
    return () => { cancelled = true; scannerControls.current?.stop(); };
  // receiveCode intentionally reads the latest records through props.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanOpen]);

  const run = async (task) => {
    if (busy) return;
    setBusy(true);
    try { await task(); } catch (error) { notify(String(error?.message || error)); } finally { setBusy(false); }
  };

  const exportBackup = () => run(async () => {
    const encrypted = await createEncryptedBackup(records, backupPassword, { includeSecrets });
    const location = await saveEncryptedFile(encrypted);
    if (location) notify(includeSecrets ? "加密备份已保存（包含密码类字段）" : "加密备份已保存（未包含密码类字段）");
  });

  const restore = (serialized) => run(async () => {
    if (!serialized) throw new Error("请先选择文件或粘贴加密备份文本");
    const payload = await decryptBackup(serialized, backupPassword);
    onMerge(payload.records);
    notify(`已安全合并 ${payload.records.length} 条记录`);
  });

  const receiveCode = async (value) => {
    await run(async () => {
      let link;
      try { link = JSON.parse(value.trim()); } catch { throw new Error("无法识别这份小黄提醒管家传输码"); }
      if (link.format !== QR_FORMAT || Date.now() > link.expiresAt) throw new Error("二维码无效或已经过期");
      const encrypted = await receiveNearbyTransfer(link.host, link.port, link.token);
      const payload = await decryptNearbyPayload(encrypted, link.key);
      onMerge(payload.records);
      setManualQr("");
      notify(`互传完成，已合并 ${payload.records.length} 条记录`);
    });
  };

  const createQr = () => run(async () => {
    const token = randomToken(24);
    const encrypted = await createNearbyPayload(records, { includeSecrets });
    const endpoint = await startNearbyTransfer(token, encrypted.encrypted);
    const link = JSON.stringify({ format: QR_FORMAT, version: 1, ...endpoint, token, key: encrypted.key });
    setQrImage(await QRCode.toDataURL(link, { width: 360, margin: 2, color: { dark: "#0b1741", light: "#f5f7ff" } }));
    setQrExpiresAt(endpoint.expiresAt);
    notify("一次性二维码已生成，5 分钟内可扫描一次");
  });

  const tabs = [
    ["guide", BookOpen, t("settings.tab_guide", currentLang)],
    ["language", Globe, t("settings.tab_language", currentLang)],
    ["security", ShieldCheck, t("settings.tab_security", currentLang)],
    ["nearby", QrCode, t("settings.tab_nearby", currentLang)],
    ["backup", FolderOpen, t("settings.tab_backup", currentLang)],
    ["icloud", CloudArrowUp, t("settings.tab_icloud", currentLang)],
  ];

  return (
    <AnimatePresence>
      {open ? (
        <motion.div className="modal-backdrop security-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
          <motion.section className="settings-panel security-center glass-layer" initial={{ x: "105%", opacity: 0.7 }} animate={{ x: 0, opacity: 1 }} exit={{ x: "105%", opacity: 0.7 }} transition={{ type: "spring", stiffness: 300, damping: 32 }} {...swipe}>
            <span className="sheet-handle" />
            <div className="modal-head security-head"><div><p className="eyebrow">{t("settings.subtitle", currentLang)}</p><h2>{t("settings.title", currentLang)}</h2></div><button className="icon-button" onClick={onClose}><X size={22} /></button></div>
            <nav className="security-tabs">{tabs.map(([value, Icon, label]) => <button key={value} className={tab === value ? "active" : ""} onClick={() => setTab(value)}><Icon size={19} /><span>{label}</span></button>)}</nav>

            <div className="security-scroll">
              {tab === "guide" ? <div className="security-page">
                <div className="section-copy"><h3>{t("guide.title", currentLang)}</h3><p>{t("guide.subtitle", currentLang)}</p></div>
                
                <div className="guide-hero-banner">
                  <div className="guide-hero-icon"><ShieldCheck size={28} weight="fill" /></div>
                  <div>
                    <strong>覆盖安装 / 升级更新：100% 数据不丢失</strong>
                    <p>直接下载新版并替换旧版，系统会自动保留沙盒本地数据。<strong>请切勿先长按卸载/删除旧 App 再安装</strong>，系统卸载会强制抹掉本地数据！</p>
                  </div>
                </div>

                <div className="guide-cards-list">
                  <div className="guide-card">
                    <div className="guide-card__header"><span className="guide-badge">存储机制</span><h4>{t("guide.q1_title", currentLang)}</h4></div>
                    <p>{t("guide.q1_desc", currentLang)}</p>
                  </div>

                  <div className="guide-card highlight">
                    <div className="guide-card__header"><span className="guide-badge gold">防丢操作</span><h4>{t("guide.q3_title", currentLang)}</h4></div>
                    <p>{t("guide.q3_desc", currentLang)}</p>
                    <div style={{ marginTop: 8 }}>
                      <ActionButton icon={FolderOpen} onClick={() => setTab("backup")}>立即前往「加密备份」保存一份</ActionButton>
                    </div>
                  </div>

                  <div className="guide-card">
                    <div className="guide-card__header"><span className="guide-badge">换机迁移</span><h4>{t("guide.q4_title", currentLang)}</h4></div>
                    <p>{t("guide.q4_desc", currentLang)}</p>
                  </div>

                  <div className="guide-card">
                    <div className="guide-card__header"><span className="guide-badge">功能技巧</span><h4>{t("guide.q5_title", currentLang)}</h4></div>
                    <p>{t("guide.q5_desc", currentLang)}</p>
                  </div>
                </div>

                <div className="local-facts" style={{ marginTop: 14 }}>
                  <div><Check size={17} /><span><strong>{t("settings.privacy_title", currentLang)}</strong><small>{t("settings.privacy_desc", currentLang)}</small></span></div>
                  <div><Check size={17} /><span><strong>{t("settings.version", currentLang)}</strong><small>macOS AppleSilicon &amp; iOS 16+ · 纯本地通用公开版</small></span></div>
                </div>
              </div> : null}
              {tab === "language" ? <div className="security-page">
                <div className="section-copy"><h3>{t("settings.language_title", currentLang)}</h3><p>{t("settings.language_desc", currentLang)}</p></div>
                <div className="language-grid">
                  {SUPPORTED_LANGUAGES.map((lang) => {
                    const isSelected = (currentLang || getStoredLanguage()) === lang.code;
                    return (
                      <motion.div
                        key={lang.code}
                        whileHover={{ y: -2, scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        className={`language-card ${isSelected ? "active" : ""}`}
                        onClick={() => {
                          setStoredLanguage(lang.code);
                          onSelectLanguage?.(lang.code);
                          notify?.(`${lang.flag} ${lang.nativeName} (${lang.label})`);
                        }}
                      >
                        <div className="language-card__left">
                          <span className="language-flag">{lang.flag}</span>
                          <div className="language-card__info">
                            <strong>{lang.nativeName}</strong>
                            <small>{lang.label !== lang.nativeName ? `${lang.label} · ${lang.code}` : lang.code}</small>
                          </div>
                        </div>
                        {isSelected ? <span className="language-check"><Check size={20} weight="bold" /></span> : null}
                      </motion.div>
                    );
                  })}
                </div>
                <div className="local-facts" style={{ marginTop: 20 }}>
                  <div><Check size={17} /><span><strong>{t("settings.privacy_title", currentLang)}</strong><small>{t("settings.privacy_desc", currentLang)}</small></span></div>
                  <div><Check size={17} /><span><strong>{t("settings.version", currentLang)}</strong><small>macOS AppleSilicon &amp; iOS 16+ · 纯本地通用公开版</small></span></div>
                </div>
              </div> : null}
              {tab === "security" ? <div className="security-page">
                <div className="security-hero"><span className="security-orbit"><LockKey size={30} weight="duotone" /></span><div><strong>{lockConfig ? "本地保险箱已开启" : "当前使用普通本地保存"}</strong><small>{lockConfig ? "资料已使用 AES‑256‑GCM 加密" : "你可以继续不设置任何密码"}</small></div><span className={`mini-status ${lockConfig ? "active" : ""}`}>{lockConfig ? "已保护" : "可选"}</span></div>
                {!lockConfig ? <form className="security-form" onSubmit={(event) => { event.preventDefault(); run(async () => { if (password !== confirmPassword) throw new Error("两次输入的密码不一致"); await onEnableLock(password); setPassword(""); setConfirmPassword(""); notify("本地保险箱已开启"); }); }}>
                  <label><span>本地解锁密码</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="仅保存在你的设备中" /></label>
                  <label><span>再次输入</span><input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="确认本地密码" /></label>
                  <p className="privacy-note">完全可选。忘记密码后无法由我们找回，请另外保存加密备份。</p>
                  <ActionButton type="submit" icon={LockKey}>开启本地保险箱</ActionButton>
                </form> : <>
                  <div className="setting-card"><span className="setting-card__icon"><Fingerprint size={24} /></span><div><strong>{biometric.label || "Touch ID / Face ID"}</strong><small>{biometric.isAvailable ? "使用系统生物识别快速解锁" : "这台设备暂不可用"}</small></div><Toggle active={Boolean(lockConfig.biometricEnabled)} onClick={() => run(onToggleBiometric)} label="切换生物识别" /></div>
                  <div className="security-pair"><ActionButton icon={Key} onClick={onLockNow}>立即锁定</ActionButton><ActionButton icon={X} className="danger" onClick={() => run(onDisableLock)}>关闭保险箱</ActionButton></div>
                </>}
                <div className="local-facts"><div><Check size={17} /><span><strong>没有云端账户</strong><small>不会上传手机号、邮箱或微信身份</small></span></div><div><Check size={17} /><span><strong>所有记录字段均可留空</strong><small>包括名称、账号、密码、日期和金额</small></span></div><div><Check size={17} /><span><strong>密码类字段默认不出现在备份</strong><small>只有你主动勾选时才会被加密导出</small></span></div></div>
                <button className="reset-button" onClick={onReset}>清空本机全部记录</button>
              </div> : null}

              {tab === "nearby" ? <div className="security-page">
                <div className="section-copy"><h3>同一 Wi‑Fi，一次性传输</h3><p>二维码只保存局域网地址、随机令牌和临时解密钥匙；真实资料不会写进二维码，成功下载一次后立即失效。</p></div>
                <label className="check-row"><input type="checkbox" checked={includeSecrets} onChange={(event) => setIncludeSecrets(event.target.checked)} /><span><strong>包含密码 / API Key</strong><small>默认关闭；开启后内容仍会端到端加密</small></span></label>
                <div className="nearby-grid">
                  <div className="nearby-card"><ArrowCircleUp size={26} /><strong>这台设备发送</strong><small>生成 5 分钟有效、仅可使用一次的二维码</small><ActionButton icon={QrCode} onClick={createQr}>生成二维码</ActionButton></div>
                  <div className="nearby-card"><ArrowCircleDown size={26} /><strong>这台设备接收</strong><small>扫描另一台设备屏幕上的小黄提醒管家二维码</small><ActionButton icon={Camera} onClick={() => setScanOpen(true)}>打开相机</ActionButton></div>
                </div>
                {qrImage ? <motion.div className="qr-stage" initial={{ opacity: 0, scale: .92 }} animate={{ opacity: 1, scale: 1 }}><div className="qr-halo" /><img src={qrImage} alt="小黄提醒管家一次性设备互传二维码" /><strong>{Date.now() < qrExpiresAt ? "等待另一台设备扫描" : "二维码已过期"}</strong><small>保持此页打开，并确保两台设备在同一 Wi‑Fi</small></motion.div> : null}
                <div className="manual-code"><span>无法使用相机？粘贴扫描结果</span><textarea value={manualQr} onChange={(event) => setManualQr(event.target.value)} placeholder="粘贴小黄提醒管家传输码" /><ActionButton icon={ArrowsLeftRight} onClick={() => receiveCode(manualQr)}>接收并合并</ActionButton></div>
                <AnimatePresence>{scanOpen ? <motion.div className="scanner-stage" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><video ref={videoRef} muted playsInline /><span className="scanner-frame" /><button onClick={() => setScanOpen(false)}><X size={20} />关闭相机</button></motion.div> : null}</AnimatePresence>
              </div> : null}

              {tab === "backup" ? <div className="security-page">
                <div className="section-copy"><h3>可移走的加密数据包</h3><p>保存到“文件”后可用 AirDrop、U 盘或 iCloud Drive 传到另一台设备；邮箱只承载密文，不承担登录或自动同步。</p></div>
                <label className="wide-field"><span>这份备份的加密密码</span><input type="password" value={backupPassword} onChange={(event) => setBackupPassword(event.target.value)} placeholder="导入时需要输入同一个密码" /></label>
                <label className="check-row"><input type="checkbox" checked={includeSecrets} onChange={(event) => setIncludeSecrets(event.target.checked)} /><span><strong>包含密码 / API Key</strong><small>默认不包含，降低敏感信息外带风险</small></span></label>
                <div className="backup-actions"><ActionButton icon={ArrowCircleUp} onClick={exportBackup}>导出 .xuji 文件</ActionButton><ActionButton icon={ArrowCircleDown} onClick={() => run(async () => { const text = await openEncryptedFile(); if (text) { const payload = await decryptBackup(text, backupPassword); onMerge(payload.records); notify(`已合并 ${payload.records.length} 条记录`); } })}>选择文件恢复</ActionButton><ActionButton icon={Copy} onClick={() => run(async () => { const encrypted = await createEncryptedBackup(records, backupPassword, { includeSecrets }); await copyText(encrypted); notify("加密备份文本已复制"); })}>复制加密文本</ActionButton></div>
                <div className="email-backup"><EnvelopeSimple size={24} /><div><strong>通过自己的邮箱保存</strong><small>应用不会登录邮箱、读取邮件或保存邮箱密码</small></div><input type="email" value={email} onChange={(event) => { setEmail(event.target.value); localStorage.setItem("xuji.backup.email", event.target.value); }} placeholder="可选：收件邮箱" /><ActionButton icon={PaperPlaneTilt} onClick={() => openEmailDraft(email)}>打开邮件应用</ActionButton></div>
                <div className="manual-code"><span>从邮件正文恢复</span><textarea value={restoreText} onChange={(event) => setRestoreText(event.target.value)} placeholder="粘贴完整的加密备份文本" /><ActionButton icon={FolderOpen} onClick={() => restore(restoreText)}>解密并合并</ActionButton></div>
              </div> : null}

              {tab === "icloud" ? <div className="security-page">
                <div className="section-copy"><h3>使用你自己的 iCloud</h3><p>Apple 设备之间同步加密数据，不经过小黄提醒管家服务器。同步密码只放在每台设备的系统钥匙串中，新设备需要输入同一个密码一次。</p></div>
                <div className="security-hero cloud-hero"><span className="security-orbit"><CloudArrowUp size={30} /></span><div><strong>{cloudEnabled ? "iCloud 自动同步已开启" : "iCloud 同步未开启"}</strong><small>{cloudEnabled ? "本地变化会在应用打开时自动加密上传" : "不启用也不影响本地使用"}</small></div><span className={`mini-status ${cloudEnabled ? "active" : ""}`}>{cloudEnabled ? "运行中" : "可选"}</span></div>
                {!cloudEnabled ? <div className="security-form"><label><span>iCloud 同步密码</span><input type="password" value={cloudPassword} onChange={(event) => setCloudPassword(event.target.value)} placeholder="另一台设备需输入相同密码" /></label><p className="privacy-note">这是端到端加密钥匙，不是 Apple ID 密码。小黄提醒管家不会询问你的 Apple ID 密码。</p><ActionButton icon={CloudArrowUp} onClick={() => run(async () => { await onEnableCloud(cloudPassword); setCloudPassword(""); notify("iCloud 加密同步已开启"); })}>开启加密同步</ActionButton></div> : <><div className="security-pair"><ActionButton icon={CloudArrowUp} onClick={() => run(onCloudUpload)}>立即上传</ActionButton><ActionButton icon={CloudArrowDown} onClick={() => run(onCloudDownload)}>立即下载并合并</ActionButton></div><ActionButton icon={X} className="security-action--full danger" onClick={() => run(onDisableCloud)}>关闭自动同步</ActionButton></>}
                <div className="icloud-limit"><ShieldCheck size={20} /><span><strong>端到端加密 · 无自建服务器</strong><small>iCloud 键值同步适合纯文本资料，当前单包限制约 800 KB；大型附件请用加密文件。</small></span></div>
              </div> : null}
            </div>
            {busy ? <div className="security-busy"><span />正在进行安全处理…</div> : null}
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
