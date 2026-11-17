import { decryptData, encryptData } from "../integrations/crypto.js";

const SEARCH_CONTEXT_PREFIX = "[SEARCH_CONTEXT_V1]";
const ENCRYPTED_PREFIX = "enc:v1:";

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

async function decryptAndMigrateMessage(db, row, env) {
  const plaintext = await decryptData(row.content, env);
  if (!row.content.startsWith(ENCRYPTED_PREFIX)) {
    const encrypted = await encryptData(plaintext, env);
    await db.prepare("UPDATE messages SET content = ? WHERE id = ? AND content = ?")
      .bind(encrypted, row.id, row.content).run();
  }
  return plaintext;
}

export async function loadRecentMessages(db, userId, channelId, limit = 12, env) {
  if (!db || !userId) return [];
  const id = conversationId(userId, channelId);
  try {
    const result = await db.prepare(
      "SELECT id, role, content FROM messages WHERE conversation_id = ? ORDER BY id DESC LIMIT ?"
    ).bind(id, limit + 20).all();
    const rows = (result.results || []).reverse();
    const messages = [];
    for (const row of rows) {
      if (!["user", "assistant"].includes(row.role)) continue;
      const content = await decryptAndMigrateMessage(db, row, env);
      if (row.role === "assistant" && content.startsWith(SEARCH_CONTEXT_PREFIX)) continue;
      messages.push({ role: row.role, content });
    }
    return messages.slice(-limit);
  } catch (error) {
    console.error("Could not load conversation history:", error);
    return [];
  }
}

export async function saveMessage(db, userId, channelId, role, content, guildId = null, env) {
  if (!db || !userId || !["user", "assistant"].includes(role)) return;
  try {
    const id = await ensureConversation(db, userId, channelId, guildId);
    const plaintext = String(content).slice(0, 8000);
    const encrypted = await encryptData(plaintext, env);
    await db.prepare(
      "INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)"
    ).bind(id, role, encrypted).run();
  } catch (error) {
    console.error("Could not save conversation message:", error);
  }
}

export async function saveSearchContext(db, userId, channelId, context, guildId = null, env) {
  if (!db || !userId || !context || !Array.isArray(context.results)) return;
  try {
    const id = await ensureConversation(db, userId, channelId, guildId);
    const safeContext = {
      query: String(context.query || "").slice(0, 300),
      savedAt: Date.now(),
      results: context.results.slice(0, 5).map(item => ({
        title: String(item.title || "").slice(0, 140),
        text: String(item.text || "").slice(0, 650),
        url: String(item.url || "").slice(0, 350)
      }))
    };
    const plaintext = (SEARCH_CONTEXT_PREFIX + JSON.stringify(safeContext)).slice(0, 7800);
    const encrypted = await encryptData(plaintext, env);
    await db.prepare(
      "INSERT INTO messages (conversation_id, role, content) VALUES (?, 'assistant', ?)"
    ).bind(id, encrypted).run();
  } catch (error) {
    console.error("Could not save search context:", error);
  }
}

export async function loadLatestSearchContext(db, userId, channelId, maxAgeMs = 24 * 60 * 60 * 1000, env) {
  if (!db || !userId) return null;
  const id = conversationId(userId, channelId);
  try {
    const result = await db.prepare(
      "SELECT id, content FROM messages WHERE conversation_id = ? AND role = 'assistant' ORDER BY id DESC LIMIT 30"
    ).bind(id).all();
    for (const row of result.results || []) {
      const plaintext = await decryptAndMigrateMessage(db, row, env);
      if (!plaintext.startsWith(SEARCH_CONTEXT_PREFIX)) continue;
      const context = JSON.parse(plaintext.slice(SEARCH_CONTEXT_PREFIX.length));
      if (!Array.isArray(context.results) || !Number.isFinite(context.savedAt)) return null;
      if (Date.now() - context.savedAt > maxAgeMs || context.savedAt > Date.now() + 60_000) return null;
      return context;
    }
    return null;
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
