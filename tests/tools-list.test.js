import test from "node:test";
import assert from "node:assert/strict";
import "../src/tools/index.js";
import { getToolDefinitions } from "../src/core/tool-registry.js";
import { formatToolList } from "../src/discord/commands.js";

test("/tools lists every allowed tool name without long descriptions", () => {
  const definitions = getToolDefinitions([
    "get_weather", "web_search", "calculate", "google_search",
    "percentage", "statistics", "unit_convert", "json_format",
    "json_validate", "csv_parse", "csv_to_json", "date_difference",
    "gas_sheets_read", "gas_sheets_search", "gas_sheets_info",
    "gas_drive_search", "gas_drive_info", "gas_drive_read",
    "gas_calendar_list", "gas_calendar_search"
  ]);
  const output = formatToolList(definitions);
  assert.match(output, /gas_drive_search/);
  assert.match(output, /gas_calendar_search/);
  assert.match(output, /全20件/);
  assert.ok(output.length < 1900, "compact output should fit Discord's response limit");
});
