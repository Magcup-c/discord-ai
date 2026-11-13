const SEARCH_CONTEXT_PREFIX = "[SEARCH_CONTEXT_V1]";

function conversationId(userId, channelId) {
  return `${userId}:${channelId}`;
}

async function ensureConversation(db, userId, channelId, guildId = null) {
  const id = conversationId(userId, channelId);
  await db.prepare("INSERT OR IGNORE INTO users (user_id) VALUES (?)").bind(userId).run();
  await db.prepare(
    "INSERT OR IGNORE INTO conversations (conversation_id, user_id, guild_id) VALUES (?, ?, ?)"
  ).bind(id, userId, guildId).run();
  return id;
}

export async function loadRecentMessages(db, userId, channelId, limit = 12) {
  if (!db || !userId) return [];
  const id = conversationId(userId, channelId);
  try {
    const result = await db.prepare(
      "SELECT role, content FROM messages WHERE conversation_id = ? AND NOT (role = 'assistant' AND substr(content, 1, ?) = ?) ORDER BY id DESC LIMIT ?"
    ).bind(id, SEARCH_CONTEXT_PREFIX.length, SEARCH_CONTEXT_PREFIX, limit).all();
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
  try {
    const id = await ensureConversation(db, userId, channelId, guildId);
    await db.prepare(
      "INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)"
    ).bind(id, role, String(content).slice(0, 8000)).run();
  } catch (error) {
    console.error("Could not save conversation message:", error);
  }
}

export async function saveSearchContext(db, userId, channelId, context, guildId = null) {
  if (!db || !userId || !context || !Array.isArray(context.results)) return;
  try {
    const id = await ensureConversation(db, userId, channelId, guildId);
    const safeContext = {
      query: String(context.query || "").slice(0, 300),
      savedAt: Date.now(),
      results: context.results.slice(0, 5).map(item => ({
        title: String(item.title || "").slice(0, 180),
        text: String(item.text || "").slice(0, 900),
        url: String(item.url || "").slice(0, 500)
      }))
    };
    const content = SEARCH_CONTEXT_PREFIX + JSON.stringify(safeContext);
    await db.prepare(
      "INSERT INTO messages (conversation_id, role, content) VALUES (?, 'assistant', ?)"
    ).bind(id, content.slice(0, 7800)).run();
  } catch (error) {
    console.error("Could not save search context:", error);
  }
}

export async function loadLatestSearchContext(db, userId, channelId, maxAgeMs = 24 * 60 * 60 * 1000) {
  if (!db || !userId) return null;
  const id = conversationId(userId, channelId);
  try {
    const result = await db.prepare(
      "SELECT content FROM messages WHERE conversation_id = ? AND role = 'assistant' AND substr(content, 1, ?) = ? ORDER BY id DESC LIMIT 1"
    ).bind(id, SEARCH_CONTEXT_PREFIX.length, SEARCH_CONTEXT_PREFIX).first();
    if (!result?.content) return null;
    const context = JSON.parse(result.content.slice(SEARCH_CONTEXT_PREFIX.length));
    if (!Array.isArray(context.results) || !Number.isFinite(context.savedAt)) return null;
    if (Date.now() - context.savedAt > maxAgeMs || context.savedAt > Date.now() + 60_000) return null;
    return context;
  } catch (error) {
    console.error("Could not load search context:", error);
    return null;
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
