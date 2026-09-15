import { describe, expect, it } from "vitest";

import { withModuleOption, withoutModuleOption, withRootOption } from "./mutations";

describe("configuration mutations", () => {
  it("edits and removes an ordinary module option immutably", () => {
    const initial = { directory: { style: "blue" } };
    const changed = withModuleOption(initial, "directory", "style", "green");

    expect(changed).toEqual({ directory: { style: "green" } });
    expect(initial).toEqual({ directory: { style: "blue" } });
    expect(withoutModuleOption(changed, "directory", "style")).toEqual({});
  });

  it("keeps an empty named-module table when its final override is reset", () => {
    const initial = { env_var: { SHELL: { style: "red" } } };
    expect(withoutModuleOption(initial, "env_var.SHELL", "style")).toEqual({
      env_var: { SHELL: {} },
    });
  });

  it("sets and removes root options", () => {
    expect(withRootOption({}, "add_newline", false)).toEqual({ add_newline: false });
    expect(withRootOption({ add_newline: false }, "add_newline", undefined)).toEqual({});
  });
});
