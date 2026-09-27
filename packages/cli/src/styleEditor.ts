import { parseColorString } from "@/lib/engine/styleString";

export function styleTokens(style: string): string[] {
  return style.trim().split(/\s+/).filter(Boolean);
}

export function setStyleColor(style: string, kind: "fg" | "bg", color: string): string {
  const kept = styleTokens(style).filter((token) => {
    if (token.startsWith(`${kind}:`)) return false;
    return !(kind === "fg" && !token.includes(":") && parseColorString(token) !== undefined);
  });
  if (color.trim()) kept.push(`${kind}:${color.trim()}`);
  return kept.join(" ");
}

export function replaceStyleToken(style: string, index: number, token: string): string {
  const tokens = styleTokens(style);
  if (index < 0 || index >= tokens.length) return style;
  if (token.trim()) tokens[index] = token.trim();
  else tokens.splice(index, 1);
  return tokens.join(" ");
}
