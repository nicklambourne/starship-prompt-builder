import { getOptionSchema } from "./schema";

export interface OptionChoice {
  value: string;
  label: string;
}

export interface OptionEnum {
  choices: OptionChoice[];
  /** Selecting the empty choice removes the option and restores its default. */
  unsetLabel?: string;
}

/**
 * Values documented by Rust's `std::env::consts::OS`.
 *
 * Starship compares `custom.*.os` directly with that constant. It additionally
 * accepts `unix` as a convenience for every Unix target, so that value sits
 * beside Rust's concrete targets rather than being hidden in a free-text field.
 * Source: https://doc.rust-lang.org/std/env/consts/constant.OS.html
 */
export const CUSTOM_OS_VALUES = [
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
] as const;

function templateModuleName(name: string): string {
  if (name.startsWith("custom.")) return "custom";
  if (name.startsWith("env_var.")) return "env_var";
  return name;
}

/** Curated choices first, then any enums Starship adds to its schema. */
export function optionEnum(moduleName: string, optionKey: string): OptionEnum | undefined {
  if (templateModuleName(moduleName) === "custom" && optionKey === "os") {
    return {
      unsetLabel: "Any operating system",
      choices: CUSTOM_OS_VALUES.map((value) => ({
        value,
        label: value === "unix" ? "unix — any Unix target" : value,
      })),
    };
  }

  const values = getOptionSchema(templateModuleName(moduleName), optionKey)?.enum;
  return values?.length
    ? { choices: values.map((value) => ({ value, label: value })) }
    : undefined;
}
