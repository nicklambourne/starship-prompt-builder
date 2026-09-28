import { describe, expect, it } from "vitest";
import { PARITY_CASES } from "../parity/fixtures";
import { SWEEP_CASES, UNSWEEPABLE } from "../parity/sweep";
import { collectVariables, parseFormatString } from "@/lib/engine/formatString";
import { parseConfig } from "@/lib/config/toml";
import { ALL_MODULES } from "@/lib/engine/modules";

const fixtures = [...PARITY_CASES, ...SWEEP_CASES];
const covered = new Set(fixtures.flatMap((fixture) => fixture.modules));
function missing(names: string[]) {
  return names.filter((name) => !covered.has(name) && !Object.hasOwn(UNSWEEPABLE, name));
}
describe("explicit parity inventory", () => {
  it("checks that coverage claims name real, explicitly invoked modules", () => {
    for (const fixture of fixtures) {
      const parsed = parseConfig(fixture.config);
      if (!parsed.ok) throw new Error(parsed.error);
      const format = fixture.side === "right" ? parsed.config.right_format : parsed.config.format;
      const invoked = [...collectVariables(parseFormatString(format ?? ""))].map((name) => name.split(".")[0]);
      for (const name of fixture.modules) {
        expect(ALL_MODULES.some((module) => module.name === name), fixture.id).toBe(true);
        expect(invoked, `${fixture.id}: coverage must be deliberate`).toContain(name);
      }
    }
  });
  it("accounts for every registered module, including non-default modules", () => {
    expect(missing(ALL_MODULES.map((module) => module.name))).toEqual([]);
    for (const [name, reason] of Object.entries(UNSWEEPABLE)) {
      expect(ALL_MODULES.some((module) => module.name === name), name).toBe(true);
      expect(covered.has(name), `Remove stale exclusion: ${name}`).toBe(false);
      expect(reason.length).toBeGreaterThan(15);
    }
  });
  it("does not silently cover a newly registered module", () => {
    expect(missing(["future_module_without_a_fixture"])).toEqual(["future_module_without_a_fixture"]);
  });
});
