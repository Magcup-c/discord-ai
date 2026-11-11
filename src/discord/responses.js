export function createDeferredResponse() {
  return Response.json({
    type: 5,
    data: { }
  });
}

export async function editOriginalResponse(interaction, content) {
  const applicationId = interaction.application_id;
  const token = interaction.token;
  if (!applicationId || !token) {
    throw new Error("Interaction is missing application_id or token");
  }

  const url = `https://discord.com/api/v10/webhooks/${applicationId}/${token}/messages/@original`;
  const safeContent = String(content || "回答を生成できませんでした。").slice(0, 1900);

  const response = await fetch(url, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      content: safeContent,
      allowed_mentions: { parse: [] }
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Discord response update failed (${response.status}): ${detail.slice(0, 500)}`);
  }
}
