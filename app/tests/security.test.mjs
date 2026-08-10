import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";

if (!globalThis.crypto) globalThis.crypto = webcrypto;
if (!globalThis.btoa) globalThis.btoa = (value) => Buffer.from(value, "binary").toString("base64");
if (!globalThis.atob) globalThis.atob = (value) => Buffer.from(value, "base64").toString("binary");

const {
  createEncryptedBackup,
  createLocalVault,
  createNearbyPayload,
  decryptBackup,
  decryptNearbyPayload,
  mergeRecords,
  unlockLocalVault,
} = await import("../src/security.js");

const records = [{
  id: "account-1",
  title: "测试账号",
  account: "demo@example.com",
  password: "never-plain",
  createdAt: "2026-08-09T00:00:00.000Z",
  updatedAt: "2026-08-09T00:00:00.000Z",
  deletedAt: null,
}];

test("portable backups omit secret fields unless explicitly included", async () => {
  const safeBackup = await createEncryptedBackup(records, "backup-password");
  const safePayload = await decryptBackup(safeBackup, "backup-password");
  assert.equal(safePayload.records[0].password, undefined);

  const fullBackup = await createEncryptedBackup(records, "backup-password", { includeSecrets: true });
  const fullPayload = await decryptBackup(fullBackup, "backup-password");
  assert.equal(fullPayload.records[0].password, "never-plain");
});

test("local vault requires the correct password", async () => {
  const secured = await createLocalVault(records, "local-password");
  const unlocked = await unlockLocalVault(secured.config, secured.vault, "local-password");
  assert.equal(unlocked.records[0].account, "demo@example.com");
  await assert.rejects(() => unlockLocalVault(secured.config, secured.vault, "wrong-password"), /密码不正确/u);
});

test("nearby payload is encrypted with an ephemeral key", async () => {
  const nearby = await createNearbyPayload(records, { includeSecrets: true });
  assert.equal(nearby.encrypted.includes("never-plain"), false);
  const payload = await decryptNearbyPayload(nearby.encrypted, nearby.key);
  assert.equal(payload.records[0].password, "never-plain");
});

test("record merge keeps the newest update and deletion tombstones", () => {
  const local = [{ ...records[0], title: "旧", updatedAt: "2026-08-09T01:00:00.000Z" }];
  const remote = [{ ...records[0], title: "旧", deletedAt: "2026-08-09T02:00:00.000Z", updatedAt: "2026-08-09T02:00:00.000Z" }];
  const merged = mergeRecords(local, remote);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].deletedAt, "2026-08-09T02:00:00.000Z");
});
