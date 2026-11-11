function conversationId(userId, channelId) {
  return `${userId}:${channelId}`;
}

export async function loadRecentMessages(db, userId, channelId, limit = 12) {
  if (!db || !userId) return [];
  const id = conversationId(userId, channelId);
  try {
    const result = await db.prepare(
      "SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY id DESC LIMIT ?"
    ).bind(id, limit).all();
    return (result.results || []).reverse().filter(row =>
      ["user", "assistant"].includes(row.role)
    );
  } catch (error) {
    console.error("Could not load conversation history:", error);
    return [];
  }
}

export async function saveMessage(db, userId, channelId, role, content, guildId = null) {
  if (!db || !userId || !["user", "assistant"].includes(role)) return;
  const id = conversationId(userId, channelId);
  try {
    await db.prepare(
      "INSERT OR IGNORE INTO users (user_id) VALUES (?)"
    ).bind(userId).run();
    await db.prepare(
      "INSERT OR IGNORE INTO conversations (conversation_id, user_id, guild_id) VALUES (?, ?, ?)"
    ).bind(id, userId, guildId).run();
    await db.prepare(
      "INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)"
    ).bind(id, role, String(content).slice(0, 8000)).run();
  } catch (error) {
    console.error("Could not save conversation message:", error);
  }
}

export async function deleteConversation(db, userId, channelId) {
  if (!db || !userId) return false;
  const id = conversationId(userId, channelId);
  try {
    await db.prepare(
      "DELETE FROM conversations WHERE conversation_id = ? AND user_id = ?"
    ).bind(id, userId).run();
    return true;
  } catch (error) {
    console.error("Could not delete conversation:", error);
    return false;
  }
}
