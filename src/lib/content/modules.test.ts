import { describe, expect, it } from "vitest";

import { getModuleSchemas } from "@/lib/config/schema";
import { parseConfig } from "@/lib/config/toml";
import { MODULE_REFERENCES } from "./modules";

describe("MODULE_REFERENCES", () => {
  it("covers every Starship module exactly once", () => {
    const expected = getModuleSchemas().map((module) => module.name).sort();
    const actual = MODULE_REFERENCES.map((reference) => reference.moduleName).sort();

    expect(actual).toEqual(expected);
    expect(new Set(MODULE_REFERENCES.map((reference) => reference.slug)).size).toBe(
      MODULE_REFERENCES.length,
    );
  });

  it("gives every module a valid starting configuration", () => {
    for (const reference of MODULE_REFERENCES) {
      expect(parseConfig(reference.example), reference.moduleName).toMatchObject({
        ok: true,
      });
    }
  });
});
