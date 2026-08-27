"use client";

/**
 * Builder state.
 *
 * The config object mirrors the TOML structure exactly, so importing, editing
 * and exporting are all the same shape. Derived values (rendered segments,
 * serialised TOML) are computed by the components rather than stored, which
 * keeps undo/redo a simple matter of snapshotting `config`.
 */

import { create } from "zustand";

import type { StarshipConfig } from "@/lib/engine/prompt";
import type { Scenario } from "@/lib/scenarios/types";
import { DEFAULT_SCENARIO_ID, getScenario } from "@/lib/scenarios";
import { DEFAULT_PRESET_ID, getPreset } from "@/lib/config/presets";
import { parseConfig } from "@/lib/config/toml";
import { namedModuleIdentity } from "@/lib/engine/modules";
import { DEFAULT_FONT_SIZE, TERMINAL_FONTS, clampFontSize } from "@/lib/fonts";
import { DEFAULT_THEME_ID } from "@/lib/terminalThemes";

const HISTORY_LIMIT = 100;

/**
 * The reversed neutral ramp keys off the document element, so the whole
 * interface flips from one attribute.
 */
function applyAppTheme(theme: "dark" | "light") {
  if (typeof document !== "undefined") {
    document.documentElement.dataset.theme = theme;
  }
}

export interface BuilderState {
  config: StarshipConfig;
  /**
   * The environment the preview renders against.
   *
   * Seeded from the default scenario and then edited freely through the
   * environment panel. The bundled scenarios remain the parity harness's
   * fixtures; they are no longer a menu in the UI, because the panel can
   * express all of them and more.
   */
  scenario: Scenario;
  themeId: string;
  fontId: string;
  /** Terminal text size in px, as the reader set it. */
  fontSize: number;
  /** Light or dark chrome for the app itself, distinct from the terminal's. */
  appTheme: "dark" | "light";
  /**
   * False until someone works the toggle. While it is false the operating
   * system's preference wins, including when it changes mid-session.
   */
  appThemeIsExplicit: boolean;
  /** Module currently open in the settings pane; null means the root options. */
  selectedModule: string | null;

  past: StarshipConfig[];
  future: StarshipConfig[];

  setConfig(next: StarshipConfig, options?: { transient?: boolean }): void;
  /**
   * Adopts a config that arrived in the URL. It becomes the starting point
   * rather than an edit, so undo does not walk back to a prompt the visitor
   * never saw.
   */
  loadShared(config: StarshipConfig): void;
  /**
   * Puts back a session from local storage. `config` is skipped when a shared
   * link supplied one, which outranks it.
   */
  restoreSession(
    session: {
      config: StarshipConfig;
      scenario: Scenario;
      themeId: string;
      fontId: string;
      fontSize?: number;
      appTheme?: "dark" | "light";
    },
    options: { config: boolean },
  ): void;
  updateModuleOption(module: string, key: string, value: unknown): void;
  resetModuleOption(module: string, key: string): void;
  setModuleDisabled(module: string, disabled: boolean): void;
  setRootOption(key: string, value: unknown): void;
  selectModule(name: string | null): void;
  updateScenario(patch: Partial<Scenario>): void;
  setTheme(id: string): void;
  setFont(id: string): void;
  setFontSize(size: number): void;
  setAppTheme(theme: "dark" | "light"): void;
  /** Follows the OS preference, unless the toggle has been used. */
  adoptSystemTheme(theme: "dark" | "light"): void;
  undo(): void;
  redo(): void;
  reset(): void;
}

/**
 * The config the builder opens on.
 *
 * A blank config renders starship's plain defaults, which shows off neither
 * the tool nor this editor. Catppuccin Powerline exercises palettes, groups
 * and Nerd Font glyphs, so what loads is worth looking at — and it is what
 * Reset returns to, so "reset" and "what I first saw" agree.
 */
function initialConfig(): StarshipConfig {
  const preset = getPreset(DEFAULT_PRESET_ID);
  if (!preset) return {};
  const parsed = parseConfig(preset.toml);
  return parsed.ok ? parsed.config : {};
}

const EMPTY_CONFIG: StarshipConfig = initialConfig();

function withModuleOption(
  config: StarshipConfig,
  module: string,
  key: string,
  value: unknown,
): StarshipConfig {
  const identity = namedModuleIdentity(module);
  if (identity) {
    const family = (config[identity.kind] as Record<string, unknown> | undefined) ?? {};
    const existing = (family[identity.instance] as Record<string, unknown> | undefined) ?? {};
    return {
      ...config,
      [identity.kind]: {
        ...family,
        [identity.instance]: { ...existing, [key]: value },
      },
    };
  }
  const existing = (config[module] as Record<string, unknown> | undefined) ?? {};
  return { ...config, [module]: { ...existing, [key]: value } };
}

function withoutModuleOption(
  config: StarshipConfig,
  module: string,
  key: string,
): StarshipConfig {
  const identity = namedModuleIdentity(module);
  if (identity) {
    const family = config[identity.kind] as Record<string, unknown> | undefined;
    const existing = family?.[identity.instance] as Record<string, unknown> | undefined;
    if (!family || !existing) return config;
    const next = { ...existing };
    delete next[key];
    // An empty named table still declares an instance whose defaults matter.
    return {
      ...config,
      [identity.kind]: { ...family, [identity.instance]: next },
    };
  }
  const existing = config[module] as Record<string, unknown> | undefined;
  if (!existing) return config;
  const next = { ...existing };
  delete next[key];
  if (Object.keys(next).length === 0) {
    const copy = { ...config };
    delete copy[module];
    return copy;
  }
  return { ...config, [module]: next };
}

export const useBuilderStore = create<BuilderState>((set, get) => ({
  config: EMPTY_CONFIG,
  scenario: getScenario(DEFAULT_SCENARIO_ID),
  themeId: DEFAULT_THEME_ID,
  // The first bundled font is the default, so the list stays the one
  // place that decides which font people see first.
  fontId: TERMINAL_FONTS[0].id,
  fontSize: DEFAULT_FONT_SIZE,
  appTheme: "dark",
  appThemeIsExplicit: false,
  selectedModule: null,
  past: [],
  future: [],

  setConfig(next, options) {
    const { config, past } = get();
    if (options?.transient) {
      set({ config: next });
      return;
    }
    set({
      config: next,
      past: [...past, config].slice(-HISTORY_LIMIT),
      future: [],
    });
  },

  loadShared(config) {
    set({ config, past: [], future: [] });
  },

  restoreSession(session, options) {
    set({
      ...(options.config ? { config: session.config } : {}),
      scenario: session.scenario,
      themeId: session.themeId,
      fontId: session.fontId,
      // Sessions stored before the size was settable have none.
      fontSize: session.fontSize ?? DEFAULT_FONT_SIZE,
      // A restored session is where this visitor was, not an edit they can
      // undo their way out of.
      past: [],
      future: [],
      ...(session.appTheme
        ? { appTheme: session.appTheme, appThemeIsExplicit: true }
        : {}),
    });
    if (session.appTheme) applyAppTheme(session.appTheme);
  },

  updateModuleOption(module, key, value) {
    get().setConfig(withModuleOption(get().config, module, key, value));
  },

  resetModuleOption(module, key) {
    get().setConfig(withoutModuleOption(get().config, module, key));
  },

  setModuleDisabled(module, disabled) {
    get().setConfig(withModuleOption(get().config, module, "disabled", disabled));
  },

  setRootOption(key, value) {
    const config = { ...get().config };
    if (value === undefined) delete config[key];
    else config[key] = value;
    get().setConfig(config);
  },

  selectModule(name) {
    set({ selectedModule: name });
  },

  updateScenario(patch) {
    set({ scenario: { ...get().scenario, ...patch } });
  },

  setTheme(id) {
    set({ themeId: id });
  },

  setFont(id) {
    set({ fontId: id });
  },

  setFontSize(size) {
    set({ fontSize: clampFontSize(size) });
  },

  setAppTheme(theme) {
    set({ appTheme: theme, appThemeIsExplicit: true });
    applyAppTheme(theme);
  },

  adoptSystemTheme(theme) {
    // A deliberate choice outranks the operating system for the rest of the
    // session; without one, the interface simply follows it.
    if (get().appThemeIsExplicit) return;
    set({ appTheme: theme });
    applyAppTheme(theme);
  },

  undo() {
    const { past, config, future } = get();
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    set({
      config: previous,
      past: past.slice(0, -1),
      future: [config, ...future].slice(0, HISTORY_LIMIT),
    });
  },

  redo() {
    const { future, config, past } = get();
    if (future.length === 0) return;
    set({
      config: future[0],
      future: future.slice(1),
      past: [...past, config].slice(-HISTORY_LIMIT),
    });
  },

  reset() {
    get().setConfig(EMPTY_CONFIG);
  },
}));
