"use client";

/**
 * The builder.
 *
 * One page, no tabs: the prompt preview stays pinned while everything that can
 * change it — the format, the modules, the TOML — scrolls beneath it. Splitting
 * these across tabs meant a change and its effect were never on screen
 * together, which is the whole point of a live configurator.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { EnvironmentPanel } from "./EnvironmentPanel";
import { Explainer } from "./Explainer";
import { PaletteEditor } from "./PaletteEditor";
import { FormatBuilder } from "./FormatBuilder";
import { PreviewPane } from "./PreviewPane";
import { SiteFooter } from "./SiteFooter";
import { SettingsForm, type OptionDescriptor } from "./SettingsForm";
import { TomlPane } from "./TomlPane";
import { UsageGuide } from "./UsageGuide";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Logo } from "@/components/ui/Logo";
import { Toggle } from "@/components/ui/Toggle";
import {
  ChevronIcon,
  CheckIcon,
  DownloadIcon,
  GitHubIcon,
  MoonIcon,
  SunIcon,
  RedoIcon,
  ResetIcon,
  ShareIcon,
  UndoIcon,
} from "@/components/ui/icons";
import { ALL_MODULES, MODULES_BY_NAME } from "@/lib/engine/modules";
import { PROMPT_ORDER } from "@/lib/engine/promptOrder";
import { DEFAULT_FORMAT, isModuleDisabled, renderPrompt } from "@/lib/engine/prompt";
import { collectVariables, tryParseFormatString } from "@/lib/engine/formatString";
import { resolvePalette } from "@/lib/engine/styleString";
import { expandAll, structuredFormatString } from "@/lib/config/defaultFormat";
import { colorsInUse } from "@/lib/config/colorsInUse";
import { inactiveReason } from "@/lib/config/inactiveReason";
import { describeOption } from "@/lib/config/options";
import { describeVariable } from "@/lib/config/variables";
import { moduleStyleReaches, rowStyleReaches } from "@/lib/config/styleReach";
import { MODULE_META, optionKind } from "@/lib/config/meta";
import { PRESETS } from "@/lib/config/presets";
import { decodeShare, encodeShare } from "@/lib/config/share";
import { loadSession, saveSession } from "@/lib/config/session";
import { parseConfig, serialiseConfig } from "@/lib/config/toml";
import { MODULE_DEFAULTS } from "@/lib/config/rescue";
import { TERMINAL_FONTS } from "@/lib/fonts";
import { NAMED_COLORS } from "@/lib/engine/types";
import { getTheme } from "@/lib/terminalThemes";
import { useBuilderStore } from "@/state/builderStore";

/** Root options that are not the format itself; format gets its own section. */
const ROOT_OPTIONS: OptionDescriptor[] = [
  {
    key: "palette",
    kind: "string",
    defaultValue: "",
    description: "Name of the palette in [palettes] to activate.",
  },
  {
    key: "continuation_prompt",
    kind: "format",
    defaultValue: "[∙](bright-black) ",
    description: "Shown for continuation lines of a multi-line command.",
  },
  {
    key: "scan_timeout",
    kind: "number",
    defaultValue: 30,
    description: "Milliseconds starship may spend scanning files.",
  },
  {
    key: "command_timeout",
    kind: "number",
    defaultValue: 500,
    description: "Milliseconds starship may spend running a command.",
  },
];

const CARD = "rounded-xl border border-white/10 bg-neutral-900/40 p-4";
const ICON_BUTTON =
  "grid size-9 place-items-center rounded border border-white/10 text-neutral-300 transition enabled:hover:border-accent-400 enabled:hover:text-accent-200 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-400";

export function Builder() {
  const {
    config,
    scenario,
    themeId,
    fontId,
    fontSize,
    selectedModule,
    setConfig,
    updateModuleOption,
    resetModuleOption,
    setModuleDisabled,
    setRootOption,
    selectModule,
    updateScenario,
    setTheme,
    setFont,
    setFontSize,
    appTheme,
    setAppTheme,
    adoptSystemTheme,
    loadShared,
    restoreSession,
    appThemeIsExplicit,
    undo,
    redo,
    reset,
    past,
    future,
  } = useBuilderStore();

  // The starship.toml card is a disclosure of its own making; see below.
  const [previewOpen, setPreviewOpen] = useState(true);
  const [tomlOpen, setTomlOpen] = useState(false);

  // Guards the save effect until the restore has run.
  const [sessionReady, setSessionReady] = useState(false);

  /*
   * A config arriving in the URL fragment. The share button has always
   * written one; nothing ever read it back, so every link anyone shared
   * opened on the default prompt.
   *
   * Read after mount rather than during render: the fragment is not part of
   * the prerendered HTML, and reading it during render would disagree with it.
   */
  useEffect(() => {
    const shared = decodeShare(window.location.hash);
    if (shared) loadShared(shared);

    /*
     * Then the rest of the session. A link's config outranks a stored one —
     * following a share should show that prompt, not the last one edited on
     * this machine — but the environment, font and colour scheme are this
     * visitor's own either way, so they are restored regardless.
     */
    const session = loadSession();
    if (session) restoreSession(session, { config: !shared });
    setSessionReady(true);

    /*
     * Arriving at a different fragment without a reload — pasting a share
     * link into the address bar of a tab already showing the builder, or
     * following one from another page on the site — is a same-document
     * navigation, so the effect above never runs again. The app's own share
     * button uses replaceState, which does not raise this event.
     */
    const onHashChange = () => {
      const next = decodeShare(window.location.hash);
      if (next) loadShared(next);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /*
   * What would be saved right now. Kept in a ref as well as in the debounce
   * below, so the page can be left mid-debounce without losing the last edit.
   */
  const sessionSnapshot = useRef({
    config,
    scenario,
    themeId,
    fontId,
    fontSize,
    // Only a deliberate choice is worth restoring; otherwise the operating
    // system keeps deciding, which is what someone who never touched the
    // toggle expects.
    appTheme: appThemeIsExplicit ? appTheme : undefined,
  });
  sessionSnapshot.current = {
    config,
    scenario,
    themeId,
    fontId,
    fontSize,
    appTheme: appThemeIsExplicit ? appTheme : undefined,
  };

  /*
   * Save on every change, once the restore above has run — writing before it
   * would overwrite the stored session with the defaults it is about to
   * replace. Debounced, because typing in the TOML pane changes the config on
   * every keystroke.
   */
  useEffect(() => {
    if (!sessionReady) return;
    const timer = window.setTimeout(() => {
      saveSession(sessionSnapshot.current);
      /*
       * Keep the fragment honest. Sharing used to stamp it once, so every
       * later edit left the address bar describing a config that no longer
       * existed — anyone who copied it by hand, or reloaded, got the older
       * prompt back. replaceState rather than pushState: this is the same
       * page, not a new entry in the visitor's back button.
       */
      window.history.replaceState(null, "", `#${encodeShare(config)}`);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [
    sessionReady,
    config,
    scenario,
    themeId,
    fontId,
    appTheme,
    appThemeIsExplicit,
  ]);

  /*
   * Reloading or closing within that quarter second would otherwise lose the
   * last edit — which is exactly when someone is most likely to do it.
   * `pagehide` is the one event that fires reliably on mobile, where tabs are
   * discarded rather than closed.
   */
  useEffect(() => {
    if (!sessionReady) return;
    const flush = () => saveSession(sessionSnapshot.current);
    const onHidden = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onHidden);
    };
  }, [sessionReady]);

  /*
   * Follow the operating system's colour scheme, and keep following it if it
   * changes — someone on an automatic day/night switch should not have to
   * work the toggle twice a day. The store stops listening once the toggle is
   * used.
   */
  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: light)");
    const sync = () => adoptSystemTheme(query.matches ? "light" : "dark");
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, [adoptSystemTheme]);

  const [shareCopied, setShareCopied] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);

  const theme = getTheme(themeId);
  const font = TERMINAL_FONTS.find((f) => f.id === fontId) ?? TERMINAL_FONTS[0];
  const palette = resolvePalette(config.palettes, config.palette);
  const paletteNames = useMemo(
    () => Object.keys(config.palettes?.[config.palette ?? ""] ?? {}),
    [config.palettes, config.palette],
  );

  /**
   * The format the editor works on.
   *
   * Starship's default is the single token `$all`, which is nothing to look at
   * and nothing to rearrange, so the editor opens on its expanded, grouped
   * equivalent. This is the *effective* format — it is what the preview renders
   * and what the TOML exports, so the two can never disagree with what the
   * editor shows.
   */
  const structuredDefault = useMemo(
    () =>
      structuredFormatString(
        DEFAULT_FORMAT,
        PROMPT_ORDER,
        (name) => MODULE_META[name]?.group,
      ),
    [],
  );
  const format =
    typeof config.format === "string" ? config.format : structuredDefault;
  const rendered = useMemo(
    () =>
      renderPrompt({
        config: { ...config, format },
        scenario,
        modules: ALL_MODULES,
        defaultOrder: PROMPT_ORDER,
      }),
    [config, format, scenario],
  );



  const rightFormat = typeof config.right_format === "string" ? config.right_format : "";

  /** Module names available to the root format. */
  const moduleVocabulary = useMemo(
    () => ["all", ...ALL_MODULES.map((m) => m.name)],
    [],
  );

  /**
   * Whether the row's swatch is this module's `style` option: it is, for every
   * module that has one. The swatch replaces the option rather than standing
   * beside it, so it is available on the same terms the option was — always,
   * whatever the module's format happens to spend.
   */
  const rowOwnsStyle = useCallback(
    (name: string) => typeof MODULES_BY_NAME.get(name)?.defaults.style === "string",
    [],
  );

  const optionsFor = useCallback((name: string): OptionDescriptor[] => {
    const definition = MODULES_BY_NAME.get(name);
    if (!definition) return [];
    const meta = MODULE_META[name];
    return Object.entries(definition.defaults)
      // `disabled` is the switch on the row, and `style` is usually the swatch
      // beside it: both are settings, but the row is where people look.
      .filter(([key]) => key !== "disabled" && !(key === "style" && rowOwnsStyle(name)))
      .map(([key, defaultValue]) => ({
        key,
        kind: optionKind(name, key, defaultValue, meta),
        defaultValue,
        description: describeOption(name, key),
      }));
  }, [rowOwnsStyle]);

  /** Variables a module's own format strings may reference. */
  const variablesFor = useCallback(
    (name: string) => {
      const definition = MODULES_BY_NAME.get(name);
      if (!definition) return [];
      let fromEvaluate: string[] = [];
      try {
        const result = definition.evaluate(definition.defaults, {
          scenario,
          rootConfig: config,
        });
        fromEvaluate = result ? Object.keys(result.variables) : [];
      } catch {
        fromEvaluate = [];
      }
      const parsed = tryParseFormatString(definition.defaults.format);
      const fromFormat = parsed.ok ? collectVariables(parsed.elements) : [];
      return [...new Set([...fromEvaluate, ...fromFormat])].sort();
    },
    [scenario, config],
  );

  /**
   * Modules that are switched on but render nothing in this environment.
   *
   * A switch reading "on" beside an empty prompt is the single most confusing
   * thing about starship's defaults — `username` and `hostname` are on, and
   * invisible, until you are root or on SSH.
   */
  const inactiveNotes = useMemo(() => {
    const notes = new Map<string, string>();
    for (const definition of ALL_MODULES) {
      const options = {
        ...definition.defaults,
        ...((config[definition.name] as Record<string, unknown>) ?? {}),
      };
      let produces = false;
      try {
        produces = definition.evaluate(options, { scenario, rootConfig: config }) !== null;
      } catch {
        produces = false;
      }
      if (!produces) {
        notes.set(definition.name, inactiveReason(definition.name, scenario, options));
      }
    }
    return notes;
  }, [config, scenario]);

  /**
   * What the prompt on screen is painted with.
   *
   * A module counts only if it is in the format, switched on, and actually
   * rendering — a config carries styles for modules that meet none of those,
   * and listing their colours answers a question nobody asked.
   */
  const inUse = useMemo(() => {
    const parsedRoot = tryParseFormatString(expandAll(format, PROMPT_ORDER));
    const inFormat = new Set(parsedRoot.ok ? collectVariables(parsedRoot.elements) : []);
    return colorsInUse(config, {
      renders: (name) => {
        if (!inFormat.has(name)) return false;
        const definition = MODULES_BY_NAME.get(name);
        if (!definition || isModuleDisabled(config, definition)) return false;
        return !inactiveNotes.has(name);
      },
    });
  }, [config, format, inactiveNotes]);

  /** Just the tokens, for the style pickers' own row. */
  const inUseTokens = useMemo(() => inUse.map((colour) => colour.token), [inUse]);

  const moduleControls = useMemo(
    () => ({
      isEnabled(name: string) {
        const options = (config[name] as Record<string, unknown>) ?? {};
        const disabled =
          typeof options.disabled === "boolean"
            ? options.disabled
            : (MODULES_BY_NAME.get(name)?.defaults.disabled ?? false);
        return !disabled;
      },
      inactiveNote(name: string) {
        return inactiveNotes.get(name) ?? null;
      },
      /*
       * Whether a style set here could change anything this module prints.
       * Read from the module's live format, not a fixed list, so editing that
       * format re-enables the control. Which rule applies depends on what the
       * control edits: a module with a `style` option is edited through it,
       * and that option only shows where the format spends `$style`.
       */
      styleReaches(name: string) {
        /*
         * A swatch that edits the module's own option is never struck: it
         * writes a real setting, and a format that does not spend `$style`
         * yet is a thing to say in the panel, not a reason to take the only
         * control away. The strike is for the other six modules, where the
         * swatch is still a style written around the module in the format.
         */
        if (rowOwnsStyle(name)) return true;
        const options = (config[name] as Record<string, unknown>) ?? {};
        const format = options.format ?? MODULES_BY_NAME.get(name)?.defaults.format;
        return typeof format === "string" ? rowStyleReaches(format) : true;
      },
      /*
       * A module's own style is the one that shows — a style written around
       * `$module` in the prompt format only paints what the module emits
       * unstyled, which for most of them is nothing. So the row's swatch edits
       * the option, and the option leaves the list below.
       */
      styleOption(name: string) {
        const definition = MODULES_BY_NAME.get(name);
        if (!definition || typeof definition.defaults.style !== "string") return null;
        const options = (config[name] as Record<string, unknown>) ?? {};
        const set = typeof options.style === "string" ? options.style : null;
        const format = options.format ?? definition.defaults.format;
        return {
          value: set ?? definition.defaults.style,
          isDefault: set === null,
          defaultValue: definition.defaults.style,
          // `$style` is what spends this option. A format that has lost it
          // still takes a value; it just will not show one.
          spent: typeof format === "string" ? moduleStyleReaches(format) : true,
        };
      },
      setStyleOption(name: string, value: string | undefined) {
        if (value === undefined) resetModuleOption(name, "style");
        else updateModuleOption(name, "style", value);
      },
      setEnabled(name: string, enabled: boolean) {
        setModuleDisabled(name, !enabled);
      },
      renderSettings(name: string) {
        return renderSettings(name);
      },
    }),
    // renderSettings is redefined whenever the config changes, which is also
    // exactly when enablement can change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      config,
      inactiveNotes,
      setModuleDisabled,
      rowOwnsStyle,
      updateModuleOption,
      resetModuleOption,
    ],
  );

  /**
   * A module's settings, or null when there are none to show.
   *
   * Null is load-bearing: it is what tells a row it has nothing under it, so
   * the row can disable its own disclosure rather than opening on an empty
   * box. `$all` and every variable inside a module's format land here.
   */
  const renderSettings = useCallback(
    (name: string) => {
      if (optionsFor(name).length === 0) return null;
      return (
      <SettingsForm
        options={optionsFor(name)}
        values={(config[name] as Record<string, unknown>) ?? {}}
        onChange={(key, value) => updateModuleOption(name, key, value)}
        onReset={(key) => resetModuleOption(name, key)}
        formatVariables={variablesFor(name)}
        describeVariable={(variable) => describeVariable(name, variable)}
        palette={palette}
        paletteNames={paletteNames}
        inUseColors={inUseTokens}
        theme={theme}
        fontStack={font.stack}
      />
      );
    },
    [
      config,
      optionsFor,
      variablesFor,
      updateModuleOption,
      resetModuleOption,
      palette,
      paletteNames,
      theme,
      font.stack,
    ],
  );

  // Shared with the error boundary, which needs the same map to hand back a
  // config after a crash.
  const defaultsByModule = MODULE_DEFAULTS;

  const downloadConfig = useCallback(() => {
    const text = serialiseConfig(
      { ...config, format },
      { defaults: defaultsByModule },
    );
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "starship.toml";
    link.click();
    URL.revokeObjectURL(url);
  }, [config, format, defaultsByModule]);

  const share = useCallback(async () => {
    // The fragment is kept current by the effect above, but a share can beat
    // its debounce, so it is written here too rather than copying a URL that
    // is a quarter second out of date.
    const fragment = encodeShare(config);
    const url = `${window.location.origin}${window.location.pathname}#${fragment}`;
    window.history.replaceState(null, "", `#${fragment}`);
    await navigator.clipboard.writeText(url);
    setShareCopied(true);
    window.setTimeout(() => setShareCopied(false), 1500);
  }, [config]);

  const loadPreset = useCallback(
    (id: string) => {
      const preset = PRESETS.find((p) => p.id === id);
      if (!preset) return;
      const result = parseConfig(preset.toml);
      if (result.ok) setConfig(result.config);
    },
    [setConfig],
  );

  // The style pickers' swatches follow the active terminal colour scheme.
  const ansiVars = useMemo(() => {
    const vars: Record<string, string> = {};
    NAMED_COLORS.forEach((name, index) => {
      vars[`--ansi-${name}`] = theme.ansi[index];
    });
    vars["--nerd-font-stack"] = font.stack;
    return vars as React.CSSProperties;
  }, [theme, font.stack]);


  return (
    <div style={ansiVars} className="min-h-screen">
      <ConfirmDialog
        open={confirmingReset}
        title="Reset everything?"
        body={
          <>
            Every module setting, style and grouping goes back to the starting
            prompt. The simulated environment is left as it is, and undo will
            bring your config back.
          </>
        }
        confirmLabel="Reset"
        onCancel={() => setConfirmingReset(false)}
        onConfirm={() => {
          setConfirmingReset(false);
          reset();
        }}
      />
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-white/10 px-4 py-3">
        <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          {/*
            Bigger than the line it sits on. The margin is exactly -7px so the
            mark's *layout* height stays 30px — what it was before — while it
            draws at 44: on desktop the bar's height comes from the 36px icon
            buttons, but on a phone the header wraps and this heading sets the
            first row, so anything taller than 30 moved the bar. Its viewBox
            carries glow bleed, so the ink is 40px of the 44.
          */}
          <Logo size={44} className="-my-[7px]" />
          Starship Prompt Builder
        </h1>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={undo}
            disabled={past.length === 0}
            aria-label="Undo"
            title="Undo"
            className={ICON_BUTTON}
          >
            <UndoIcon />
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={future.length === 0}
            aria-label="Redo"
            title="Redo"
            className={ICON_BUTTON}
          >
            <RedoIcon />
          </button>
          <button
            type="button"
            onClick={() => setConfirmingReset(true)}
            aria-label="Reset to defaults"
            title="Reset to defaults"
            className={`${ICON_BUTTON} hover:border-red-400 hover:text-red-300`}
          >
            <ResetIcon />
          </button>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAppTheme(appTheme === "dark" ? "light" : "dark")}
            aria-label={`Switch to ${appTheme === "dark" ? "light" : "dark"} theme`}
            title={`Switch to ${appTheme === "dark" ? "light" : "dark"} theme`}
            className={ICON_BUTTON}
          >
            {appTheme === "dark" ? <SunIcon /> : <MoonIcon />}
          </button>
          <a
            href="https://github.com/nicklambourne/starship-prompt-builder"
            aria-label="View this project on GitHub"
            title="View this project on GitHub"
            className={ICON_BUTTON}
          >
            <GitHubIcon />
          </a>
          <button
            type="button"
            onClick={share}
            aria-label={shareCopied ? "Share link copied" : "Copy a share link"}
            title={shareCopied ? "Link copied" : "Copy a share link"}
            className={`${ICON_BUTTON} ${shareCopied ? "border-emerald-400 text-emerald-300" : ""}`}
          >
            {shareCopied ? <CheckIcon /> : <ShareIcon />}
          </button>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1600px] flex-col gap-4 px-4 pt-4">
        <Explainer />

        {/*
          Full width, above the columns: the prompt is a single long line, and
          in a half-width column it wrapped for anyone with more than a couple
          of modules turned on.
        */}
        {/*
          Hand-built rather than a <details>, for the same reason as the TOML
          card below: the download button belongs on the header row, and a
          control inside a <summary> is a control inside a control.
        */}
        <section
          data-section="preview"
          data-open={previewOpen ? "" : undefined}
          className={CARD}
        >
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-expanded={previewOpen}
              aria-controls="preview-body"
              onClick={() => setPreviewOpen((open) => !open)}
              className="flex min-w-0 flex-1 items-center gap-3 text-left"
            >
              <span className="text-sm font-semibold text-neutral-100">Preview</span>
            </button>

            {/*
              The same download as the TOML card's, at the top of the page
              where the prompt being downloaded is on screen. Icon only: the
              header is a title and two controls, and a second "Download
              config" would say the same thing twice on one screen.
            */}
            <button
              type="button"
              onClick={downloadConfig}
              aria-label="Download config"
              title="Download config"
              className="inline-flex shrink-0 cursor-pointer items-center rounded bg-emerald-700 p-1.5 text-on-solid transition hover:bg-emerald-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
            >
              <DownloadIcon />
            </button>

            {/* Decoration that happens to be clickable — see the TOML card. */}
            <span
              aria-hidden="true"
              onClick={() => setPreviewOpen((open) => !open)}
              className="shrink-0 cursor-pointer text-neutral-500"
            >
              <ChevronIcon
                className={`transition-transform ${previewOpen ? "rotate-90" : ""}`}
              />
            </span>
          </div>

          {previewOpen ? (
            <div id="preview-body" className="mt-3">
              <PreviewPane
                lines={rendered.lines}
                right={rendered.right}
                leadingNewline={rendered.leadingNewline}
                warnings={rendered.warnings}
                themeId={themeId}
                onThemeChange={setTheme}
                fontId={fontId}
                onFontChange={setFont}
                fontSize={fontSize}
                onFontSizeChange={setFontSize}
                theme={theme}
                fontStack={font.stack}
              />
            </div>
          ) : null}
        </section>
      </div>

      <div className="mx-auto grid max-w-[1600px] gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(460px,1.15fr)] lg:items-start">
        {/* Left column: everything that changes the prompt. */}
        <div className="flex min-w-0 flex-col gap-4">
          <details open data-section="format" className={CARD}>
            <summary className="section-summary flex flex-wrap items-center gap-2">
              <span id="format-heading" className="text-sm font-semibold text-neutral-100">
                Prompt format
              </span>
              <ChevronIcon className="section-chevron text-neutral-500" />
            </summary>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              {/* A preset replaces the whole format, so it starts this section. */}
              <div className="ml-auto flex items-center gap-2">
                <label htmlFor="preset-select" className="text-xs text-neutral-400">
                  Start from
                </label>
                <select
                  id="preset-select"
                  defaultValue=""
                  onChange={(event) => {
                    loadPreset(event.target.value);
                    event.target.value = "";
                  }}
                  className="rounded border border-white/10 bg-neutral-950 px-2 py-1 text-base text-neutral-200 focus:border-accent-400 focus:outline-none"
                >
                  <option value="" disabled>
                    a preset…
                  </option>
                  {PRESETS.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p className="mb-3 text-xs text-neutral-500">
              What the prompt contains, and in what order. Reorder, remove, recolour,
              or add pieces here. Drag the handles to reorder; group a run of
              related modules so they share one style.
            </p>
            <FormatBuilder
              value={format}
              onChange={(next) => setRootOption("format", next)}
              vocabulary={moduleVocabulary}
              palette={palette}
              paletteNames={paletteNames}
        inUseColors={inUseTokens}
              allowCategoryGrouping
              scope="root-format"
              theme={theme}
              fontStack={font.stack}
              modules={moduleControls}
              searchable
            />

            <h3 className="mb-2 mt-5 text-sm font-semibold text-neutral-100">
              Right prompt
            </h3>
            <p className="mb-2 text-xs text-neutral-500">
              Rendered flush against the right edge. Not supported by every shell.
            </p>
            <FormatBuilder
              value={rightFormat}
              onChange={(next) => setRootOption("right_format", next)}
              vocabulary={moduleVocabulary}
              palette={palette}
              paletteNames={paletteNames}
        inUseColors={inUseTokens}
              scope="right-format"
              theme={theme}
              fontStack={font.stack}
              modules={moduleControls}
            />

            <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/5 pt-3">
              <span className="text-sm text-neutral-300">
                Blank line before each prompt
                <span className="block text-xs text-neutral-500">add_newline</span>
              </span>
              <Toggle
                label="Blank line before each prompt"
                checked={config.add_newline !== false}
                onChange={(next) => setRootOption("add_newline", next)}
              />
            </div>

            <details className="mt-3">
              <summary className="cursor-pointer text-xs text-neutral-500 hover:text-neutral-300">
                Other prompt-wide options
              </summary>
              <div className="mt-1">
                <SettingsForm
                  options={ROOT_OPTIONS}
                  values={config as Record<string, unknown>}
                  onChange={(key, value) => setRootOption(key, value)}
                  onReset={(key) => setRootOption(key, undefined)}
                  formatVariables={moduleVocabulary}
                  palette={palette}
                  paletteNames={paletteNames}
        inUseColors={inUseTokens}
                  theme={theme}
                  fontStack={font.stack}
                />
              </div>
            </details>
          </details>

        </div>

        {/*
          The result. Sticky beside the controls on desktop; ordered FIRST when
          the grid collapses to one column, because a preview sitting below a
          102-module list is a preview nobody sees while editing.
        */}
        {/*
          No longer hoisted on a phone: that existed to lift the preview above
          a 102-module list, and the preview now sits above both columns. The
          editor is what you came to use, so it comes first.
        */}
        <div className="flex min-w-0 flex-col gap-4">
          {/*
            Open by default: it decides which modules appear at all, so a
            module that renders nothing has its explanation one glance away.
            Its own sections stay closed — all of them open at once is a wall.
          */}
          <details open data-section="environment" className={CARD}>
            <summary className="section-summary flex items-center gap-3">
              <span className="text-sm font-semibold text-neutral-100">
                Simulated environment
              </span>
              <ChevronIcon className="section-chevron text-neutral-500" />
            </summary>
            <p className="mb-3 mt-2 text-xs text-neutral-500">
              What the shell would report about this machine and directory.
              It decides which modules appear at all — a language module only
              shows up when its tool and a matching file are both here.
            </p>
            <EnvironmentPanel scenario={scenario} onChange={updateScenario} />
          </details>

          {/*
            Between the environment and the output, because it is neither: the
            environment decides what appears, the palette decides what it looks
            like, and the TOML is what both produce. Closed by default — a
            prompt can be built without ever naming a colour.
          */}
          <details data-section="palettes" className={CARD}>
            <summary className="section-summary flex items-center gap-3">
              <span className="text-sm font-semibold text-neutral-100">Palette</span>
              <span className="hidden text-xs text-neutral-500 sm:inline">
                name colours once, use them everywhere
              </span>
              <ChevronIcon className="section-chevron text-neutral-500" />
            </summary>
            <div className="mt-3">
              <PaletteEditor
                palettes={(config.palettes ?? {}) as Record<string, Record<string, string>>}
                active={config.palette ?? null}
                onChange={(palettes) => setRootOption("palettes", palettes)}
                onActivate={(name) => setRootOption("palette", name ?? undefined)}
                inUse={inUse}
                theme={theme}
              />
            </div>
          </details>

          {/*
            The TOML is the output, not an input, so it stays closed — but the
            download is the reason most people came, so it lives in the header
            bar and works without opening anything.
          */}
          {/*
            A disclosure built by hand rather than a <details>, for one
            reason: the download button belongs on the header row, and a
            control inside a <summary> is a control inside a control —
            ambiguous to a screen reader, out of order for a keyboard. A
            <details> gives its non-summary children to a hidden slot, so the
            button cannot live beside the summary either. A button and a
            region, wired together, have neither problem.
          */}
          <section
            data-section="toml"
            data-open={tomlOpen ? "" : undefined}
            className={CARD}
          >
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-expanded={tomlOpen}
                aria-controls="toml-body"
                onClick={() => setTomlOpen((open) => !open)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <span className="text-sm font-semibold text-neutral-100">
                  starship.toml
                </span>
                {/* The bar is tight on a phone; the button matters more. */}
                <span className="hidden text-xs text-neutral-500 sm:inline">
                  view or paste a config
                </span>
              </button>

              <button
                type="button"
                onClick={downloadConfig}
                className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded bg-emerald-700 px-2.5 py-1.5 text-xs font-medium text-on-solid transition hover:bg-emerald-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
              >
                <DownloadIcon />
                {/* On a phone the icon carries it; the name stays as the
                    accessible label. */}
                <span className="hidden sm:inline">Download config</span>
                <span className="sr-only sm:hidden">Download config</span>
              </button>

              {/*
                The chevron trails the download button, where it has always
                been. It is decoration that happens to be clickable — the
                labelled control to its left is the one keyboards and screen
                readers use, so this stays out of the accessibility tree
                rather than becoming a second, unnamed way to do the same
                thing.
              */}
              <span
                aria-hidden="true"
                onClick={() => setTomlOpen((open) => !open)}
                className="shrink-0 cursor-pointer text-neutral-500"
              >
                <ChevronIcon
                  className={`transition-transform ${tomlOpen ? "rotate-90" : ""}`}
                />
              </span>
            </div>

            {tomlOpen ? (
              <div id="toml-body">
                <div className="mt-3">
                  <TomlPane
                    config={{ ...config, format }}
                    onConfigChange={setConfig}
                    defaults={defaultsByModule}
                  />
                </div>

                <UsageGuide
                  shell={scenario.shell}
                  className="col-span-2 mt-5 border-t border-white/10 pt-4"
                />
              </div>
            ) : null}
          </section>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}
