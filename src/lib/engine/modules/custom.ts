import type { Scenario } from "@/lib/scenarios/types";
import { optOptionalString, renderMeta } from "./shared";
import { detects, type ModuleDefinition, optBool, optString } from "./types";

/** Rust's `env::consts::OS` for the scenario's operating system. */
function osConst(scenario: Scenario): string {
  switch (scenario.os?.type) {
    case "Macos":
      return "macos";
    case "Windows":
      return "windows";
    default:
      return "linux";
  }
}

function matchesOs(required: string, scenario: Scenario): boolean {
  const actual = osConst(scenario);
  return required === actual || (required === "unix" && actual !== "windows");
}

/**
 * `custom` is a *table* module: `[custom.foo]` defines a module named
 * `custom.foo`. `createCustomModule("foo")` builds that instance — the registry
 * calls it once per key under `custom` — and the exported `custom` is the
 * template the registry clones.
 *
 * Two behaviours cannot survive the trip into a browser, and are simulated:
 *
 *  - `command` never runs; a named module reads explicit output from the
 *    scenario's Browser preview controls.
 *  - a `when` command reads the same simulation's success switch. Boolean
 *    `when` values are still honoured exactly.
 */
export function createCustomModule(name?: string): ModuleDefinition {
  return {
    name: name === undefined ? "custom" : `custom.${name}`,
    defaults: {
      format: "[$symbol($output )]($style)",
      symbol: "",
      command: "",
      when: false,
      require_repo: false,
      shell: [],
      description: "<custom config>",
      style: "green bold",
      disabled: false,
      detect_files: [],
      detect_extensions: [],
      detect_folders: [],
      os: undefined,
      use_stdin: undefined,
      ignore_timeout: false,
      unsafe_no_escape: false,
    },
    evaluate(options, ctx) {
      const { scenario } = ctx;
      const preview = name === undefined ? undefined : scenario.custom?.[name];

      const requiredOs = optOptionalString(options, "os");
      if (requiredOs !== undefined && !matchesOs(requiredOs, scenario)) return null;

      if (optBool(options, "require_repo") && !scenario.git) return null;

      const isMatch =
        detects(options, scenario) ||
        (typeof options.when === "string" ? (preview?.when ?? true) : optBool(options, "when"));
      if (!isMatch) return null;

      return {
        variables: {
          symbol: renderMeta(optString(options, "symbol"), ctx),
          output: preview?.output || undefined,
        },
      };
    },
  };
}

export const custom = createCustomModule();
