import { readFile, writeFile } from "node:fs/promises";
import type { Scenario } from "@/lib/scenarios/types";
import { scenarioError } from "@/lib/scenarios/validation";

const MAX_BYTES = 1024 * 1024;
const VERSION = 1;

export function parseScenarioFile(text: string): Scenario {
  if (Buffer.byteLength(text, "utf8") > MAX_BYTES) throw new Error("Scenario file exceeds 1 MiB.");
  const document: unknown = JSON.parse(text);
  if (typeof document !== "object" || document === null || !("version" in document) ||
    document.version !== VERSION || !("scenario" in document)) {
    throw new Error("Unsupported or malformed scenario document (expected version 1).");
  }
  const error = scenarioError(document.scenario);
  if (error) throw new Error(error);
  return document.scenario as Scenario;
}

export function serializeScenarioFile(scenario: Scenario): string {
  return `${JSON.stringify({ version: VERSION, scenario }, null, 2)}\n`;
}

export async function loadScenarioFile(path: string): Promise<Scenario> {
  const data = await readFile(path);
  if (data.byteLength > MAX_BYTES) throw new Error("Scenario file exceeds 1 MiB.");
  return parseScenarioFile(data.toString("utf8"));
}

/** Never silently replace an existing scenario document. */
export async function saveScenarioFile(path: string, scenario: Scenario): Promise<void> {
  await writeFile(path, serializeScenarioFile(scenario), { encoding: "utf8", flag: "wx", mode: 0o600 });
}
