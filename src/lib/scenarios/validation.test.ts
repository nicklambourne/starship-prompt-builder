import { describe, expect, it } from "vitest";
import { listScenarios, getScenario } from ".";
import { isScenario } from "./validation";

describe("scenario contract", () => {
  it("accepts built-ins and optional OS omission", () => {
    for (const scenario of listScenarios()) expect(isScenario(scenario), scenario.id).toBe(true);
    const withoutOs = { ...getScenario("simple") };
    delete withoutOs.os;
    expect(isScenario(withoutOs)).toBe(true);
  });
  it.each([
    { shell: "other" }, { keymap: "other" }, { terminalWidth: 1000000 },
    { terminalWidth: 19 }, { status: -1 }, { jobs: 0.5 }, { time: "yesterday" },
    { aws: { profile: 4 } }, { kubernetes: {} }, { nix: {} }, { conda: {} },
    { os: { name: "Linux", type: "other" } }, { direnv: { loaded: true, allowed: "yes" } },
    { battery: { percentage: 101, status: "full" } }, { git: { state: "broken" } },
    { custom: { test: { output: "ok", when: "yes" } } },
    { env: JSON.parse('{"__proto__":"bad"}') },
  ])("rejects malformed context %j", (changes) => {
    expect(isScenario({ ...getScenario("simple"), ...changes })).toBe(false);
  });
});
