const registry = new Map();

export function registerTool(definition, handler) {
  const name = definition?.function?.name;
  if (!name || typeof handler !== "function") {
    throw new Error("Invalid tool registration");
  }
  if (registry.has(name)) throw new Error(`Tool already registered: ${name}`);
  registry.set(name, { definition, handler });
}

export function getToolDefinitions(allowedTools) {
  const allowed = Array.isArray(allowedTools) ? new Set(allowedTools) : null;
  return [...registry.entries()]
    .filter(([name]) => !allowed || allowed.has(name))
    .map(([, item]) => item.definition);
}

function validateValue(value, schema, path) {
  if (!schema || typeof schema !== "object") return;
  const expected = schema.type;
  if (expected === "string") {
    if (typeof value !== "string") throw new Error(`${path} must be a string`);
    if (schema.minLength != null && value.length < schema.minLength) throw new Error(`${path} is too short`);
    if (schema.maxLength != null && value.length > schema.maxLength) throw new Error(`${path} is too long`);
    if (schema.enum && !schema.enum.includes(value)) throw new Error(`${path} has an invalid value`);
    return;
  }
  if (expected === "number" || expected === "integer") {
    if (typeof value !== "number" || !Number.isFinite(value) || (expected === "integer" && !Number.isInteger(value))) {
      throw new Error(`${path} must be a valid ${expected}`);
    }
    if (schema.minimum != null && value < schema.minimum) throw new Error(`${path} is below the minimum`);
    if (schema.maximum != null && value > schema.maximum) throw new Error(`${path} is above the maximum`);
    return;
  }
  if (expected === "boolean" && typeof value !== "boolean") throw new Error(`${path} must be a boolean`);
  if (expected === "array") {
    if (!Array.isArray(value)) throw new Error(`${path} must be an array`);
    if (schema.items) value.forEach((item, index) => validateValue(item, schema.items, `${path}[${index}]`));
    return;
  }
  if (expected === "object") {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${path} must be an object`);
    validateArguments(value, schema, path);
  }
}

function validateArguments(args, schema, path = "arguments") {
  const properties = schema?.properties || {};
  for (const key of schema?.required || []) {
    if (!(key in args)) throw new Error(`${path}.${key} is required`);
  }
  if (schema?.additionalProperties === false) {
    for (const key of Object.keys(args)) {
      if (!(key in properties)) throw new Error(`${path}.${key} is not allowed`);
    }
  }
  for (const [key, value] of Object.entries(args)) {
    if (properties[key]) validateValue(value, properties[key], `${path}.${key}`);
  }
}

export async function executeTool(name, args, context = {}) {
  const tool = registry.get(name);
  if (!tool) throw new Error(`Unknown tool: ${name}`);
  if (Array.isArray(context.allowedTools) && !context.allowedTools.includes(name)) {
    throw new Error("Tool permission denied");
  }
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Tool arguments must be an object");
  }
  validateArguments(args, tool.definition.function.parameters || {});
  return tool.handler(args, context);
}
