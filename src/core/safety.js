export function sanitizeUserInput(value, maxLength = 1500) {
  if (typeof value !== "string") throw new TypeError("Input must be text");
  const text = value.trim();
  if (!text) throw new Error("Input is empty");
  if (text.length > maxLength) throw new Error("Input is too long");
  return text;
}
