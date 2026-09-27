import { describe, expect, it } from "vitest";
import type { StarshipConfig } from "@/lib/engine/prompt";

import { validateConfig } from "./diagnostics";

describe("configuration diagnostics", () => {
  it("rejects known options with invalid types, values, and format syntax", () => {
    const invalid = {
      add_newline: "false",
      format: "[$directory",
      directory: { truncation_length: "three" },
      custom: { project: { os: "outer-space" } },
    } as unknown as StarshipConfig;
    const diagnostics = validateConfig(invalid);

    expect(diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "type", severity: "error", path: "add_newline" }),
      expect.objectContaining({ code: "format", severity: "error", path: "format" }),
      expect.objectContaining({ code: "type", severity: "error", path: "directory.truncation_length" }),
      expect.objectContaining({ code: "enum", severity: "error", path: "custom.project.os" }),
    ]));
  });

  it("warns for forward-compatible unknown options and missing palette references", () => {
    const diagnostics = validateConfig({
      palette: "missing",
      future_module: { future_option: true },
      directory: { future_option: "kept" },
    });

    expect(diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "palette-reference", severity: "warning", path: "palette" }),
      expect.objectContaining({ code: "unknown-module", severity: "warning", path: "future_module" }),
      expect.objectContaining({ code: "unknown-option", severity: "warning", path: "directory.future_option" }),
    ]));
    expect(diagnostics.some((item) => item.severity === "error")).toBe(false);
  });

  it("accepts a named instance and valid palette", () => {
    expect(validateConfig({
      format: "${custom.project}$directory",
      palette: "ocean",
      palettes: { ocean: { deep: "#123456" } },
      custom: { project: { command: "printf hello", os: "unix" } },
    })).toEqual([]);
  });

  it("treats variables in module formats as local, not module references", () => {
    expect(validateConfig({ dotnet: { format: "[$symbol$version $tfm]($style)" } })).toEqual([]);
  });
});
