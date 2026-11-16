import { decryptData, encryptData } from "../integrations/crypto.js";

const ENCRYPTED_PREFIX = "enc:v1:";

async function ensureUser(db, userId) {
  await db.prepare("INSERT OR IGNORE INTO users (user_id) VALUES (?)").bind(userId).run();
}

export async function listMemories(db, userId, env) {
  if (!db || !userId) return [];
  const result = await db.prepare(
    "SELECT id, memory_key, memory_value, created_at, updated_at FROM user_memories WHERE user_id = ? ORDER BY updated_at DESC LIMIT 50"
  ).bind(userId).all();
  const memories = [];
  for (const row of result.results || []) {
    const value = await decryptData(row.memory_value, env);
    if (!row.memory_value.startsWith(ENCRYPTED_PREFIX)) {
      const encrypted = await encryptData(value, env);
      await db.prepare("UPDATE user_memories SET memory_value = ? WHERE id = ? AND memory_value = ?")
        .bind(encrypted, row.id, row.memory_value).run();
    }
    memories.push({
      memory_key: row.memory_key,
      memory_value: value,
      created_at: row.created_at,
      updated_at: row.updated_at
    });
  }
  return memories;
}

export async function saveMemory(db, userId, key, value, env) {
  if (!db || !userId) throw new Error("Database or user is unavailable");
  await ensureUser(db, userId);
  const encryptedValue = await encryptData(String(value), env);
  await db.prepare(
    `INSERT INTO user_memories (user_id, memory_key, memory_value, consented_at)
     VALUES (?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(user_id, memory_key) DO UPDATE SET
       memory_value = excluded.memory_value,
       consented_at = CURRENT_TIMESTAMP,
       updated_at = CURRENT_TIMESTAMP`
  ).bind(userId, key, encryptedValue).run();
}

export async function deleteMemory(db, userId, key) {
  if (!db || !userId) return false;
  const result = await db.prepare(
    "DELETE FROM user_memories WHERE user_id = ? AND memory_key = ?"
  ).bind(userId, key).run();
  return (result.meta?.changes || 0) > 0;
}

export async function clearMemories(db, userId) {
  if (!db || !userId) return 0;
  const result = await db.prepare(
    "DELETE FROM user_memories WHERE user_id = ?"
  ).bind(userId).run();
  return result.meta?.changes || 0;
}
