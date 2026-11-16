import test from "node:test";
import assert from "node:assert/strict";
import { decryptData, encryptData } from "../src/integrations/crypto.js";

const key = Buffer.alloc(32, 7).toString("base64");
const env = { D1_DATA_ENCRYPTION_KEY: key };

test("D1 data encryption round-trips and does not store plaintext", async () => {
  const plaintext = "private conversation text";
  const encrypted = await encryptData(plaintext, env);
  assert.match(encrypted, /^enc:v1:/);
  assert.equal(encrypted.includes(plaintext), false);
  assert.equal(await decryptData(encrypted, env), plaintext);
});

test("D1 data decryption accepts legacy plaintext for lazy migration", async () => {
  assert.equal(await decryptData("legacy row", env), "legacy row");
});

test("D1 data encryption uses authenticated encryption", async () => {
  const encrypted = await encryptData("authenticated value", env);
  const tampered = encrypted.slice(0, -1) + (encrypted.endsWith("A") ? "B" : "A");
  await assert.rejects(() => decryptData(tampered, env));
});

test("D1 data encryption requires a dedicated 32-byte key", async () => {
  await assert.rejects(() => encryptData("value", {}));
  await assert.rejects(() => encryptData("value", { D1_DATA_ENCRYPTION_KEY: "not-a-key" }));
});
