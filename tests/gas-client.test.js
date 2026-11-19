import test from "node:test";
import assert from "node:assert/strict";
import { validateGasAction } from "../src/integrations/gas-client.js";

test("GAS action validator accepts registered actions", () => {
  const payload = { spreadsheetId: "example", range: "Sheet1!A1:B5" };
  assert.equal(validateGasAction("sheets.read", payload), payload);
  assert.deepEqual(validateGasAction("system.ping", {}), {});
});

test("GAS action validator rejects unknown actions", () => {
  assert.throws(
    () => validateGasAction("system.execute_arbitrary_code", {}),
    /許可されていないGAS操作/
  );
});

test("GAS action validator requires an object payload", () => {
  assert.throws(() => validateGasAction("sheets.read", null), /オブジェクト/);
  assert.throws(() => validateGasAction("sheets.read", []), /オブジェクト/);
});

test("GAS action validator rejects oversized payloads", () => {
  assert.throws(
    () => validateGasAction("sheets.write", { value: "あ".repeat(6000) }),
    /大きすぎます/
  );
});

test("GAS action validator rejects circular payloads", () => {
  const payload = {};
  payload.self = payload;
  assert.throws(
    () => validateGasAction("sheets.read", payload),
    /JSONに変換できません/
  );
});
