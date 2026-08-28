import { describe, expect, it } from "vitest";
import { CLOUD_MODULES } from "../../src/lib/engine/modules/cloud";
import { renderPrompt } from "../../src/lib/engine/prompt";
import { segmentsText } from "../../src/lib/engine/types";
import type { Scenario } from "../../src/lib/scenarios/types";

const base: Scenario = {
  id: "smoke",
  label: "smoke",
  description: "",
  path: "/home/nick/work",
  home: "/home/nick",
  readOnly: false,
  files: [],
  status: 0,
  cmdDurationMs: 0,
  jobs: 0,
  username: "nick",
  hostname: "box",
  ssh: false,
  isRoot: false,
  shell: "zsh",
  keymap: "insert",
  time: "2026-08-18T10:00:00",
  terminalWidth: 120,
  toolVersions: {},
  env: {},
};

function render(scenario: Partial<Scenario>, config: Record<string, unknown> = {}): string {
  const result = renderPrompt({
    config: { format: "$all", ...config },
    scenario: { ...base, ...scenario },
    modules: CLOUD_MODULES,
    // `vcs` is registered but deliberately excluded from Starship's `$all`.
    defaultOrder: CLOUD_MODULES.map((m) => m.name).filter((name) => name !== "vcs"),
  });
  expect(result.warnings).toEqual([]);
  return result.lines.map(segmentsText).join("\n");
}

describe("cloud modules", () => {
  it("renders nothing for an empty scenario", () => {
    expect(render({})).toBe("");
  });

  it("aws: profile, region, duration and aliases", () => {
    expect(render({ aws: { profile: "prod", region: "ap-southeast-2", duration: "30m" } })).toBe(
      "on ☁️  prod (ap-southeast-2) [30m] ",
    );
    expect(
      render(
        { aws: { profile: "prod", region: "ap-southeast-2" } },
        { aws: { region_aliases: { "ap-southeast-2": "syd" }, profile_aliases: { prod: "P" } } },
      ),
    ).toBe("on ☁️  P (syd) ");
  });

  it("aws: hides a region-only context unless force_display", () => {
    expect(render({ aws: { region: "us-east-1" } })).toBe("");
    expect(render({ aws: { region: "us-east-1" } }, { aws: { force_display: true } })).toBe(
      "on ☁️  (us-east-1) ",
    );
    expect(
      render({ aws: { region: "us-east-1" }, env: { AWS_ACCESS_KEY_ID: "AKIA" } }),
    ).toBe("on ☁️  (us-east-1) ");
  });

  it("aws: expiration_symbol for an elapsed duration", () => {
    expect(render({ aws: { profile: "p", duration: "-1m" } })).toBe("on ☁️  p [X] ");
  });

  it("gcloud: splits account into account/domain", () => {
    expect(
      render({ gcloud: { account: "nick@ndl.au", region: "australia-southeast1" } }),
    ).toBe("on ☁️  nick@ndl.au(australia-southeast1) ");
  });

  it("kubernetes: disabled by default, context_aliases when enabled", () => {
    expect(render({ kubernetes: { context: "prod", namespace: "web" } })).toBe("");
    expect(
      render({ kubernetes: { context: "prod", namespace: "web" } }, { kubernetes: { disabled: false } }),
    ).toBe("☸ prod (web) in ");
    expect(
      render(
        { kubernetes: { context: "gke_myaccount_ap-southeast-2_mycluster" } },
        {
          kubernetes: {
            disabled: false,
            context_aliases: { "gke_.*_(?P<cluster>[\\w-]+)": "gke-$cluster" },
          },
        },
      ),
    ).toBe("☸ gke-mycluster in ");
  });

  it("kubernetes: contexts rule overrides symbol and style", () => {
    expect(
      render(
        { kubernetes: { context: "prod-au", user: "admin" } },
        {
          kubernetes: {
            disabled: false,
            contexts: [
              { context_pattern: "prod-.*", user_pattern: "admin", symbol: "!! ", context_alias: "PROD" },
            ],
          },
        },
      ),
    ).toBe("!! PROD in ");
  });

  it("terraform: detects .tf files and defaults the workspace", () => {
    expect(render({ files: ["main.tf"] })).toBe("via 💠 default ");
    expect(render({ files: [".terraform"], terraform: { workspace: "staging" } })).toBe(
      "via 💠 staging ",
    );
  });

  it("docker_context: only with files, and hides implicit contexts", () => {
    expect(render({ docker: { context: "remote" } })).toBe("");
    expect(render({ files: ["Dockerfile"], docker: { context: "remote" } })).toBe(
      "via 🐳 remote ",
    );
    expect(render({ files: ["Dockerfile"], docker: { context: "default" } })).toBe("");
  });

  it("nix_shell: pure, impure and heuristic-unknown states", () => {
    expect(render({ nix: { impure: true, name: "shell" } })).toBe("via ❄️  impure (shell) ");
    expect(render({ nix: { impure: false } })).toBe("via ❄️  pure ");
    expect(
      render({ env: { PATH: "/nix/store/abc/bin:/usr/bin" } }, { nix_shell: { heuristic: true } }),
    ).toBe("via ❄️   ");
  });

  it("conda: ignores base and truncates path-shaped names", () => {
    expect(render({ conda: { environment: "base" } })).toBe("");
    expect(render({ conda: { environment: "/opt/envs/ml" } })).toBe("via 🅒 ml ");
    expect(render({ conda: { environment: "ml" }, env: { PIXI_ENVIRONMENT_NAME: "x" } })).toBe("");
  });

  it("env-driven modules render from scenario.env", () => {
    expect(render({ env: { OS_CLOUD: "devstack", OS_PROJECT_NAME: "eng" } })).toBe(
      "on ☁️  devstack(eng) ",
    );
    expect(render({ env: { VCSH_REPO_NAME: "dotfiles" } })).toBe("vcsh dotfiles ");
    expect(render({ env: { GUIX_ENVIRONMENT: "/gnu/store/x" } })).toBe("via 🐃  ");
    expect(render({ env: { SINGULARITY_NAME: "centos.img" } })).toBe("[centos.img] ");
    expect(render({ env: { SPACK_ENV: "/spack/envs/astro" } })).toBe("via 🅢 astro ");
  });

  it("pulumi: needs a project file, takes stack from the env", () => {
    expect(render({ env: { PULUMI_STACK: "dev" } })).toBe("");
    expect(
      render({ files: ["Pulumi.yaml"], env: { PULUMI_STACK: "dev", PULUMI_USERNAME: "nick" } }),
    ).toBe("via  nick@dev ");
  });

  it("azure: disabled by default, renders the subscription when enabled", () => {
    expect(render({ azure: { subscription: "Sub" } })).toBe("");
    expect(render({ azure: { subscription: "Sub" } }, { azure: { disabled: false } })).toBe(
      "on \u{f0805} Sub ",
    );
  });

  it("hg_branch: disabled by default, falls back to the default branch", () => {
    expect(render({ files: [".hg"] })).toBe("");
    expect(render({ files: [".hg"] }, { hg_branch: { disabled: false } })).toBe(
      "on  default ",
    );
    expect(
      render({ files: [".hg"] }, { hg_branch: { disabled: false, truncation_length: 3 } }),
    ).toBe("on  def… ");
  });

  it("every module's defaults parse as a format string", () => {
    for (const module of CLOUD_MODULES) {
      if (module.name === "vcs") expect(module.defaults.format).toBeUndefined();
      else expect(typeof module.defaults.format).toBe("string");
      expect(typeof module.defaults.disabled).toBe("boolean");
    }
  });
});
