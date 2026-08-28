import { describe, expect, it } from "vitest";

import {
  commandRows,
  structuredEditorFor,
  substitutionRows,
} from "./structuredOptions";

describe("structured option editors", () => {
  it("routes every complex Starship option to a purpose-built editor", () => {
    expect(structuredEditorFor("battery", "display")).toBe("battery-display");
    expect(structuredEditorFor("kubernetes", "contexts")).toBe("kubernetes-contexts");
    expect(structuredEditorFor("directory", "substitutions")).toBe("directory-substitutions");
    expect(structuredEditorFor("custom.project", "when")).toBe("custom-when");

    for (const [moduleName, key] of [
      ["c", "commands"],
      ["cpp", "commands"],
      ["fortran", "commands"],
      ["python", "python_binary"],
      ["terraform", "commands"],
    ]) {
      expect(structuredEditorFor(moduleName, key)).toBe("command-list");
    }
  });

  it("preserves nested command arguments instead of comma-flattening them", () => {
    expect(commandRows([["terraform", "version"], ["tofu", "version"]])).toEqual([
      ["terraform", "version"],
      ["tofu", "version"],
    ]);
    expect(commandRows(["python", "python3"])).toEqual([["python"], ["python3"]]);
    expect(commandRows("python")).toEqual([["python"]]);
  });

  it("normalises both supported directory substitution representations", () => {
    expect(substitutionRows({ Documents: "", Downloads: "" })).toEqual([
      { from: "Documents", to: "" },
      { from: "Downloads", to: "" },
    ]);
    expect(substitutionRows([{ from: "^src", to: "source", regex: true }])).toEqual([
      { from: "^src", to: "source", regex: true },
    ]);
  });
});
