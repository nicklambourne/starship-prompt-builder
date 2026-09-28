/**
 * Parity harness: engine output vs real starship, byte for byte.
 *
 * This is the test that stops the re-implementation drifting. It runs the real
 * `starship prompt` binary against a materialised fixture directory and
 * compares its raw ANSI against the engine's ANSI serialisation of the same
 * scenario.
 *
 * If starship is not installed the suite SKIPS locally but FAILS in CI — a
 * parity suite that silently reports success because the binary is missing is
 * worse than no parity suite at all.
 */

import { execFileSync, execSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { PARITY_CASES } from "./fixtures";
import { SWEEP_CASES, UNSWEEPABLE } from "./sweep";
import { segmentsToAnsi } from "@/lib/engine/ansi";
import { moduleDefinitionsForConfig } from "@/lib/engine/modules";
import { PROMPT_ORDER } from "@/lib/engine/promptOrder";
import { renderPrompt } from "@/lib/engine/prompt";
import { parseConfig } from "@/lib/config/toml";

const IS_CI = process.env.CI === "true" || process.env.CI === "1";

function starshipVersion(): string | null {
  try {
    return execFileSync("starship", ["--version"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

const version = starshipVersion();
const roots: string[] = [];

afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

describe("parity with real starship", () => {
  it("has starship available (required in CI)", () => {
    if (!version && IS_CI) {
      throw new Error(
        "starship is not installed on this runner — the parity suite would " +
          "otherwise pass by doing nothing. Install it in the workflow.",
      );
    }
    expect(true).toBe(true);
  });

  const maybe = version ? it : it.skip;

  it("says which modules no fixture can reach", () => {
    // Printed rather than asserted: the value is the list staying visible, so
    // a module that becomes testable is noticed.
    const names = Object.keys(UNSWEEPABLE).sort();
    console.info(
      `parity sweep covers ${SWEEP_CASES.length} modules; ${names.length} cannot be ` +
        `reached deterministically:\n` +
        names.map((name) => `  ${name}: ${UNSWEEPABLE[name]}`).join("\n"),
    );
    expect(names.length).toBeGreaterThan(0);
  });

  for (const testCase of [...PARITY_CASES, ...SWEEP_CASES]) {
    maybe(`matches starship for ${testCase.id}`, () => {
      const root = mkdtempSync(join(tmpdir(), `starship-parity-${testCase.id}-`));
      roots.push(root);

      for (const command of testCase.setup) {
        execSync(command, { cwd: root, stdio: "ignore" });
      }

      const configPath = join(root, "starship.toml");
      writeFileSync(configPath, testCase.config, "utf8");

      const scenario = { ...testCase.scenario, path: root, home: root };

      const args = [
        "prompt",
        ...(testCase.side === "right" ? ["--right"] : []),
        "--status",
        String(scenario.status),
        "--cmd-duration",
        String(scenario.cmdDurationMs),
        "--jobs",
        String(scenario.jobs),
        "--terminal-width",
        String(scenario.terminalWidth),
        "--path",
        root,
        "--logical-path",
        root,
      ];

      const actual = execFileSync("starship", args, {
        encoding: "utf8",
        cwd: root,
        env: {
          ...process.env,
          STARSHIP_CONFIG: configPath,
          // Deliberately not a real shell: zsh and bash make starship wrap
          // every escape sequence (`%{…%}` / `\[…\]`) so the shell can measure
          // prompt width. That wrapping is shell plumbing, not prompt content,
          // and the engine renders to a browser, which needs none of it.
          STARSHIP_SHELL: "unknown",
          // A fixed cache dir keeps starship from touching the real one.
          STARSHIP_CACHE: join(root, "cache"),
          TERM: "xterm-256color",
          HOME: root,
          ...testCase.env,
        },
      });

      const parsed = parseConfig(testCase.config);
      if (!parsed.ok) throw new Error(`fixture config is invalid: ${parsed.error}`);

      const rendered = renderPrompt({
        config: parsed.config,
        scenario,
        modules: moduleDefinitionsForConfig(parsed.config),
        defaultOrder: PROMPT_ORDER,
      });

      const expected = testCase.side === "right" ? segmentsToAnsi(rendered.right) :
        (rendered.leadingNewline ? "\n" : "") +
        rendered.lines.map((line) => segmentsToAnsi(line)).join("\n");

      /*
       * A case where both sides render nothing agrees perfectly and proves
       * nothing — and a module that stops appearing is exactly the drift this
       * suite exists to catch. Cases that are meant to print something say so.
       */
      if (testCase.expectsOutput !== false) {
        expect(`${testCase.id} rendered: ${actual.length > 0}`).toBe(
          `${testCase.id} rendered: true`,
        );
      }

      expect(printable(actual), `${version}; fixture ${testCase.id}`).toBe(printable(expected));
    });
  }
});

/** Renders escapes visibly, so a failure diff is readable. */
function printable(value: string): string {
  return value.replaceAll("\u001b", "\\e");
}
