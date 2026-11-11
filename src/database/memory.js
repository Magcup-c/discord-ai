async function ensureUser(db, userId) {
  await db.prepare("INSERT OR IGNORE INTO users (user_id) VALUES (?)").bind(userId).run();
}

export async function listMemories(db, userId) {
  if (!db || !userId) return [];
  const result = await db.prepare(
    "SELECT memory_key, memory_value, created_at, updated_at FROM user_memories WHERE user_id = ? ORDER BY updated_at DESC LIMIT 50"
  ).bind(userId).all();
  return result.results || [];
}

export async function saveMemory(db, userId, key, value) {
  if (!db || !userId) throw new Error("Database or user is unavailable");
  await ensureUser(db, userId);
  await db.prepare(
    `INSERT INTO user_memories (user_id, memory_key, memory_value, consented_at)
     VALUES (?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(user_id, memory_key) DO UPDATE SET
       memory_value = excluded.memory_value,
       consented_at = CURRENT_TIMESTAMP,
       updated_at = CURRENT_TIMESTAMP`
  ).bind(userId, key, value).run();
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
