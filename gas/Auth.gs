/** HMAC request authentication. Secret is stored only in Script Properties. */
function verifyRequest_(req) {
  if (!req || req.version !== 1 || !req.timestamp || !req.nonce ||
      !req.request_id || !req.action || typeof req.payload !== "object") {
    throw new Error("Invalid request");
  }
  var timestamp = Number(req.timestamp);
  if (!Number.isFinite(timestamp) || Math.abs(Math.floor(Date.now() / 1000) - timestamp) > 300) {
    throw new Error("Request expired");
  }
  var secret = PropertiesService.getScriptProperties().getProperty("GAS_SHARED_SECRET");
  if (!secret || typeof req.signature !== "string") throw new Error("Authentication failed");
  var canonical = [
    req.version, req.timestamp, req.nonce, req.request_id,
    req.action, JSON.stringify(req.payload || {})
  ].join("\n");
  var digest = Utilities.computeHmacSha256Signature(canonical, secret, Utilities.Charset.UTF_8);
  var expected = digest.map(function(b) {
    var n = (b + 256) % 256;
    return n.toString(16).padStart(2, "0");
  }).join("");
  if (!constantTimeEqual_(expected, req.signature.toLowerCase())) throw new Error("Authentication failed");

  // Cache nonce after signature validation. Lock prevents concurrent duplicate use.
  var lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    var cache = CacheService.getScriptCache();
    var key = "gas_nonce_" + String(req.nonce).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
    if (cache.get(key)) throw new Error("Request already used");
    cache.put(key, "1", 600);
  } finally {
    lock.releaseLock();
  }
}

function constantTimeEqual_(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function requireString_(value, name, max) {
  if (typeof value !== "string" || !value.trim() || value.length > (max || 300)) {
    throw new Error("Missing required field");
  }
  return value.trim();
}
