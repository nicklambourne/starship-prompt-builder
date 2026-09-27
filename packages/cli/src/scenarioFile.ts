import { readFile, writeFile } from "node:fs/promises";
import type { Scenario } from "@/lib/scenarios/types";

const MAX_BYTES = 1024 * 1024;
const VERSION = 1;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringMap(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.entries(value).every(([key, item]) =>
    !["__proto__", "constructor", "prototype"].includes(key) && typeof item === "string");
}

function validObject(value: unknown, fields: Record<string, "string" | "number" | "boolean">): boolean {
  return isRecord(value) && Object.entries(fields).every(([key, kind]) =>
    value[key] === undefined || typeof value[key] === kind && (kind !== "number" || Number.isFinite(value[key])));
}

function optionalObject(scenario: Record<string, unknown>, key: string, fields: Record<string, "string" | "number" | "boolean">): boolean {
  return scenario[key] === undefined || validObject(scenario[key], fields);
}

export function parseScenarioFile(text: string): Scenario {
  if (Buffer.byteLength(text, "utf8") > MAX_BYTES) throw new Error("Scenario file exceeds 1 MiB.");
  const document: unknown = JSON.parse(text);
  if (!isRecord(document) || document.version !== VERSION || !isRecord(document.scenario)) {
    throw new Error("Unsupported or malformed scenario document (expected version 1).");
  }
  const scenario = document.scenario;
  if (typeof scenario.id !== "string" || typeof scenario.label !== "string" || typeof scenario.description !== "string" ||
    typeof scenario.path !== "string" || typeof scenario.home !== "string" ||
    typeof scenario.readOnly !== "boolean" ||
    typeof scenario.shell !== "string" || !Array.isArray(scenario.files) ||
    !scenario.files.every((item) => typeof item === "string") ||
    typeof scenario.status !== "number" || !Number.isFinite(scenario.status) ||
    typeof scenario.cmdDurationMs !== "number" || !Number.isFinite(scenario.cmdDurationMs) ||
    typeof scenario.jobs !== "number" || !Number.isInteger(scenario.jobs) || scenario.jobs < 0 ||
    typeof scenario.username !== "string" || typeof scenario.hostname !== "string" ||
    typeof scenario.ssh !== "boolean" || typeof scenario.isRoot !== "boolean" ||
    typeof scenario.keymap !== "string" || typeof scenario.time !== "string" || !Number.isFinite(Date.parse(scenario.time)) ||
    typeof scenario.terminalWidth !== "number" || !Number.isInteger(scenario.terminalWidth) ||
    scenario.terminalWidth < 20 || !isStringMap(scenario.env) || !isStringMap(scenario.toolVersions)) {
    throw new Error("Scenario is missing required preview fields or has invalid values.");
  }
  const git = scenario.git;
  if (git !== undefined && (!isRecord(git) || !validObject(git, {
    branch: "string", commit: "string", tag: "string", detached: "boolean", ahead: "number", behind: "number",
    staged: "number", modified: "number", deleted: "number", renamed: "number", untracked: "number",
    conflicted: "number", stashed: "number", root: "string", hasRemote: "boolean",
    remoteBranch: "string", remoteName: "string", addedLines: "number", deletedLines: "number",
  }) || typeof git.commit !== "string" || typeof git.root !== "string" ||
    typeof git.detached !== "boolean" || typeof git.hasRemote !== "boolean" ||
    !["ahead", "behind", "staged", "modified", "deleted", "renamed", "untracked", "conflicted", "stashed"]
      .every((key) => typeof git[key] === "number"))) {
    throw new Error("Scenario git state is incomplete or invalid.");
  }
  if (scenario.custom !== undefined && (!isRecord(scenario.custom) ||
    !Object.entries(scenario.custom).every(([key, value]) =>
      !["__proto__", "constructor", "prototype"].includes(key) && isRecord(value) &&
      typeof value.output === "string" && typeof value.when === "boolean"))) {
    throw new Error("Scenario custom results must contain simulated output and when values.");
  }
  if (!optionalObject(scenario, "battery", { percentage: "number", status: "string" }) ||
    scenario.battery !== undefined && (typeof (scenario.battery as Record<string, unknown>).percentage !== "number" ||
      !["charging", "discharging", "full", "unknown"].includes(String((scenario.battery as Record<string, unknown>).status))) ||
    !optionalObject(scenario, "aws", { profile: "string", region: "string", duration: "string" }) ||
    !optionalObject(scenario, "gcloud", { account: "string", project: "string", region: "string" }) ||
    !optionalObject(scenario, "azure", { subscription: "string", username: "string" }) ||
    !optionalObject(scenario, "kubernetes", { context: "string", namespace: "string", user: "string", cluster: "string" }) ||
    !optionalObject(scenario, "terraform", { workspace: "string" }) ||
    !optionalObject(scenario, "python", { virtualenv: "string" }) ||
    !optionalObject(scenario, "container", { name: "string" }) ||
    !optionalObject(scenario, "docker", { context: "string" }) ||
    !optionalObject(scenario, "nats", { name: "string" }) ||
    !optionalObject(scenario, "netns", { name: "string" })) {
    throw new Error("Scenario has an invalid optional preview context.");
  }
  return scenario as unknown as Scenario;
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
