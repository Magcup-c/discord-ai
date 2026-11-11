import test from "node:test";
import assert from "node:assert/strict";
import { encryptSecret, decryptSecret, randomBase64Url, sha256Hex, pkceChallenge } from "../src/integrations/crypto.js";

const env = { OAUTH_TOKEN_ENCRYPTION_KEY: "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=" };

test("AES-GCM encryption round-trips secrets", async () => {
  const encrypted = await encryptSecret("refresh-token-secret", env);
  assert.notEqual(encrypted, "refresh-token-secret");
  assert.equal(await decryptSecret(encrypted, env), "refresh-token-secret");
});

test("AES-GCM uses a fresh IV for each encryption", async () => {
  const first = await encryptSecret("same", env);
  const second = await encryptSecret("same", env);
  assert.notEqual(first, second);
});

test("encryption rejects an invalid key", async () => {
  await assert.rejects(encryptSecret("secret", { OAUTH_TOKEN_ENCRYPTION_KEY: "bad" }));
});

test("state and PKCE helpers produce URL-safe values", async () => {
  const state = randomBase64Url(32);
  const verifier = randomBase64Url(32);
  assert.match(state, /^[A-Za-z0-9_-]+$/);
  assert.equal(state.length, 43);
  assert.equal((await sha256Hex(state)).length, 64);
  assert.match(await pkceChallenge(verifier), /^[A-Za-z0-9_-]+$/);
});
