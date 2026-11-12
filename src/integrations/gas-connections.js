import { decryptSecret, encryptSecret, randomBase64Url } from "./crypto.js";

const GAS_HOST = "script.google.com";
const GAS_PATH = /^\/macros\/s\/[A-Za-z0-9_-]+\/exec\/?$/;

export function validateGasWebAppUrl(value) {
  if (typeof value !== "string" || value.length > 500) throw new Error("GAS WebアプリURLを確認してください。");
  let url;
  try { url = new URL(value); } catch { throw new Error("GAS WebアプリURLの形式が正しくありません。"); }
  if (url.protocol !== "https:" || url.hostname !== GAS_HOST || url.port ||
      url.username || url.password || url.search || url.hash || !GAS_PATH.test(url.pathname)) {
    throw new Error("URLは https://script.google.com/macros/s/{deploymentId}/exec の形式にしてください。");
  }
  return url.toString();
}

export async function createPersonalGasConnection(db, env, userId, endpoint) {
  if (!db || !userId) throw new Error("データベースまたはユーザー情報を取得できません。");
  const webAppUrl = validateGasWebAppUrl(endpoint);
  const secret = randomBase64Url(32);
  const secretCiphertext = await encryptSecret(secret, env);
  await db.prepare("INSERT OR IGNORE INTO users (user_id) VALUES (?)").bind(userId).run();
  await db.prepare(
    \`INSERT INTO gas_connections
      (id, owner_user_id, name, web_app_url, secret_ciphertext, enabled, created_at, updated_at)
     VALUES (?, ?, 'Personal GAS', ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT(owner_user_id) DO UPDATE SET
       id = excluded.id, name = excluded.name, web_app_url = excluded.web_app_url,
       secret_ciphertext = excluded.secret_ciphertext, enabled = 1,
       updated_at = CURRENT_TIMESTAMP\`
  ).bind(crypto.randomUUID(), userId, webAppUrl, secretCiphertext).run();
  return { webAppUrl, secret };
}

export async function getGasConnection(db, env, userId, scope = "personal") {
  if (scope === "shared") {
    if (!env.GAS_SHARED_WEB_APP_URL || !env.GAS_SHARED_SECRET) return null;
    return {
      scope: "shared",
      name: env.GAS_SHARED_NAME || "Shared GAS",
      webAppUrl: validateGasWebAppUrl(env.GAS_SHARED_WEB_APP_URL),
      secret: env.GAS_SHARED_SECRET
    };
  }
  if (scope !== "personal" || !db || !userId) return null;
  const row = await db.prepare(
    "SELECT id, name, web_app_url, secret_ciphertext FROM gas_connections WHERE owner_user_id = ? AND enabled = 1"
  ).bind(userId).first();
  if (!row) return null;
  return {
    id: row.id, scope: "personal", name: row.name, webAppUrl: row.web_app_url,
    secret: await decryptSecret(row.secret_ciphertext, env)
  };
}

export async function listGasConnections(db, env, userId) {
  const connections = [];
  if (db && userId) {
    const personal = await db.prepare(
      "SELECT name, web_app_url, enabled FROM gas_connections WHERE owner_user_id = ?"
    ).bind(userId).first();
    if (personal?.enabled) connections.push({
      scope: "personal", name: personal.name, endpoint: personal.web_app_url, enabled: true
    });
  }
  if (env.GAS_SHARED_WEB_APP_URL && env.GAS_SHARED_SECRET) {
    connections.push({
      scope: "shared", name: env.GAS_SHARED_NAME || "Shared GAS",
      endpoint: env.GAS_SHARED_WEB_APP_URL, enabled: true
    });
  }
  return connections;
}

export async function disconnectPersonalGas(db, userId) {
  if (!db || !userId) return false;
  const result = await db.prepare("DELETE FROM gas_connections WHERE owner_user_id = ?").bind(userId).run();
  return Number(result.meta?.changes || 0) > 0;
}
