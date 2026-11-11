function hexToBytes(hex) {
  if (!/^[0-9a-f]{128}$/i.test(hex || "")) return null;
  const bytes = new Uint8Array(64);
  for (let i = 0; i < 64; i++) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export async function verifyDiscordRequest(request, rawBody, publicKey) {
  const signature = request.headers.get("X-Signature-Ed25519");
  const timestamp = request.headers.get("X-Signature-Timestamp");
  const keyBytes = hexToBytes(publicKey);

  if (!signature || !timestamp || !keyBytes || !/^[0-9a-f]{128}$/i.test(signature)) {
    return false;
  }

  const seconds = Number(timestamp);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(seconds) || Math.abs(now - seconds) > 300) {
    return false;
  }

  try {
    const signatureBytes = hexToBytes(signature);
    const key = await crypto.subtle.importKey(
      "raw",
      keyBytes,
      { name: "Ed25519" },
      false,
      ["verify"]
    );
    const message = new TextEncoder().encode(timestamp + rawBody);
    return await crypto.subtle.verify("Ed25519", key, signatureBytes, message);
  } catch (error) {
    console.warn("Discord signature verification failed:", error);
    return false;
  }
}
