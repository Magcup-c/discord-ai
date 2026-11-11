import test from "node:test";
import assert from "node:assert/strict";
import { registerTool, getToolDefinitions, executeTool } from "../src/core/tool-registry.js";

const testName = "test_registry_echo";
registerTool({
  type: "function",
  function: {
    name: testName,
    description: "Test tool",
    parameters: {
      type: "object",
      properties: { message: { type: "string", minLength: 1, maxLength: 10 } },
      required: ["message"],
      additionalProperties: false
    }
  }
}, async ({ message }) => ({ message }));

test("tool definitions can be filtered by user permissions", () => {
  assert.equal(getToolDefinitions([testName]).some(item => item.function.name === testName), true);
  assert.equal(getToolDefinitions([]).some(item => item.function.name === testName), false);
});

test("tool execution validates schema and permissions", async () => {
  assert.deepEqual(await executeTool(testName, { message: "hello" }, { allowedTools: [testName] }), { message: "hello" });
  await assert.rejects(() => executeTool(testName, { message: "hello" }, { allowedTools: [] }), /permission denied/i);
  await assert.rejects(() => executeTool(testName, {}, { allowedTools: [testName] }), /required/i);
  await assert.rejects(() => executeTool(testName, { message: "this message is too long" }, { allowedTools: [testName] }), /too long/i);
  await assert.rejects(() => executeTool(testName, { message: "ok", extra: true }, { allowedTools: [testName] }), /not allowed/i);
});
