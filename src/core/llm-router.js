import { callGroq } from "../providers/groq.js";
import { callOpenAICompatible } from "../providers/openai-compatible.js";

export async function callLLM({ env, messages, tools = [], model }) {
  const provider = (env.LLM_PROVIDER || "groq").toLowerCase();

  if (provider === "groq") {
    return callGroq({ env, messages, tools, model });
  }

  if (provider === "openai-compatible") {
    return callOpenAICompatible({ env, messages, tools, model });
  }

  throw new Error(`Unsupported LLM_PROVIDER: ${provider}`);
}
