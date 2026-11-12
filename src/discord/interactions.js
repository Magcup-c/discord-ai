import { verifyDiscordRequest } from "../utils/validation.js";
import { createDeferredResponse, editOriginalResponse } from "./responses.js";
import { handleApplicationCommand } from "./commands.js";

export async function handleInteraction(request, env, ctx) {
  const rawBody = await request.text();
  const valid = await verifyDiscordRequest(request, rawBody, env.DISCORD_PUBLIC_KEY);

  if (!valid) {
    return new Response("Invalid request signature", { status: 401 });
  }

  let interaction;
  try {
    interaction = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  if (interaction.type === 1) {
    return Response.json({ type: 1 });
  }

  if (interaction.type !== 2) {
    return Response.json({
      type: 4,
      data: { content: "このInteractionには対応していません。", flags: 64 }
    });
  }

  const commandName = interaction.data?.name;
  const isPrivateCommand = ["connect", "connections", "disconnect", "gas"].includes(commandName);
  const response = createDeferredResponse({ ephemeral: isPrivateCommand });
  const task = handleApplicationCommand(interaction, env)
    .then(content => editOriginalResponse(interaction, content))
    .catch(async error => {
      console.error("Interaction processing failed:", error);
      try {
        await editOriginalResponse(
          interaction,
          "処理中にエラーが発生しました。設定とAPI接続を確認して、もう一度お試しください。"
        );
      } catch (editError) {
        console.error("Could not edit Discord response:", editError);
      }
    });

  ctx.waitUntil(task);
  return response;
}
