import test from "node:test";
import assert from "node:assert/strict";
import {
  percentage,
  statistics,
  unitConvert,
  jsonFormat,
  jsonValidate,
  csvParse,
  csvToJson,
  dateDifference
} from "../src/tools/standard-functions.js";

test("percentage calculates a percentage without evaluating code", () => {
  assert.deepEqual(percentage({ value: 1000, percent: 15 }), {
    value: 1000, percent: 15, result: 150
  });
});

test("statistics returns common descriptive statistics", () => {
  const result = statistics({ values: [1, 2, 3, 4] });
  assert.equal(result.count, 4);
  assert.equal(result.sum, 10);
  assert.equal(result.mean, 2.5);
  assert.equal(result.median, 2.5);
  assert.equal(result.min, 1);
  assert.equal(result.max, 4);
});

test("statistics rejects empty and non-numeric input", () => {
  assert.throws(() => statistics({ values: [] }), /between 1 and 1000/);
  assert.throws(() => statistics({ values: [1, "2"] }), /finite number/);
});

test("unit conversion supports compatible units and temperatures", () => {
  assert.equal(unitConvert({ value: 2, from: "km", to: "m" }).result, 2000);
  assert.equal(unitConvert({ value: 0, from: "c", to: "f" }).result, 32);
  assert.throws(() => unitConvert({ value: 1, from: "kg", to: "m" }), /incompatible/);
});

test("JSON helpers format and validate JSON safely", () => {
  assert.equal(jsonFormat({ json: '{"a":1}' }).formatted, '{\n  "a": 1\n}');
  assert.deepEqual(jsonValidate({ json: '{"a":1}' }), { valid: true });
  assert.equal(jsonValidate({ json: "{bad" }).valid, false);
  assert.throws(() => jsonFormat({ json: "{bad" }), /JSON/);
});

test("CSV parser handles quoted delimiters, escaped quotes, and duplicate headers", () => {
  const parsed = csvParse({
    csv: 'name,name,note\n"Ada, Lovelace",Augusta,"said ""hello"""'
  });
  assert.deepEqual(parsed.headers, ["name", "name_2", "note"]);
  assert.deepEqual(parsed.rows, [{
    name: "Ada, Lovelace",
    name_2: "Augusta",
    note: 'said "hello"'
  }]);
});

test("CSV parser rejects malformed quoted fields", () => {
  assert.throws(() => csvParse({ csv: 'name,note\nAda,"unfinished' }), /unclosed quoted/);
});

test("CSV to JSON reports row count and headers", () => {
  const result = csvToJson({ csv: "id,value\n1,a\n2,b" });
  assert.equal(result.row_count, 2);
  assert.deepEqual(result.headers, ["id", "value"]);
  assert.deepEqual(JSON.parse(result.json), [{ id: "1", value: "a" }, { id: "2", value: "b" }]);
});

test("date difference returns signed elapsed time", () => {
  const result = dateDifference({ start: "2026-01-01T00:00:00Z", end: "2026-01-03T12:00:00Z" });
  assert.equal(result.difference_hours, 60);
  assert.equal(result.difference_days, 2.5);
  assert.throws(() => dateDifference({ start: "not-a-date", end: "2026-01-01" }), /Invalid date/);
});
