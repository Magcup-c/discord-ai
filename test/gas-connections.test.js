import test from "node:test";
import assert from "node:assert/strict";
import { validateGasWebAppUrl } from "../src/integrations/gas-connections.js";

test("accepts a standard Apps Script web app deployment URL", () => {
  const url = "https://script.google.com/macros/s/AbCdEf_123-xyz/exec";
  assert.equal(validateGasWebAppUrl(url), url);
});

test("rejects non-HTTPS and non-Google hosts", () => {
  assert.throws(() => validateGasWebAppUrl("http://script.google.com/macros/s/id/exec"));
  assert.throws(() => validateGasWebAppUrl("https://example.com/macros/s/id/exec"));
  assert.throws(() => validateGasWebAppUrl("https://script.google.com.evil.example/macros/s/id/exec"));
});

test("rejects credentials, query strings, fragments, ports, and unexpected paths", () => {
  assert.throws(() => validateGasWebAppUrl("https://user:pass@script.google.com/macros/s/id/exec"));
  assert.throws(() => validateGasWebAppUrl("https://script.google.com:8443/macros/s/id/exec"));
  assert.throws(() => validateGasWebAppUrl("https://script.google.com/macros/s/id/exec?x=1"));
  assert.throws(() => validateGasWebAppUrl("https://script.google.com/macros/s/id/exec#fragment"));
  assert.throws(() => validateGasWebAppUrl("https://script.google.com/macros/s/id/dev"));
  assert.throws(() => validateGasWebAppUrl("https://script.google.com/macros/s/id/exec/extra"));
});

test("rejects malformed and oversized values", () => {
  assert.throws(() => validateGasWebAppUrl("not a URL"));
  assert.throws(() => validateGasWebAppUrl("https://script.google.com/macros/s/" + "x".repeat(600) + "/exec"));
});
