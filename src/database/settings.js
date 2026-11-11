const DEFAULT_SETTINGS = Object.freeze({
  language: "ja",
  response_style: "balanced",
  memory_enabled: false
});

export async function getUserSettings(db, userId) {
  if (!db || !userId) return { ...DEFAULT_SETTINGS };
  const row = await db.prepare("SELECT settings FROM users WHERE user_id = ?").bind(userId).first();
  let stored = {};
  try {
    stored = row?.settings ? JSON.parse(row.settings) : {};
  } catch {
    stored = {};
  }
  return { ...DEFAULT_SETTINGS, ...stored };
}

export async function updateUserSetting(db, userId, key, value) {
  if (!db || !userId) throw new Error("Database or user is unavailable");
  const current = await getUserSettings(db, userId);
  const next = { ...current, [key]: value };
  await db.prepare("INSERT OR IGNORE INTO users (user_id) VALUES (?)").bind(userId).run();
  await db.prepare(
    "UPDATE users SET settings = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?"
  ).bind(JSON.stringify(next), userId).run();
  return next;
}

export { DEFAULT_SETTINGS };
