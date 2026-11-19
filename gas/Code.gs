/**
 * Discord AI GAS bridge - entry point.
 * Deploy as a Web App (execute as owner; access: anyone), then configure
 * GAS_SHARED_SECRET in Script Properties. All requests are HMAC authenticated.
 */
function doPost(e) {
  var requestId = "";
  try {
    if (!e || !e.postData || !e.postData.contents) throw new Error("Empty request");
    var req = JSON.parse(e.postData.contents);
    requestId = String(req.request_id || "");
    verifyRequest_(req);
    var result = routeAction_(req.action, req.payload || {});
    return jsonResponse_({ ok: true, request_id: requestId, result: result });
  } catch (err) {
    // Avoid returning stack traces or internal details.
    return jsonResponse_({ ok: false, request_id: requestId, error: safeError_(err) });
  }
}

function doGet() {
  return jsonResponse_({ ok: true, service: "discord-ai-gas-bridge", message: "POST only; authenticated actions required." });
}

function jsonResponse_(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function safeError_(err) {
  var msg = err && err.message ? String(err.message) : "Request failed";
  var safe = [
    "Invalid request", "Authentication failed", "Request expired",
    "Request already used", "Action not allowed", "Missing required field",
    "Invalid date", "Not found", "Unsupported file type", "Range too large"
  ];
  return safe.indexOf(msg) >= 0 ? msg : "The requested action failed.";
}
