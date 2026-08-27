import { describe, expect, it } from "vitest";

import { CUSTOM_OS_VALUES, optionEnum } from "./optionEnums";

describe("option enums", () => {
  it("offers Starship's Unix alias and every current Rust OS identifier", () => {
    expect(CUSTOM_OS_VALUES).toEqual([
      "unix",
      "linux",
      "windows",
      "macos",
      "android",
      "ios",
      "openbsd",
      "freebsd",
      "netbsd",
      "wasi",
      "hermit",
      "aix",
      "apple",
      "dragonfly",
      "emscripten",
      "espidf",
      "fortanix",
      "uefi",
      "fuchsia",
      "haiku",
      "watchos",
      "visionos",
      "tvos",
      "horizon",
      "hurd",
      "illumos",
      "l4re",
      "nto",
      "redox",
      "solaris",
      "solid_asp3",
      "vexos",
      "vita",
      "vxworks",
      "xous",
    ]);
    expect(new Set(CUSTOM_OS_VALUES).size).toBe(CUSTOM_OS_VALUES.length);
  });

  it("uses the selector for every named custom module instance", () => {
    const enumeration = optionEnum("custom.project", "os");
    expect(enumeration?.unsetLabel).toBe("Any operating system");
    expect(enumeration?.choices[0]).toEqual({
      value: "unix",
      label: "unix — any Unix target",
    });
  });
});
