import test from "node:test";
import assert from "node:assert/strict";
import "../src/tools/index.js";
import { getToolDefinitions, executeTool } from "../src/core/tool-registry.js";

const GAS_READ_TOOLS = [
  "gas_sheets_read", "gas_sheets_search", "gas_sheets_info",
  "gas_drive_search", "gas_drive_info", "gas_drive_read",
  "gas_calendar_list", "gas_calendar_search"
];

test("all read-only GAS tools are registered", () => {
  const names = getToolDefinitions(GAS_READ_TOOLS).map(item => item.function.name);
  assert.deepEqual(names.sort(), [...GAS_READ_TOOLS].sort());
});

test("GAS read tool schemas reject invalid scope", async () => {
  await assert.rejects(
    executeTool("gas_drive_search", { query: "report", scope: "admin" }, { allowedTools: GAS_READ_TOOLS }),
    /invalid value/
  );
});

test("GAS read tool schemas reject unknown arguments", async () => {
  await assert.rejects(
    executeTool("gas_drive_search", { query: "report", arbitraryUrl: "https://example.com" }, { allowedTools: GAS_READ_TOOLS }),
    /not allowed/
  );
});

test("GAS read tools are blocked when not allowlisted", async () => {
  await assert.rejects(
    executeTool("gas_drive_search", { query: "report" }, { allowedTools: [] }),
    /permission denied/
  );
});

test("GAS read tool requires user context before contacting a connection", async () => {
  await assert.rejects(
    executeTool("gas_drive_search", { query: "report" }, { allowedTools: GAS_READ_TOOLS }),
    /ユーザー情報/
  );
});
