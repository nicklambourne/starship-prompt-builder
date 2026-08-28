export type StructuredEditor =
  | "battery-display"
  | "kubernetes-contexts"
  | "directory-substitutions"
  | "custom-when"
  | "command-list";

const COMMAND_LIST_OPTIONS = new Set([
  "c.commands",
  "cpp.commands",
  "fortran.commands",
  "python.python_binary",
  "terraform.commands",
]);

function templateName(name: string): string {
  return name.startsWith("custom.") ? "custom" : name;
}

/** Purpose-built editor for schema shapes that a scalar/CSV control cannot preserve. */
export function structuredEditorFor(
  moduleName: string,
  optionKey: string,
): StructuredEditor | undefined {
  const name = templateName(moduleName);
  if (name === "battery" && optionKey === "display") return "battery-display";
  if (name === "kubernetes" && optionKey === "contexts") return "kubernetes-contexts";
  if (name === "directory" && optionKey === "substitutions") return "directory-substitutions";
  if (name === "custom" && optionKey === "when") return "custom-when";
  if (COMMAND_LIST_OPTIONS.has(`${name}.${optionKey}`)) return "command-list";
  return undefined;
}

/** Starship accepts a scalar, a flat candidate list, or tokenised command lists. */
export function commandRows(value: unknown): string[][] {
  if (typeof value === "string") return [[value]];
  if (!Array.isArray(value)) return [];
  if (value.every((entry) => typeof entry === "string")) {
    return value.map((entry) => [entry]);
  }
  return value.flatMap((entry) =>
    Array.isArray(entry)
      ? [entry.filter((token): token is string => typeof token === "string")]
      : [],
  );
}

export interface SubstitutionRow {
  from: string;
  to: string;
  regex?: boolean;
}

export function substitutionRows(value: unknown): SubstitutionRow[] {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return Object.entries(value).flatMap(([from, to]) =>
      typeof to === "string" ? [{ from, to }] : [],
    );
  }
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const row = entry as Record<string, unknown>;
    if (typeof row.from !== "string" || typeof row.to !== "string") return [];
    return [{ from: row.from, to: row.to, ...(row.regex === true ? { regex: true } : {}) }];
  });
}
