import { readFile, writeFile } from "node:fs/promises";
import { parseConfig, serialiseConfig } from "@/lib/config/toml";
import type { StarshipConfig } from "@/lib/engine/prompt";
import type { Scenario } from "@/lib/scenarios/types";
import { parseScenarioFile } from "./scenarioFile";

const MAX_BYTES = 2 * 1024 * 1024;

export interface PortableWorkspace {
  config: StarshipConfig;
  scenario: Scenario;
  previewWidth?: number;
}

export function serializeWorkspace(workspace: PortableWorkspace): string {
  return `${JSON.stringify({
    version: 1,
    configToml: serialiseConfig(workspace.config, { header: false }),
    scenario: workspace.scenario,
    previewWidth: workspace.previewWidth,
  }, null, 2)}\n`;
}

export function parseWorkspace(text: string): PortableWorkspace {
  if (Buffer.byteLength(text, "utf8") > MAX_BYTES) throw new Error("Workspace file exceeds 2 MiB.");
  const document: unknown = JSON.parse(text);
  if (!document || typeof document !== "object" || Array.isArray(document)) throw new Error("Invalid workspace document.");
  const data = document as Record<string, unknown>;
  if (data.version !== 1) throw new Error(`Unsupported workspace version: ${String(data.version)}.`);
  if (typeof data.configToml !== "string") throw new Error("Workspace is missing configToml.");
  const parsed = parseConfig(data.configToml);
  if (!parsed.ok) throw new Error(`Invalid workspace TOML: ${parsed.error}`);
  const scenario = parseScenarioFile(JSON.stringify({ version: 1, scenario: data.scenario }));
  const previewWidth = data.previewWidth;
  if (previewWidth !== undefined && (!Number.isInteger(previewWidth) || (previewWidth as number) < 20 || (previewWidth as number) > 500)) {
    throw new Error("Workspace previewWidth must be an integer from 20 to 500.");
  }
  return { config: parsed.config, scenario, previewWidth: previewWidth as number | undefined };
}

export async function loadWorkspace(path: string): Promise<PortableWorkspace> {
  const data = await readFile(path);
  if (data.byteLength > MAX_BYTES) throw new Error("Workspace file exceeds 2 MiB.");
  return parseWorkspace(data.toString("utf8"));
}

export async function saveWorkspace(path: string, workspace: PortableWorkspace): Promise<void> {
  await writeFile(path, serializeWorkspace(workspace), { encoding: "utf8", flag: "wx", mode: 0o600 });
}
