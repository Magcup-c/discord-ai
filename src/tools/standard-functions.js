function assertFiniteNumber(value, name) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${name} must be a finite number`);
  }
}

export function percentage({ value, percent }) {
  assertFiniteNumber(value, "value");
  assertFiniteNumber(percent, "percent");
  return {
    value,
    percent,
    result: value * percent / 100
  };
}

export function statistics({ values }) {
  if (!Array.isArray(values) || values.length < 1 || values.length > 1000) {
    throw new Error("values must contain between 1 and 1000 numbers");
  }
  values.forEach((value, index) => assertFiniteNumber(value, `values[${index}]`));
  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((total, value) => total + value, 0);
  const mean = sum / values.length;
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
  const variance = values.reduce((total, value) => total + (value - mean) ** 2, 0) / values.length;
  return {
    count: values.length,
    sum,
    mean,
    median,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    population_standard_deviation: Math.sqrt(variance)
  };
}

const LINEAR_UNITS = {
  mm: { dimension: "length", factor: 0.001 },
  cm: { dimension: "length", factor: 0.01 },
  m: { dimension: "length", factor: 1 },
  km: { dimension: "length", factor: 1000 },
  mg: { dimension: "mass", factor: 0.001 },
  g: { dimension: "mass", factor: 1 },
  kg: { dimension: "mass", factor: 1000 },
  ml: { dimension: "volume", factor: 0.001 },
  l: { dimension: "volume", factor: 1 }
};

export function unitConvert({ value, from, to }) {
  assertFiniteNumber(value, "value");
  if (from === to && (LINEAR_UNITS[from] || ["c", "f", "k"].includes(from))) {
    return { value, from, to, result: value };
  }
  const source = LINEAR_UNITS[from];
  const target = LINEAR_UNITS[to];
  if (source && target && source.dimension === target.dimension) {
    return { value, from, to, result: value * source.factor / target.factor };
  }
  const temperature = ["c", "f", "k"];
  if (!temperature.includes(from) || !temperature.includes(to)) {
    throw new Error("Unsupported or incompatible units");
  }
  const celsius = from === "c" ? value
    : from === "f" ? (value - 32) * 5 / 9
      : value - 273.15;
  const result = to === "c" ? celsius
    : to === "f" ? celsius * 9 / 5 + 32
      : celsius + 273.15;
  return { value, from, to, result };
}

export function jsonFormat({ json, indent = 2 }) {
  if (typeof json !== "string" || json.length > 12000) throw new Error("json must be 12000 characters or fewer");
  if (!Number.isInteger(indent) || indent < 0 || indent > 4) throw new Error("indent must be between 0 and 4");
  return { formatted: JSON.stringify(JSON.parse(json), null, indent) };
}

export function jsonValidate({ json }) {
  if (typeof json !== "string" || json.length > 12000) throw new Error("json must be 12000 characters or fewer");
  try {
    JSON.parse(json);
    return { valid: true };
  } catch (error) {
    return { valid: false, error: String(error.message || "Invalid JSON").slice(0, 200) };
  }
}

function parseCsvRows(input, delimiter) {
  if (typeof input !== "string" || input.length > 20000) throw new Error("csv must be 20000 characters or fewer");
  if (typeof delimiter !== "string" || delimiter.length !== 1 || delimiter === '"' || delimiter === "\n" || delimiter === "\r") {
    throw new Error("delimiter must be one printable character other than a quote or newline");
  }
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"' && field.length === 0) {
      quoted = true;
    } else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && input[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      if (char === '"') throw new Error("Unexpected quote in CSV field");
      field += char;
    }
  }
  if (quoted) throw new Error("CSV contains an unclosed quoted field");
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  if (rows.length > 1001 || rows.some(item => item.length > 100)) {
    throw new Error("CSV is limited to 1000 data rows and 100 columns");
  }
  return rows;
}

function rowsToObjects(rows, delimiter) {
  if (!rows.length) return { headers: [], rows: [] };
  const rawHeaders = rows[0];
  const headers = rawHeaders.map((header, index) => {
    const clean = header.trim() || `column_${index + 1}`;
    return clean;
  });
  const counts = new Map();
  const uniqueHeaders = headers.map(header => {
    const count = (counts.get(header) || 0) + 1;
    counts.set(header, count);
    return count === 1 ? header : `${header}_${count}`;
  });
  const objects = rows.slice(1).map(row => {
    const item = {};
    uniqueHeaders.forEach((header, index) => {
      item[header] = row[index] ?? "";
    });
    return item;
  });
  return { headers: uniqueHeaders, rows: objects, delimiter };
}

export function csvParse({ csv, delimiter = "," }) {
  return rowsToObjects(parseCsvRows(csv, delimiter), delimiter);
}

export function csvToJson({ csv, delimiter = "," }) {
  const parsed = rowsToObjects(parseCsvRows(csv, delimiter), delimiter);
  return { json: JSON.stringify(parsed.rows), row_count: parsed.rows.length, headers: parsed.headers };
}

export function dateDifference({ start, end }) {
  if (typeof start !== "string" || typeof end !== "string" || start.length > 40 || end.length > 40) {
    throw new Error("start and end must be date strings of 40 characters or fewer");
  }
  const startMs = Date.parse(start);
  const endMs = Date.parse(end);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) throw new Error("Invalid date");
  const differenceMs = endMs - startMs;
  return {
    start: new Date(startMs).toISOString(),
    end: new Date(endMs).toISOString(),
    difference_milliseconds: differenceMs,
    difference_hours: differenceMs / 3600000,
    difference_days: differenceMs / 86400000
  };
}
