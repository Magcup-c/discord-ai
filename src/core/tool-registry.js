const registry = new Map();

export function registerTool(definition, handler) {
  const name = definition?.function?.name;
  if (!name || typeof handler !== "function") {
    throw new Error("Invalid tool registration");
  }
  if (registry.has(name)) throw new Error(`Tool already registered: ${name}`);
  registry.set(name, { definition, handler });
}

export function getToolDefinitions() {
  return [...registry.values()].map(item => item.definition);
}

export async function executeTool(name, args, context = {}) {
  const tool = registry.get(name);
  if (!tool) throw new Error(`Unknown tool: ${name}`);
  if (context.allowedTools && !context.allowedTools.includes(name)) {
    throw new Error("Tool permission denied");
  }
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Tool arguments must be an object");
  }
  return tool.handler(args, context);
}
