const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const BACKUP_FORMAT = "xuji-backup";
export const BACKUP_VERSION = 1;
export const PBKDF2_ITERATIONS = 310_000;
export const LOCK_CONFIG_KEY = "xuji.lock.v1";
export const VAULT_KEY = "xuji.vault.v1";
export const RECORDS_KEY = "xuji.records.v1";

function cryptoApi() {
  if (!globalThis.crypto?.subtle) throw new Error("当前系统不支持安全加密");
  return globalThis.crypto;
}

export function bytesToBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

export function base64UrlToBytes(value) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function randomToken(byteLength = 32) {
  return bytesToBase64Url(cryptoApi().getRandomValues(new Uint8Array(byteLength)));
}

async function deriveKey(password, salt, iterations = PBKDF2_ITERATIONS) {
  const material = await cryptoApi().subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return cryptoApi().subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function importAesKey(rawKey, usages) {
  return cryptoApi().subtle.importKey("raw", rawKey, { name: "AES-GCM" }, false, usages);
}

async function encryptBytes(plainBytes, key) {
  const iv = cryptoApi().getRandomValues(new Uint8Array(12));
  const ciphertext = await cryptoApi().subtle.encrypt({ name: "AES-GCM", iv }, key, plainBytes);
  return { iv: bytesToBase64Url(iv), ciphertext: bytesToBase64Url(new Uint8Array(ciphertext)) };
}

async function decryptBytes(envelope, key) {
  try {
    const plain = await cryptoApi().subtle.decrypt(
      { name: "AES-GCM", iv: base64UrlToBytes(envelope.iv) },
      key,
      base64UrlToBytes(envelope.ciphertext),
    );
    return new Uint8Array(plain);
  } catch {
    throw new Error("密码不正确，或备份数据已经损坏");
  }
}

export function normalizeRecords(records, now = new Date().toISOString()) {
  return (Array.isArray(records) ? records : []).map((record, index) => ({
    ...record,
    id: record.id || `record-${Date.now()}-${index}`,
    createdAt: record.createdAt || record.updatedAt || now,
    updatedAt: record.updatedAt || record.createdAt || now,
    deletedAt: record.deletedAt || null,
  }));
}

export function mergeRecords(localRecords, incomingRecords) {
  const merged = new Map();
  for (const record of normalizeRecords(localRecords)) merged.set(record.id, record);
  for (const incoming of normalizeRecords(incomingRecords)) {
    const local = merged.get(incoming.id);
    if (!local || String(incoming.updatedAt) > String(local.updatedAt)) merged.set(incoming.id, incoming);
  }
  return [...merged.values()].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

function recordsForBackup(records, includeSecrets) {
  const secretFields = new Set(["password", "apiKey", "token", "secret", "privateKey"]);
  return normalizeRecords(records).map((record) => Object.fromEntries(
    Object.entries(record).filter(([key]) => includeSecrets || !secretFields.has(key)),
  ));
}

export async function createEncryptedBackup(records, password, options = {}) {
  if (!password) throw new Error("请为这份备份设置一个加密密码");
  const salt = cryptoApi().getRandomValues(new Uint8Array(16));
  const key = await deriveKey(password, salt);
  const payload = {
    records: recordsForBackup(records, Boolean(options.includeSecrets)),
    sourceDeviceId: options.deviceId || "local-device",
    createdAt: new Date().toISOString(),
  };
  const encrypted = await encryptBytes(encoder.encode(JSON.stringify(payload)), key);
  return JSON.stringify({
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt: payload.createdAt,
    includesSecrets: Boolean(options.includeSecrets),
    encryption: {
      algorithm: "AES-256-GCM",
      kdf: "PBKDF2-SHA256",
      iterations: PBKDF2_ITERATIONS,
      salt: bytesToBase64Url(salt),
      iv: encrypted.iv,
    },
    ciphertext: encrypted.ciphertext,
  });
}

export async function decryptBackup(serialized, password) {
  let envelope;
  try { envelope = typeof serialized === "string" ? JSON.parse(serialized.trim()) : serialized; } catch { throw new Error("无法识别这份备份文件"); }
  if (envelope?.format !== BACKUP_FORMAT || envelope?.version !== BACKUP_VERSION) throw new Error("这不是受支持的小黄提醒管家备份");
  const key = await deriveKey(
    password,
    base64UrlToBytes(envelope.encryption.salt),
    envelope.encryption.iterations,
  );
  const plain = await decryptBytes({ iv: envelope.encryption.iv, ciphertext: envelope.ciphertext }, key);
  const payload = JSON.parse(decoder.decode(plain));
  return { ...payload, records: normalizeRecords(payload.records) };
}

export async function createNearbyPayload(records, options = {}) {
  const rawKey = cryptoApi().getRandomValues(new Uint8Array(32));
  const key = await importAesKey(rawKey, ["encrypt"]);
  const payload = {
    format: "xuji-nearby",
    version: 1,
    createdAt: new Date().toISOString(),
    records: recordsForBackup(records, Boolean(options.includeSecrets)),
  };
  const encrypted = await encryptBytes(encoder.encode(JSON.stringify(payload)), key);
  return {
    key: bytesToBase64Url(rawKey),
    encrypted: JSON.stringify({ format: "xuji-nearby-encrypted", version: 1, ...encrypted }),
  };
}

export async function decryptNearbyPayload(serialized, rawKeyValue) {
  let envelope;
  try { envelope = JSON.parse(serialized); } catch { throw new Error("互传数据格式不正确"); }
  if (envelope?.format !== "xuji-nearby-encrypted") throw new Error("这不是小黄提醒管家互传数据");
  const key = await importAesKey(base64UrlToBytes(rawKeyValue), ["decrypt"]);
  const plain = await decryptBytes(envelope, key);
  const payload = JSON.parse(decoder.decode(plain));
  return { ...payload, records: normalizeRecords(payload.records) };
}

export async function createLocalVault(records, password) {
  if (!password) throw new Error("请输入本地解锁密码");
  const dataKeyBytes = cryptoApi().getRandomValues(new Uint8Array(32));
  const dataKey = await importAesKey(dataKeyBytes, ["encrypt", "decrypt"]);
  const salt = cryptoApi().getRandomValues(new Uint8Array(16));
  const wrappingKey = await deriveKey(password, salt);
  const wrapped = await encryptBytes(dataKeyBytes, wrappingKey);
  const vault = await encryptLocalVault(records, dataKeyBytes);
  return {
    config: {
      version: 1,
      salt: bytesToBase64Url(salt),
      iterations: PBKDF2_ITERATIONS,
      wrappedKey: wrapped.ciphertext,
      wrapIv: wrapped.iv,
      biometricEnabled: false,
      createdAt: new Date().toISOString(),
    },
    vault,
    dataKey: bytesToBase64Url(dataKeyBytes),
  };
}

export async function unlockLocalVault(config, vault, password) {
  const wrappingKey = await deriveKey(password, base64UrlToBytes(config.salt), config.iterations);
  const rawKey = await decryptBytes({ iv: config.wrapIv, ciphertext: config.wrappedKey }, wrappingKey);
  return unlockLocalVaultWithKey(vault, bytesToBase64Url(rawKey));
}

export async function unlockLocalVaultWithKey(vault, rawKeyValue) {
  const rawKey = base64UrlToBytes(rawKeyValue);
  const key = await importAesKey(rawKey, ["decrypt"]);
  const plain = await decryptBytes(vault, key);
  return { records: normalizeRecords(JSON.parse(decoder.decode(plain)).records), dataKey: rawKeyValue };
}

export async function encryptLocalVault(records, rawKeyValue) {
  const rawKey = typeof rawKeyValue === "string" ? base64UrlToBytes(rawKeyValue) : rawKeyValue;
  const key = await importAesKey(rawKey, ["encrypt"]);
  return encryptBytes(encoder.encode(JSON.stringify({ records: normalizeRecords(records) })), key);
}
