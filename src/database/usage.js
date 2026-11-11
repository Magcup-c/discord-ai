export async function recordUsage(db, {
  userId, provider, model, promptTokens = 0, completionTokens = 0
}) {
  if (!db || !userId) return;
  try {
    await db.prepare(
      `INSERT INTO usage_logs
       (user_id, provider, model, prompt_tokens, completion_tokens)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(
      userId,
      String(provider || "unknown").slice(0, 40),
      String(model || "unknown").slice(0, 120),
      Math.max(0, Number(promptTokens) || 0),
      Math.max(0, Number(completionTokens) || 0)
    ).run();
  } catch (error) {
    console.error("Could not record API usage:", error);
  }
}

export async function getUsageSummary(db, userId, days = 30) {
  if (!db || !userId) return { requests: 0, promptTokens: 0, completionTokens: 0, providers: [] };
  const safeDays = Math.max(1, Math.min(365, Number(days) || 30));
  const summary = await db.prepare(
    `SELECT COUNT(*) AS requests,
            COALESCE(SUM(prompt_tokens), 0) AS prompt_tokens,
            COALESCE(SUM(completion_tokens), 0) AS completion_tokens
     FROM usage_logs
     WHERE user_id = ? AND created_at >= datetime('now', ?)`
  ).bind(userId, `-${safeDays} days`).first();
  const providers = await db.prepare(
    `SELECT provider, model, COUNT(*) AS requests,
            COALESCE(SUM(prompt_tokens + completion_tokens), 0) AS tokens
     FROM usage_logs
     WHERE user_id = ? AND created_at >= datetime('now', ?)
     GROUP BY provider, model ORDER BY requests DESC LIMIT 10`
  ).bind(userId, `-${safeDays} days`).all();
  return {
    requests: summary?.requests || 0,
    promptTokens: summary?.prompt_tokens || 0,
    completionTokens: summary?.completion_tokens || 0,
    providers: providers.results || []
  };
}
