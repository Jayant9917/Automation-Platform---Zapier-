export class TemplateError extends Error {
  constructor(public code: string) {
    super(code);
  }
}
const blocked = new Set(["__proto__", "prototype", "constructor"]);
function fields(template: string) {
  const matches = [...template.matchAll(/{{(.*?)}}/g)];
  const remainder = template.replace(/{{.*?}}/g, "");
  if (
    template.length > 40000 ||
    matches.length > 50 ||
    remainder.includes("{{") ||
    remainder.includes("}}")
  )
    throw new TemplateError("INVALID_TEMPLATE");
  for (const match of matches) {
    const path = match[1]!.trim();
    if (
      !/^[A-Za-z_][A-Za-z0-9_]*(?:\.(?:[A-Za-z_][A-Za-z0-9_]*|[0-9]+))*$/.test(path) ||
      path.length > 160 ||
      path.split(".").length > 8 ||
      path.split(".").some((part) => blocked.has(part))
    ) {
      throw new TemplateError("INVALID_TEMPLATE");
    }
  }
  return matches;
}
export function validTemplate(template: string): boolean {
  try {
    fields(template);
    return true;
  } catch {
    return false;
  }
}
function readField(context: unknown, path: string): string | number | boolean {
  let value: unknown = context;
  for (const part of path.split(".")) {
    if (!value || typeof value !== "object") throw new TemplateError("MISSING_EVENT_FIELD");
    const descriptor = Object.getOwnPropertyDescriptor(value, part);
    if (!descriptor || !("value" in descriptor)) throw new TemplateError("MISSING_EVENT_FIELD");
    value = descriptor.value;
  }
  if (value === null) return ""; // GitHub issue bodies may be null.
  if (!["string", "number", "boolean"].includes(typeof value))
    throw new TemplateError("INVALID_EVENT_FIELD");
  if (typeof value === "number" && !Number.isFinite(value))
    throw new TemplateError("INVALID_EVENT_FIELD");
  return value as string | number | boolean;
}
export function renderText(template: string, context: unknown, maxLength = 40000): string {
  const matches = fields(template);
  let result = template;
  // Replace from the end; event text is never parsed again as template syntax or code.
  for (const match of matches.reverse()) {
    result =
      result.slice(0, match.index) +
      String(readField(context, match[1]!.trim())) +
      result.slice(match.index! + match[0].length);
  }
  if (result.length > maxLength) throw new TemplateError("RESOLVED_VALUE_TOO_LONG");
  return result;
}
export function renderCell(template: string, context: unknown): string | number | boolean {
  const matches = fields(template);
  if (matches.length === 1 && matches[0]![0] === template) {
    const value = readField(context, matches[0]![1]!.trim());
    if (String(value).length > 40000) throw new TemplateError("RESOLVED_VALUE_TOO_LONG");
    return value;
  }
  return renderText(template, context);
}
