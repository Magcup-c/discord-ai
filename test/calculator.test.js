import test from "node:test";
import assert from "node:assert/strict";
import { calculate } from "../src/tools/calculator.js";

test("calculator respects operator precedence", () => {
  assert.equal(calculate({ expression: "2 + 3 * 4" }).result, 14);
});

test("calculator supports parentheses and exponentiation", () => {
  assert.equal(calculate({ expression: "(2 + 3) ^ 2" }).result, 25);
});

test("calculator supports decimal and negative values", () => {
  assert.equal(calculate({ expression: "-1.5 * 4" }).result, -6);
});

test("calculator rejects division by zero", () => {
  assert.throws(() => calculate({ expression: "10 / 0" }));
});

test("calculator rejects unsupported characters", () => {
  assert.throws(() => calculate({ expression: "process.exit()" }));
});
