
export async function callLLM({
  env,
  messages,
  tools = []
}) {
  const response = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: env.GROQ_MODEL || "openai/gpt-oss-20b",
        messages,
        tools,
        tool_choice: tools.length ? "auto" : "none",
        max_tokens: 1500,
        temperature: 0.7
      })
    }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      `LLM Error ${response.status}: ${JSON.stringify(result)}`
    );
  }

  return result;
}
