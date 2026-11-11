import { getToolDefinitions, executeTool } from "./tool-registry.js";
import { callLLM } from "./llm-router.js";

const MAX_TOOL_ROUNDS = 4;
const MAX_TOOL_CALLS = 6;

export async function runAgent({ env, messages, context = {} }) {
  const conversation = [...messages];
  const definitions = getToolDefinitions();
  let totalCalls = 0;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await callLLM({ env, messages: conversation, tools: definitions });
    const assistant = response.choices?.[0]?.message;
    if (!assistant) throw new Error("AI response is empty");

    if (!assistant.tool_calls?.length) {
      return String(assistant.content || "回答を生成できませんでした。").slice(0, 1900);
    }

    conversation.push(assistant);
    for (const toolCall of assistant.tool_calls) {
      totalCalls += 1;
      if (totalCalls > MAX_TOOL_CALLS) {
        conversation.push({
          role: "system",
          content: "ツール呼び出し上限に達しました。これまでの情報で回答してください。"
        });
        break;
      }

      const name = toolCall.function?.name;
      let result;
      try {
        if (!toolCall.id || !name) throw new Error("Malformed tool call");
        const args = JSON.parse(toolCall.function.arguments || "{}");
        result = await executeTool(name, args, context);
      } catch (error) {
        console.error(`Tool execution failed [${name || "unknown"}]:`, error);
        result = { error: "このツールを実行できませんでした。引数や設定を確認してください。" };
      }

      conversation.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify(result).slice(0, 6000)
      });
    }
  }

  const finalResponse = await callLLM({
    env,
    messages: [
      ...conversation,
      { role: "system", content: "これ以上ツールを呼び出さず、取得済みの情報だけで日本語で回答してください。" }
    ]
  });
  return String(finalResponse.choices?.[0]?.message?.content || "回答を生成できませんでした。").slice(0, 1900);
}
