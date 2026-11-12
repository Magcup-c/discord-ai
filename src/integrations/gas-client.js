function toHex(bytes) {
  return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function canonicalRequest(request) {
  return [
    request.version, request.timestamp, request.nonce, request.request_id,
    request.action, JSON.stringify(request.payload || {})
  ].join("\n");
}

async function signRequest(request, secret) {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  return toHex(await crypto.subtle.sign(
    "HMAC", key, new TextEncoder().encode(canonicalRequest(request))
  ));
}

function isAllowedRedirect(url) {
  return url.protocol === "https:" &&
    ["script.google.com", "script.googleusercontent.com"].includes(url.hostname) &&
    !url.username && !url.password;
}

async function postToGas(endpoint, body) {
  let url = new URL(endpoint);
  let method = "POST";
  let requestBody = body;
  let headers = { "content-type": "application/json" };
  const signal = AbortSignal.timeout(12000);

  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(url.toString(), {
      method, headers, body: requestBody, redirect: "manual", signal
    });
    if (![301, 302, 303, 307, 308].includes(response.status)) {
      if (!isAllowedRedirect(new URL(response.url || url.toString()))) {
        throw new Error("GASから許可されていない接続先への応答がありました。");
      }
      const text = await response.text();
      if (text.length > 32000) throw new Error("GASの応答が大きすぎます。");
      let data;
      try { data = JSON.parse(text); }
      catch { throw new Error("GASからJSON形式ではない応答が返されました。"); }
      return { response, data };
    }
    const location = response.headers.get("location");
    if (!location) throw new Error("GASのリダイレクト先を確認できません。");
    const nextUrl = new URL(location, url);
    if (!isAllowedRedirect(nextUrl)) throw new Error("GASのリダイレクト先が許可されていません。");
    if ([301, 302, 303].includes(response.status)) {
      method = "GET";
      requestBody = undefined;
      headers = {};
    }
    url = nextUrl;
  }
  throw new Error("GASのリダイレクト回数が上限を超えました。");
}

export async function pingGasConnection(connection) {
  if (!connection?.webAppUrl || !connection?.secret) throw new Error("GAS接続情報がありません。");
  const request = {
    version: 1,
    request_id: crypto.randomUUID(),
    timestamp: Math.floor(Date.now() / 1000),
    nonce: toHex(crypto.getRandomValues(new Uint8Array(16))),
    action: "system.ping",
    payload: {}
  };
  request.signature = await signRequest(request, connection.secret);
  let result;
  try {
    result = await postToGas(connection.webAppUrl, JSON.stringify(request));
  } catch (error) {
    if (error?.name === "TimeoutError" || error?.name === "AbortError") {
      throw new Error("GASへの接続がタイムアウトしました。");
    }
    throw error;
  }
  if (!result.response.ok || result.data?.ok !== true ||
      result.data?.request_id !== request.request_id) {
    throw new Error("GASの認証に失敗したか、正常な応答を確認できませんでした。Script Propertiesの秘密鍵とデプロイ設定を確認してください。");
  }
  return result.data;
}
