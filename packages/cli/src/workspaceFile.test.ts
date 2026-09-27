import { describe, expect, it } from "vitest";
import { getScenario } from "@/lib/scenarios";
import { parseWorkspace, serializeWorkspace } from "./workspaceFile";

describe("portable workspace", () => {
  it("round-trips unknown config values and the simulated context", () => {
    const original = { config: { format: "$directory", future: { key: "kept" } }, scenario: getScenario("cloud"), previewWidth: 96 };
    const parsed = parseWorkspace(serializeWorkspace(original));
    expect(parsed.config.future).toEqual({ key: "kept" });
    expect(parsed.scenario.aws?.profile).toBe("production");
    expect(parsed.previewWidth).toBe(96);
  });

  it("rejects future versions and malformed content", () => {
    expect(() => parseWorkspace('{"version":2}')).toThrow(/Unsupported workspace version/);
    expect(() => parseWorkspace('{"version":1,"configToml":"broken = [","scenario":{}}')).toThrow(/Invalid workspace TOML/);
  });
});
