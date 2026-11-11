export async function requestChatCompletion({
  baseUrl,
  apiKey,
  model,
  messages,
  tools = [],
  timeoutMs = 20000
}) {
  if (!baseUrl || !apiKey || !model) {
    throw new Error("LLM provider configuration is incomplete");
  }

  const endpoint = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages,
      ...(tools.length ? { tools, tool_choice: "auto" } : {}),
      max_tokens: 1500,
      temperature: 0.7
    }),
    signal: AbortSignal.timeout(timeoutMs)
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("LLM provider error:", response.status, result?.error?.message || "unknown");
    throw new Error(`LLM provider request failed with status ${response.status}`);
  }
  return result;
}
