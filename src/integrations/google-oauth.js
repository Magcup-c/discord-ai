import {
  decryptSecret,
  encryptSecret,
  pkceChallenge,
  randomBase64Url,
  sha256Hex
} from "./crypto.js";

const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";
const GOOGLE_REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke";
const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/drive.metadata.readonly",
  "https://www.googleapis.com/auth/calendar.readonly"
];

function requireGoogleConfig(env) {
  for (const key of ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI", "OAUTH_TOKEN_ENCRYPTION_KEY"]) {
    if (!env[key]) throw new Error(`Missing OAuth configuration: ${key}`);
  }
}

export async function createGoogleAuthorizationUrl(db, env, userId) {
  if (!db || !userId) throw new Error("Database or Discord user is unavailable");
  requireGoogleConfig(env);

  const state = randomBase64Url(32);
  const verifier = randomBase64Url(32);
  const challenge = await pkceChallenge(verifier);
  const stateHash = await sha256Hex(state);
  const verifierCiphertext = await encryptSecret(verifier, env);

  await db.prepare(
  await db.prepare("INSERT OR IGNORE INTO users (user_id) VALUES (?)").bind(userId).run();

    `INSERT INTO oauth_states
      (state_hash, user_id, provider, code_verifier_ciphertext, expires_at)
     VALUES (?, ?, 'google', ?, datetime('now', '+10 minutes'))`
  ).bind(stateHash, userId, verifierCiphertext).run();

  const url = new URL(GOOGLE_AUTH_ENDPOINT);
  url.search = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: env.GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256"
  }).toString();
  return url.toString();
}

async function consumeOAuthState(db, state) {
  const stateHash = await sha256Hex(state);
  return db.prepare(
    `UPDATE oauth_states
       SET consumed_at = CURRENT_TIMESTAMP
     WHERE state_hash = ?
       AND provider = 'google'
       AND consumed_at IS NULL
       AND expires_at > CURRENT_TIMESTAMP
     RETURNING user_id, code_verifier_ciphertext`
  ).bind(stateHash).first();
}

async function exchangeAuthorizationCode(env, code, verifier) {
  const body = new URLSearchParams({
    code,
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    redirect_uri: env.GOOGLE_REDIRECT_URI,
    grant_type: "authorization_code",
    code_verifier: verifier
  });
  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) {
    throw new Error(`Google token exchange failed (${response.status})`);
  }
  return data;
}

async function fetchGoogleIdentity(accessToken) {
  const response = await fetch(GOOGLE_USERINFO_ENDPOINT, {
    headers: { authorization: `Bearer ${accessToken}` }
  });
  if (!response.ok) throw new Error(`Google userinfo failed (${response.status})`);
  const data = await response.json();
  if (!data.sub) throw new Error("Google account identity is missing");
  return { subject: data.sub, email: String(data.email || "").slice(0, 254) };
}

export async function handleGoogleOAuthCallback(request, env) {
  requireGoogleConfig(env);
  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const providerError = url.searchParams.get("error");

  if (!state || state.length > 256) {
    return new Response("OAuth state is missing or invalid. Return to Discord and try /connect again.", { status: 400 });
  }

  const pending = await consumeOAuthState(env.DB, state);
  if (!pending) {
    return new Response("This authorization link is expired or has already been used. Return to Discord and try /connect again.", { status: 400 });
  }
  if (providerError || !code || code.length > 2048) {
    return new Response("Google authorization was not completed. You can close this page and try again in Discord.", { status: 400 });
  }

  try {
    const verifier = await decryptSecret(pending.code_verifier_ciphertext, env);
    const tokens = await exchangeAuthorizationCode(env, code, verifier);
    const identity = await fetchGoogleIdentity(tokens.access_token);
    const existing = await env.DB.prepare(
      "SELECT refresh_token_ciphertext FROM oauth_connections WHERE user_id = ? AND provider = 'google'"
    ).bind(pending.user_id).first();

    const accessCiphertext = await encryptSecret(tokens.access_token, env);
    const refreshCiphertext = tokens.refresh_token
      ? await encryptSecret(tokens.refresh_token, env)
      : existing?.refresh_token_ciphertext || null;
    const expiresAt = new Date(Date.now() + Math.max(60, Number(tokens.expires_in) || 3600) * 1000).toISOString();
    const scopes = String(tokens.scope || GOOGLE_SCOPES.join(" ")).split(" ").filter(Boolean);

    await env.DB.prepare(
      `INSERT INTO oauth_connections
        (user_id, provider, provider_subject, email, access_token_ciphertext,
         refresh_token_ciphertext, expires_at, scopes, created_at, updated_at)
       VALUES (?, 'google', ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT(user_id, provider) DO UPDATE SET
         provider_subject = excluded.provider_subject,
         email = excluded.email,
         access_token_ciphertext = excluded.access_token_ciphertext,
         refresh_token_ciphertext = COALESCE(excluded.refresh_token_ciphertext, oauth_connections.refresh_token_ciphertext),
         expires_at = excluded.expires_at,
         scopes = excluded.scopes,
         updated_at = CURRENT_TIMESTAMP`
    ).bind(
      pending.user_id,
      identity.subject,
      identity.email,
      accessCiphertext,
      refreshCiphertext,
      expiresAt,
      JSON.stringify(scopes)
    ).run();

    return new Response(
      "Googleアカウントの連携が完了しました。Discordに戻り、/connections で確認できます。",
      { status: 200, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } }
    );
  } catch (error) {
    console.error("Google OAuth callback failed:", error);
    return new Response(
      "Googleアカウントを連携できませんでした。Discordに戻って設定を確認してください。",
      { status: 500, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } }
    );
  }
}

async function refreshGoogleAccessToken(db, env, userId, connection) {
  const refreshToken = await decryptSecret(connection.refresh_token_ciphertext, env);
  if (!refreshToken) throw new Error("Google connection requires reauthorization");

  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token"
    })
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) {
    throw new Error(`Google token refresh failed (${response.status})`);
  }

  const accessCiphertext = await encryptSecret(data.access_token, env);
  const refreshCiphertext = data.refresh_token ? await encryptSecret(data.refresh_token, env) : connection.refresh_token_ciphertext;
  const expiresAt = new Date(Date.now() + Math.max(60, Number(data.expires_in) || 3600) * 1000).toISOString();
  await db.prepare(
    `UPDATE oauth_connections
       SET access_token_ciphertext = ?, refresh_token_ciphertext = ?, expires_at = ?, updated_at = CURRENT_TIMESTAMP
     WHERE user_id = ? AND provider = 'google'`
  ).bind(accessCiphertext, refreshCiphertext, expiresAt, userId).run();
  return data.access_token;
}

export async function getGoogleAccessToken(db, env, userId) {
  if (!db || !userId) throw new Error("User context is required");
  const connection = await db.prepare(
    "SELECT access_token_ciphertext, refresh_token_ciphertext, expires_at FROM oauth_connections WHERE user_id = ? AND provider = 'google'"
  ).bind(userId).first();
  if (!connection) throw new Error("Google account is not connected. Use /connect provider:google first.");

  if (connection.expires_at && Date.parse(connection.expires_at) > Date.now() + 60_000) {
    return decryptSecret(connection.access_token_ciphertext, env);
  }
  return refreshGoogleAccessToken(db, env, userId, connection);
}

export async function listUserConnections(db, userId) {
  if (!db || !userId) return [];
  const result = await db.prepare(
    "SELECT provider, email, scopes, created_at, updated_at FROM oauth_connections WHERE user_id = ? ORDER BY provider"
  ).bind(userId).all();
  return result.results || [];
}

export async function disconnectGoogle(db, env, userId) {
  const connection = await db.prepare(
    "SELECT access_token_ciphertext, refresh_token_ciphertext FROM oauth_connections WHERE user_id = ? AND provider = 'google'"
  ).bind(userId).first();
  if (!connection) return false;

  for (const encrypted of [connection.access_token_ciphertext, connection.refresh_token_ciphertext]) {
    if (!encrypted) continue;
    try {
      const token = await decryptSecret(encrypted, env);
      await fetch(GOOGLE_REVOKE_ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token })
      });
    } catch (error) {
      console.warn("Google token revocation request failed:", error);
    }
  }
  await db.prepare(
    "DELETE FROM oauth_connections WHERE user_id = ? AND provider = 'google'"
  ).bind(userId).run();
  return true;
}

export async function searchGoogleData({ service, query }, context = {}) {
  const token = await getGoogleAccessToken(context.env?.DB, context.env, context.userId);
  const headers = { authorization: `Bearer ${token}` };
  const encodedQuery = encodeURIComponent(query.trim());
  let endpoint;

  if (service === "drive") {
    const q = encodeURIComponent(`name contains '${query.trim().replace(/'/g, "\\'")}' and trashed = false`);
    endpoint = `https://www.googleapis.com/drive/v3/files?q=${q}&pageSize=5&orderBy=modifiedTime%20desc&fields=files(id,name,mimeType,modifiedTime,webViewLink)`;
  } else if (service === "calendar") {
    endpoint = `https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=10&singleEvents=true&orderBy=startTime&timeMin=${encodeURIComponent(new Date().toISOString())}&q=${encodedQuery}`;
  } else {
    throw new Error("Unsupported Google service");
  }

  const response = await fetch(endpoint, { headers });
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error("Google API access denied or consent needs refreshing");
    }
    throw new Error(`Google API request failed (${response.status})`);
  }

  if (service === "drive") {
    return {
      service,
      results: (data.files || []).map(file => ({
        name: file.name,
        type: file.mimeType,
        modifiedTime: file.modifiedTime,
        url: file.webViewLink
      }))
    };
  }

  return {
    service,
    results: (data.items || []).map(event => ({
      title: event.summary || "(タイトルなし)",
      start: event.start?.dateTime || event.start?.date,
      end: event.end?.dateTime || event.end?.date,
      url: event.htmlLink
    }))
  };
}
