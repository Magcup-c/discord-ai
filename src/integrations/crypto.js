const encoder = new TextEncoder();

function toBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    throw new Error("OAUTH_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key");
  }
  const binary = atob(value);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

async function encryptionKey(env) {
  const raw = fromBase64(env.OAUTH_TOKEN_ENCRYPTION_KEY);
  if (raw.length !== 32) throw new Error("OAUTH_TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes");
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export function randomBase64Url(byteLength = 32) {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(byteLength)));
}

export async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

export async function pkceChallenge(verifier) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(verifier));
  return toBase64Url(new Uint8Array(digest));
}

export async function encryptSecret(value, env) {
  if (typeof value !== "string" || !value) return null;
  const key = await encryptionKey(env);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(value));
  return `${toBase64Url(iv)}.${toBase64Url(new Uint8Array(ciphertext))}`;
}

export async function decryptSecret(payload, env) {
  if (!payload || typeof payload !== "string") return null;
  const [ivPart, ciphertextPart, extra] = payload.split(".");
  if (!ivPart || !ciphertextPart || extra) throw new Error("Invalid encrypted secret");
  const decode = part => {
    const normalized = part.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
    const binary = atob(padded);
    return Uint8Array.from(binary, char => char.charCodeAt(0));
  };
  const iv = decode(ivPart);
  if (iv.length !== 12) throw new Error("Invalid encrypted secret IV");
  const key = await encryptionKey(env);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, decode(ciphertextPart));
  return new TextDecoder().decode(plaintext);
}
