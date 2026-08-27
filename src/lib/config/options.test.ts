import { describe, expect, it } from "vitest";
import { describeOption, optionDoc } from "./options";
import generated from "../../../data/options.generated.json";
import { ALL_MODULES } from "@/lib/engine/modules";
import { getModuleSchema } from "./schema";

/**
 * Options the builder shows that starship does not accept.
 *
 * The engine needs a format string for these two to render at all, and it
 * lives in the same `defaults` map every real option comes from — so they
 * surface as rows. They are not in starship's schema or its documentation,
 * so there is nothing truthful to say about them here.
 */
const NOT_STARSHIP_OPTIONS = new Set(["fill.format", "line_break.format"]);

describe("option documentation", () => {
  it("explains every option the settings form shows", () => {
    const undescribed: string[] = [];
    for (const module of ALL_MODULES) {
      for (const key of Object.keys(module.defaults)) {
        // `disabled` is the module's switch, not a row.
        if (key === "disabled") continue;
        if (NOT_STARSHIP_OPTIONS.has(`${module.name}.${key}`)) continue;
        if (!describeOption(module.name, key)) undescribed.push(`${module.name}.${key}`);
      }
    }
    expect(undescribed).toEqual([]);
  });

  it("keeps the exemptions honest", () => {
    // If starship gains these, the exemption should go rather than linger.
    for (const entry of NOT_STARSHIP_OPTIONS) {
      const [module, key] = entry.split(".");
      const keys = getModuleSchema(module)?.options.map((o) => o.key) ?? [];
      expect(`${entry}: ${keys.includes(key)}`).toBe(`${entry}: false`);
    }
  });

  it("reads the module's own table", () => {
    expect(describeOption("username", "show_always")).toBe(
      "Always shows the username module.",
    );
    expect(describeOption("username", "style_root")).toBe(
      "The style used when the user is root/admin.",
    );
    // Same option name, different module, different text.
    expect(describeOption("git_branch", "format")).not.toBe(
      describeOption("username", "format"),
    );
  });

  it("preserves every linked option reference found in the upstream tables", () => {
    const linked = Object.entries(generated).flatMap(([anchor, options]) =>
      Object.entries(options).flatMap(([option, doc]) =>
        "links" in doc ? doc.links.map((link) => `${anchor}.${option}: ${link.url}`) : [],
      ),
    );
    expect(linked).toEqual([
      "conda.truncation_length: https://starship.rs/config/#directory",
      "custom-commands.os: https://doc.rust-lang.org/std/env/consts/constant.OS.html",
      "custom-commands.shell: https://starship.rs/config/#custom-command-shell",
      "prompt.palettes: https://starship.rs/advanced-config/#style-strings",
      "prompt.right_format: https://starship.rs/advanced-config/#enable-right-prompt",
      "spack.truncation_length: https://starship.rs/config/#directory",
      "time.time_format: https://docs.rs/jiff/latest/jiff/fmt/strtime/index.html",
    ]);
  });

  it("turns the custom OS cross-reference into self-contained control copy", () => {
    expect(optionDoc("custom.project", "os")).toEqual({
      description:
        "Only show this custom module on the selected operating system. Supported Rust OS values.",
      links: [
        {
          label: "Supported Rust OS values",
          url: "https://doc.rust-lang.org/std/env/consts/constant.OS.html",
        },
      ],
    });
  });

  it("has nothing to say about a key that is not an option", () => {
    expect(describeOption("username", "nonsense")).toBeUndefined();
    expect(describeOption("not_a_module", "format")).toBeUndefined();
  });
});
