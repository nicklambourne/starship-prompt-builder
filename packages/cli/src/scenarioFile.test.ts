import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getScenario } from "@/lib/scenarios";
import { loadScenarioFile, parseScenarioFile, saveScenarioFile, serializeScenarioFile } from "./scenarioFile";

describe("portable scenario documents", () => {
  it("round-trips preview inputs without executing or inspecting the host", async () => {
    const directory = await mkdtemp(join(tmpdir(), "spb-scenario-"));
    try {
      const path = join(directory, "scenario.json");
      const scenario = { ...getScenario("dirty-repo"), custom: { project: { output: "ok", when: true } } };
      await saveScenarioFile(path, scenario);
      expect(await loadScenarioFile(path)).toEqual(scenario);
      await expect(saveScenarioFile(path, scenario)).rejects.toMatchObject({ code: "EEXIST" });
      expect(await readFile(path, "utf8")).toBe(serializeScenarioFile(scenario));
    } finally { await rm(directory, { recursive: true }); }
  });

  it("rejects unsupported and incomplete documents", () => {
    expect(() => parseScenarioFile('{"version":2,"scenario":{}}')).toThrow(/version 1/);
    expect(() => parseScenarioFile('{"version":1,"scenario":{"path":"/"}}')).toThrow(/required/);
    const valid = getScenario("dirty-repo");
    expect(() => parseScenarioFile(JSON.stringify({ version: 1, scenario: { ...valid, env: { NODE_ENV: 4 } } })))
      .toThrow(/required preview fields/);
    expect(() => parseScenarioFile(JSON.stringify({ version: 1, scenario: { ...valid, git: { branch: "main" } } })))
      .toThrow(/git state/);
    expect(() => parseScenarioFile(JSON.stringify({ version: 1, scenario: { ...valid, custom: { project: { output: "ok", when: "yes" } } } })))
      .toThrow(/custom results/);
  });
});
