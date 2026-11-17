import { encryptData } from "../integrations/crypto.js";

function equalSecret(actual, expected) {
  if (typeof actual !== "string" || typeof expected !== "string" || !actual || !expected) return false;
  const length = Math.max(actual.length, expected.length);
  let difference = actual.length ^ expected.length;
  for (let i = 0; i < length; i++) {
    difference |= (actual.charCodeAt(i) || 0) ^ (expected.charCodeAt(i) || 0);
  }
  return difference === 0;
}

export async function handleD1EncryptionMigration(request, env) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: { Allow: "POST" } });
  }
  const expected = env.D1_MIGRATION_SECRET;
  const authorization = request.headers.get("authorization") || "";
  if (!expected || !equalSecret(authorization, `Bearer ${expected}`)) {
    return new Response("Not found", { status: 404 });
  }
  if (!env.DB || !env.D1_DATA_ENCRYPTION_KEY) {
    return Response.json({ error: "D1 or encryption key is not configured" }, { status: 503 });
  }

  let input = {};
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "Expected JSON body" }, { status: 400 });
  }
  const afterMessageId = Math.max(0, Math.floor(Number(input.afterMessageId) || 0));
  const afterMemoryId = Math.max(0, Math.floor(Number(input.afterMemoryId) || 0));
  const batchSize = Math.max(1, Math.min(50, Math.floor(Number(input.batchSize) || 25)));

  const messages = await env.DB.prepare(
    "SELECT id, content FROM messages WHERE id > ? AND content NOT LIKE 'enc:v1:%' ORDER BY id LIMIT ?"
  ).bind(afterMessageId, batchSize).all();
  let messageCount = 0;
  let nextMessageId = afterMessageId;
  for (const row of messages.results || []) {
    const encrypted = await encryptData(row.content, env);
    await env.DB.prepare("UPDATE messages SET content = ? WHERE id = ? AND content = ?")
      .bind(encrypted, row.id, row.content).run();
    nextMessageId = row.id;
    messageCount++;
  }

  const memories = await env.DB.prepare(
    "SELECT id, memory_value FROM user_memories WHERE id > ? AND memory_value NOT LIKE 'enc:v1:%' ORDER BY id LIMIT ?"
  ).bind(afterMemoryId, batchSize).all();
  let memoryCount = 0;
  let nextMemoryId = afterMemoryId;
  for (const row of memories.results || []) {
    const encrypted = await encryptData(row.memory_value, env);
    await env.DB.prepare("UPDATE user_memories SET memory_value = ? WHERE id = ? AND memory_value = ?")
      .bind(encrypted, row.id, row.memory_value).run();
    nextMemoryId = row.id;
    memoryCount++;
  }

  return Response.json({
    messages: { encryptedThisBatch: messageCount, nextId: nextMessageId, done: messageCount < batchSize },
    memories: { encryptedThisBatch: memoryCount, nextId: nextMemoryId, done: memoryCount < batchSize },
    batchSize
  }, { headers: { "cache-control": "no-store" } });
}
