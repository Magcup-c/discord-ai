
import {
  getToolDefinitions,
  executeTool
} from "./tool-registry.js";

import { callLLM } from "./llm-router.js";

const MAX_TOOL_ROUNDS = 5;
const MAX_TOOL_CALLS = 8;

export async function runAgent({
  env,
  messages,
  context
}) {
  const conversation = [...messages];
  const definitions = getToolDefinitions();

  let totalCalls = 0;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await callLLM({
      env,
      messages: conversation,
      tools: definitions
    });

    const assistant = response.choices?.[0]?.message;

    if (!assistant) {
      throw new Error("AI response is empty");
    }

    // ツール呼び出しがない場合は回答完了
    if (!assistant.tool_calls?.length) {
      return assistant.content || "回答を生成できませんでした。";
    }

    conversation.push(assistant);

    for (const toolCall of assistant.tool_calls) {
      totalCalls++;

      if (totalCalls > MAX_TOOL_CALLS) {
        return "ツールの実行回数が上限に達しました。";
      }

      if (toolCall.type !== "function") {
        continue;
      }

      const name = toolCall.function.name;

      let result;

      try {
        const args = JSON.parse(
          toolCall.function.arguments || "{}"
        );

        result = await executeTool(
          name,
          args,
          context
        );

      } catch (error) {
        console.error(`Tool error [${name}]:`, error);

        result = {
          error: "ツールの実行に失敗しました。"
        };
      }

      conversation.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify(result)
      });
    }
  }

  // 最終回答を生成
  const finalResponse = await callLLM({
    env,
    messages: [
      ...conversation,
      {
        role: "system",
        content: "これ以上ツールを呼び出さず、取得済みの情報だけで回答してください。"
      }
    ],
    tools: []
  });

  return finalResponse.choices?.[0]?.message?.content ||
    "回答を生成できませんでした。";
}
