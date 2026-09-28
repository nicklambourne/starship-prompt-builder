import { describe, expect, it } from "vitest";
import type { StarshipConfig } from "@/lib/engine/prompt";

import { validateConfig } from "./diagnostics";
import { parseConfig } from "./toml";
import { PRESETS } from "./presets";

describe("configuration diagnostics", () => {
  it("accepts every shipped preset", () => {
    for (const preset of PRESETS) {
      const parsed = parseConfig(preset.toml);
      if (!parsed.ok) throw new Error(parsed.error);
      expect(validateConfig(parsed.config).filter((item) => item.severity === "error"), preset.id).toEqual([]);
    }
  });
  it.each([
    '[nodejs]\ndetect_files = [123]\n',
    '[directory]\ntruncation_length = 1.5\n',
    'scan_timeout = -1\n',
    '[palettes.test]\nred = 123\n',
  ])("rejects invalid nested or integer values: %s", (toml) => {
    const parsed = parseConfig(toml);
    if (!parsed.ok) throw new Error(parsed.error);
    expect(validateConfig(parsed.config).some((item) => item.severity === "error")).toBe(true);
  });

  it.each([
    '[python]\npython_binary = "python3"\n',
    '[env_var]\nvariable = "EXAMPLE"\n',
    '[env_var]\nvariable = "EXAMPLE"\n[env_var.other]\ndefault = "fallback"\n',
    '[directory]\ntruncation_length = -1\n',
  ])("accepts supported scalar and bare-module forms: %s", (toml) => {
    const parsed = parseConfig(toml);
    if (!parsed.ok) throw new Error(parsed.error);
    expect(validateConfig(parsed.config)).toEqual([]);
  });
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
