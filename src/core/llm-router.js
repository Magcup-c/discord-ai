import { callGroq } from "../providers/groq.js";
import { callOpenAICompatible } from "../providers/openai-compatible.js";

export async function callLLM({ env, messages, tools = [] }) {
  const provider = (env.LLM_PROVIDER || "groq").toLowerCase();

  if (provider === "groq") {
    return callGroq({ env, messages, tools });
  }

  if (provider === "openai-compatible") {
    return callOpenAICompatible({ env, messages, tools });
  }

  throw new Error(`Unsupported LLM_PROVIDER: ${provider}`);
}
