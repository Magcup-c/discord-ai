export async function callLLM({ env, messages, tools = [] }) {
  if (!env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not configured");
  }

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.GROQ_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: env.GROQ_MODEL || "openai/gpt-oss-20b",
      messages,
      ...(tools.length ? { tools, tool_choice: "auto" } : {}),
      max_tokens: 1500,
      temperature: 0.7
    }),
    signal: AbortSignal.timeout(25000)
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("Groq API error:", response.status, result?.error?.message || "unknown");
    throw new Error(`Groq API request failed with status ${response.status}`);
  }
  return result;
}
