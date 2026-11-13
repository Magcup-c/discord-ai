import { getToolDefinitions, executeTool } from "./tool-registry.js";
import { callLLM } from "./llm-router.js";
import { recordUsage } from "../database/usage.js";

const MAX_TOOL_ROUNDS = 4;
const MAX_TOOL_CALLS = 6;
const MAX_REFERENCES = 8;

function normalizeSearchSources(items) {
  if (!Array.isArray(items)) return [];
  return items.flatMap(item => {
    if (!item || typeof item.url !== "string") return [];
    try {
      const url = new URL(item.url);
      if (!["http:", "https:"].includes(url.protocol)) return [];
      return [{
        title: String(item.title || url.hostname).slice(0, 180),
        url: url.toString()
      }];
    } catch {
      return [];
    }
  });
}

export function formatSearchReferences(items) {
  const seen = new Set();
  const sources = [];
  for (const source of normalizeSearchSources(items)) {
    if (seen.has(source.url)) continue;
    seen.add(source.url);
    sources.push(source);
    if (sources.length >= MAX_REFERENCES) break;
  }
  if (!sources.length) return "";
  return "\n\n**参考情報**\n" + sources
    .map((source, index) => `[${index + 1}] ${source.title} — <${source.url}>`)
    .join("\n");
}

function appendSearchReferences(answer, sources) {
  const references = formatSearchReferences(sources);
  if (!references) return String(answer || "回答を生成できませんでした。").slice(0, 1900);
  const base = String(answer || "回答を生成できませんでした。");
  const suffix = references.slice(0, 1000);
  const budget = Math.max(100, 1900 - suffix.length);
  return base.slice(0, budget).trimEnd() + suffix;
}

async function callAndTrack({ env, messages, tools, context }) {
  const response = await callLLM({ env, messages, tools, model: context.model });
  if (context.userId && env.DB) {
    const usage = response.usage || {};
    await recordUsage(env.DB, {
      userId: context.userId,
      provider: (env.LLM_PROVIDER || "groq").toLowerCase(),
      model: response.model || context.model || env.GROQ_MODEL || env.OPENAI_COMPATIBLE_MODEL || "unknown",
      promptTokens: usage.prompt_tokens ?? usage.input_tokens ?? 0,
      completionTokens: usage.completion_tokens ?? usage.output_tokens ?? 0
    });
  }
  return response;
}

export async function runAgent({ env, messages, context = {} }) {
  const conversation = [...messages];
  const definitions = getToolDefinitions(context.allowedTools);
  const searchSources = normalizeSearchSources(context.initialSearchResults || []);
  let totalCalls = 0;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await callAndTrack({ env, messages: conversation, tools: definitions, context });
    const assistant = response.choices?.[0]?.message;
    if (!assistant) throw new Error("AI response is empty");

    if (!assistant.tool_calls?.length) {
      return appendSearchReferences(assistant.content, searchSources);
    }

    conversation.push(assistant);
    for (const toolCall of assistant.tool_calls) {
      const name = toolCall.function?.name;
      if (!toolCall.id) {
        console.error("Ignoring tool call without an ID");
        continue;
      }

      let result;
      if (totalCalls >= MAX_TOOL_CALLS) {
        result = { error: "この会話で実行できるツール呼び出し上限に達しました。" };
      } else {
        totalCalls += 1;
        try {
          if (!name) throw new Error("Malformed tool call");
          const args = JSON.parse(toolCall.function.arguments || "{}");
          result = await executeTool(name, args, context);
          if (name === "web_search" && Array.isArray(result?.results)) {
            searchSources.push(...normalizeSearchSources(result.results));
          }
        } catch (error) {
          console.error(`Tool execution failed [${name || "unknown"}]:`, error);
          result = { error: "このツールを実行できませんでした。引数、権限、設定を確認してください。" };
        }
      }

      conversation.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify(result).slice(0, 6000)
      });
    }
  }

  const finalResponse = await callAndTrack({
    env,
    messages: [
      ...conversation,
      { role: "system", content: "これ以上ツールを呼び出さず、取得済みの情報だけで回答してください。検索結果を使った場合は本文中に[1]の形式で出典番号を付け、裏付けのない主張には付けないでください。" }
    ],
    context
  });
  return appendSearchReferences(
    finalResponse.choices?.[0]?.message?.content || "回答を生成できませんでした。",
    searchSources
  );
}
