import type { StructuredEditor } from "@/lib/config/structuredOptions";

export type ValuePath = Array<string | number>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function valueAt(value: unknown, path: ValuePath): unknown {
  let current = value;
  for (const key of path) {
    if (Array.isArray(current) && typeof key === "number") current = current[key];
    else if (isRecord(current)) current = current[String(key)];
    else return undefined;
  }
  return current;
}

export function valueRows(value: unknown): Array<{ key: string | number; value: unknown }> {
  if (Array.isArray(value)) return value.map((item, key) => ({ key, value: item }));
  if (isRecord(value)) return Object.entries(value).map(([key, item]) => ({ key, value: item }));
  return [];
}

export function updateValue(value: unknown, path: ValuePath, next: unknown): unknown {
  if (path.length === 0) return next;
  const [key, ...rest] = path;
  if (Array.isArray(value) && typeof key === "number") {
    return value.map((item, index) => index === key ? updateValue(item, rest, next) : item);
  }
  if (isRecord(value)) return { ...value, [key]: updateValue(value[String(key)], rest, next) };
  return value;
}

export function removeValue(value: unknown, path: ValuePath): unknown {
  if (path.length === 0) return value;
  const [key, ...rest] = path;
  if (rest.length === 0) {
    if (Array.isArray(value) && typeof key === "number") return value.filter((_, index) => index !== key);
    if (isRecord(value)) {
      const next = { ...value };
      delete next[String(key)];
      return next;
    }
    return value;
  }
  return updateValue(value, [key], removeValue(valueAt(value, [key]), rest));
}

export function addValue(value: unknown, path: ValuePath, key: string | null, entry: unknown): unknown {
  const target = valueAt(value, path);
  if (Array.isArray(target)) return updateValue(value, path, [...target, entry]);
  if (isRecord(target) && key && !Object.hasOwn(target, key)) {
    return updateValue(value, path, { ...target, [key]: entry });
  }
  return value;
}

export function renameValue(value: unknown, path: ValuePath, name: string): unknown {
  const old = path.at(-1);
  const parentPath = path.slice(0, -1);
  const parent = valueAt(value, parentPath);
  if (typeof old !== "string" || !name || !isRecord(parent) || Object.hasOwn(parent, name)) return value;
  const next = Object.fromEntries(Object.entries(parent).map(([key, item]) => [key === old ? name : key, item]));
  return updateValue(value, parentPath, next);
}

export function initialArrayEntry(editor: StructuredEditor | undefined): unknown {
  switch (editor) {
    case "battery-display": return { threshold: 10, style: "red bold" };
    case "kubernetes-contexts": return { context_pattern: ".*" };
    case "directory-substitutions": return { from: "", to: "" };
    case "command-list": return [""];
    default: return "";
  }
}

export function parseScalarLike(value: unknown, text: string): unknown {
  if (typeof value === "number") {
    const parsed = Number(text);
    if (!Number.isFinite(parsed)) throw new Error("Enter a finite number.");
    return parsed;
  }
  if (typeof value === "boolean") {
    if (text === "true") return true;
    if (text === "false") return false;
    throw new Error("Enter true or false.");
  }
  return text;
}
