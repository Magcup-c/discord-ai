import { requestChatCompletion } from "./provider-interface.js";

export function callGroq({ env, messages, tools = [] }) {
  return requestChatCompletion({
    baseUrl: "https://api.groq.com/openai/v1",
    apiKey: env.GROQ_API_KEY,
    model: env.GROQ_MODEL || "openai/gpt-oss-20b",
    messages,
    tools,
    timeoutMs: 18000
  });
}
