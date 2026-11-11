import { requestChatCompletion } from "./provider-interface.js";

export function callOpenAICompatible({ env, messages, tools = [] }) {
  return requestChatCompletion({
    baseUrl: env.OPENAI_COMPATIBLE_BASE_URL || "https://api.openai.com/v1",
    apiKey: env.OPENAI_COMPATIBLE_API_KEY,
    model: env.OPENAI_COMPATIBLE_MODEL || "gpt-4.1-mini",
    messages,
    tools,
    timeoutMs: 18000
  });
}
