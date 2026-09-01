"use client";

/**
 * The builder.
 *
 * One page, no tabs: the prompt preview stays pinned while everything that can
 * change it — the format, the modules, the TOML — scrolls beneath it. Splitting
 * these across tabs meant a change and its effect were never on screen
 * together, which is the whole point of a live configurator.
 */

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";

import { EnvironmentPanel } from "./EnvironmentPanel";
import { Explainer } from "./Explainer";
import { PaletteEditor } from "./PaletteEditor";
import { FormatBuilder } from "./FormatBuilder";
import { NamedModuleActions } from "./NamedModuleActions";
import { PresetPicker } from "./PresetPicker";
import { PreviewPane } from "./PreviewPane";
import { SiteFooter } from "./SiteFooter";
import { SettingsForm, type OptionDescriptor } from "./SettingsForm";
import { TomlPane } from "./TomlPane";
import { UsageGuide } from "./UsageGuide";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Toggle } from "@/components/ui/Toggle";
import { SiteHeader } from "@/components/site/SiteHeader";
import {
  HeaderActions,
  HEADER_ICON_BUTTON as ICON_BUTTON,
} from "@/components/site/HeaderActions";
import {
  ChevronIcon,
  DownloadIcon,
  RedoIcon,
  ResetIcon,
  UndoIcon,
} from "@/components/ui/icons";
import {
  moduleDefinitionsForConfig,
  moduleOptionsForConfig,
  namedModuleIdentity,
  type NamedModuleKind,
} from "@/lib/engine/modules";
import { PROMPT_ORDER } from "@/lib/engine/promptOrder";
import { DEFAULT_FORMAT, isModuleDisabled, renderPrompt } from "@/lib/engine/prompt";
import { collectVariables, tryParseFormatString } from "@/lib/engine/formatString";
import { resolvePalette } from "@/lib/engine/styleString";
import { expandAll, structuredFormatString } from "@/lib/config/defaultFormat";
import { colorsInUse } from "@/lib/config/colorsInUse";
import { styleOptionFallback, styleRulesFor } from "@/lib/config/styleOptions";
import { moduleFormatStyles } from "@/lib/config/formatStyles";
import { moduleFormatVariables } from "@/lib/config/formatVisibility";
import { withStyleVariable } from "@/lib/config/formatItems";
import { inactiveReason } from "@/lib/config/inactiveReason";
import {
  addNamedModule,
  namedModuleReferenceCount,
  removeNamedModule as removeNamedModuleConfig,
  renameNamedModule,
} from "@/lib/config/namedModules";
import { optionDoc } from "@/lib/config/options";
import { describeVariable, variableDoc } from "@/lib/config/variables";
import { describeModule } from "@/lib/config/descriptions";
import { optionEnum } from "@/lib/config/optionEnums";
import { moduleStyleReaches, rowStyleReaches } from "@/lib/config/styleReach";
import { MODULE_META, moduleMeta, optionKind } from "@/lib/config/meta";
import { PRESETS } from "@/lib/config/presets";
import { encodeShare } from "@/lib/config/share";
import { parseConfig, serialiseConfig } from "@/lib/config/toml";
import { MODULE_DEFAULTS } from "@/lib/config/rescue";
import { structuredEditorFor } from "./structuredOptions";
import { CustomPreviewControls } from "./CustomPreviewControls";
import { selectedVcsFormat } from "@/lib/engine/modules/vcs";
import { TERMINAL_FONTS } from "@/lib/fonts";
import { NAMED_COLORS } from "@/lib/engine/types";
import { getTheme } from "@/lib/terminalThemes";
import { useBuilderStore } from "@/state/builderStore";
import { useBuilderSession } from "./useBuilderSession";

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
  {
    key: "follow_symlinks",
    kind: "boolean",
    defaultValue: true,
    description: "Follow symbolic links while scanning the current directory.",
  },
];

const CARD = "rounded-xl border border-white/10 bg-neutral-900/40 p-4";

export function Builder() {
  const {
    config,
    scenario,
    themeId,
    fontId,
    fontSize,
    setConfig,
    updateModuleOption,
    resetModuleOption,
    setModuleDisabled,
    setRootOption,
    updateScenario,
    setTheme,
    setFont,
    setFontSize,
    appTheme,
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

  useBuilderSession({
    config,
    scenario,
    themeId,
    fontId,
    fontSize,
    appTheme,
    appThemeIsExplicit,
    loadShared,
    restoreSession,
  });

  const [confirmingReset, setConfirmingReset] = useState(false);

  const theme = getTheme(themeId);
  const font = TERMINAL_FONTS.find((f) => f.id === fontId) ?? TERMINAL_FONTS[0];
  const palette = resolvePalette(config.palettes, config.palette);
  const paletteNames = useMemo(
    () => Object.keys(config.palettes?.[config.palette ?? ""] ?? {}),
    [config.palettes, config.palette],
  );
  const moduleDefinitions = useMemo(() => moduleDefinitionsForConfig(config), [config]);
  const modulesByName = useMemo(
    () => new Map(moduleDefinitions.map((definition) => [definition.name, definition])),
    [moduleDefinitions],
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
        modules: moduleDefinitions,
        defaultOrder: PROMPT_ORDER,
      }),
    [config, format, scenario, moduleDefinitions],
  );



  const rightFormat = typeof config.right_format === "string" ? config.right_format : "";

  /** Module names available to the root format. */
  const moduleVocabulary = useMemo(
    () => ["all", ...moduleDefinitions.map((m) => m.name)],
    [moduleDefinitions],
  );

  /**
   * Whether the row's swatch is this module's `style` option: it is, for every
   * module that has one. The swatch replaces the option rather than standing
   * beside it, so it is available on the same terms the option was — always,
   * whatever the module's format happens to spend.
   */
  const rowOwnsStyle = useCallback(
    (name: string) => typeof modulesByName.get(name)?.defaults.style === "string",
    [modulesByName],
  );

  /**
   * A module's `style` option as a control: its value, whether the format
   * still spends it, and how to set it. The row's swatch and the pieces its
   * own format paints with `$style` are the same option, so they are the same
   * object here.
   */
  const ownStyleFor = useCallback(
    (name: string) => {
      const definition = modulesByName.get(name);
      if (!definition || typeof definition.defaults.style !== "string") return null;
      const options = moduleOptionsForConfig(config, name);
      const set = typeof options.style === "string" ? options.style : null;
      const format = options.format ?? definition.defaults.format;
      const spent = typeof format === "string" ? moduleStyleReaches(format) : true;
      return {
        value: set ?? definition.defaults.style,
        isDefault: set === null,
        defaultValue: definition.defaults.style,
        // `$style` is what spends this option. A format that has lost it
        // still takes a value; it just will not show one.
        spent,
        /** The format putting it back would write, for the control to name. */
        restoreTo:
          spent || typeof format !== "string" ? null : withStyleVariable(format),
        set(value: string | undefined) {
          if (value === undefined) resetModuleOption(name, "style");
          else updateModuleOption(name, "style", value);
        },
      };
    },
    [config, modulesByName, resetModuleOption, updateModuleOption],
  );

  /** An option an edit elsewhere has just written, for its row to open on. */
  const [revealed, setRevealed] = useState<{
    module: string;
    key: string;
    nonce: number;
  } | null>(null);

  const optionsFor = useCallback((name: string): OptionDescriptor[] => {
    const definition = modulesByName.get(name);
    if (!definition) return [];
    const meta = moduleMeta(name);
    const values = moduleOptionsForConfig(config, name);
    return Object.entries(definition.defaults)
      // `disabled` is the switch on the row, and `style` is usually the swatch
      // beside it: both are settings, but the row is where people look.
      .filter(([key]) => key !== "disabled" && !(key === "style" && rowOwnsStyle(name)))
      .map(([key, defaultValue]) => {
        const documentation = optionDoc(name, key);
        const enumeration = optionEnum(name, key);
        return {
          key,
          kind: enumeration ? "enum" : optionKind(name, key, defaultValue, meta),
          defaultValue,
          description: documentation?.description,
          descriptionLinks: documentation?.links,
          enumValues: enumeration?.choices,
          enumUnsetLabel: enumeration?.unsetLabel,
          styleFallback: styleOptionFallback(
            definition.defaults,
            values,
            key,
          ),
          styleRules: styleRulesFor(
            name, key, definition.defaults,
            values,
          ),
          structuredEditor: structuredEditorFor(name, key),
        };
      });
  }, [rowOwnsStyle, config, modulesByName]);

  /** Variables a module's own format strings may reference. */
  const variablesFor = useCallback(
    (name: string) => {
      const definition = modulesByName.get(name);
      if (!definition) return [];
      if (name === "vcs") return moduleVocabulary.filter((module) => module !== "all" && module !== "vcs");
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
      const parsed = typeof definition.defaults.format === "string"
        ? tryParseFormatString(definition.defaults.format)
        : { ok: false as const, error: "This module has no single format option." };
      const fromFormat = parsed.ok ? collectVariables(parsed.elements) : [];
      return [...new Set([...fromEvaluate, ...fromFormat])].sort();
    },
    [scenario, config, modulesByName, moduleVocabulary],
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
    for (const definition of moduleDefinitions) {
      const options = {
        ...definition.defaults,
        ...moduleOptionsForConfig(config, definition.name),
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
  }, [config, scenario, moduleDefinitions]);

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
    if (inFormat.has("vcs")) {
      const definition = modulesByName.get("vcs");
      const selected = definition
        ? selectedVcsFormat({ ...definition.defaults, ...moduleOptionsForConfig(config, "vcs") }, scenario)
        : undefined;
      const parsedVcs = selected ? tryParseFormatString(selected) : undefined;
      if (parsedVcs?.ok) collectVariables(parsedVcs.elements).forEach((name) => inFormat.add(name));
    }
    return colorsInUse(config, {
      renders: (name) => {
        const identity = namedModuleIdentity(name);
        if (!inFormat.has(name) && !(identity && inFormat.has(identity.kind))) return false;
        const definition = modulesByName.get(name);
        if (!definition || isModuleDisabled(config, definition)) return false;
        return !inactiveNotes.has(name);
      },
    });
  }, [config, format, inactiveNotes, modulesByName, scenario]);

  /** Just the tokens, for the style pickers' own row. */
  const inUseTokens = useMemo(() => inUse.map((colour) => colour.token), [inUse]);

  const moduleControls = useMemo(
    () => ({
      isEnabled(name: string) {
        const options = moduleOptionsForConfig(config, name);
        const disabled =
          typeof options.disabled === "boolean"
            ? options.disabled
            : (modulesByName.get(name)?.defaults.disabled ?? false);
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
        const options = moduleOptionsForConfig(config, name);
        const format = options.format ?? modulesByName.get(name)?.defaults.format;
        return typeof format === "string" ? rowStyleReaches(format) : true;
      },
      /*
       * A module's own style is the one that shows — a style written around
       * `$module` in the prompt format only paints what the module emits
       * unstyled, which for most of them is nothing. So the row's swatch edits
       * the option, and the option leaves the list below.
       */
      styleOption(name: string) {
        return ownStyleFor(name);
      },
      setStyleOption(name: string, value: string | undefined) {
        ownStyleFor(name)?.set(value);
      },
      /*
       * The one edit that makes the option worth setting again, offered where
       * the format has stopped spending it. Written to the format like any
       * other change — visible in the TOML, and undoable — rather than being
       * put back behind the reader's back.
       */
      restoreStyleVariable(name: string) {
        const definition = modulesByName.get(name);
        const options = moduleOptionsForConfig(config, name);
        const format = options.format ?? definition?.defaults.format;
        if (typeof format !== "string") return;
        const next = withStyleVariable(format);
        // Landing back on the module's own default is a reset, not a setting
        // equal to it: an override the TOML does not print is one the options
        // list should not mark either.
        if (next === definition?.defaults.format) resetModuleOption(name, "format");
        else updateModuleOption(name, "format", next);
        // The edit lands in an option, so the option is where it is shown.
        setRevealed((previous) => ({
          module: name,
          key: "format",
          nonce: (previous?.nonce ?? 0) + 1,
        }));
      },
      setEnabled(name: string, enabled: boolean) {
        setModuleDisabled(name, !enabled);
      },
      renderSettings(name: string) {
        return renderSettings(name);
      },
      namedModuleReferences(name: string) {
        return namedModuleReferenceCount(config, name);
      },
      removeNamedModule(name: string) {
        setConfig(removeNamedModuleConfig(config, name));
      },
    }),
    // renderSettings is redefined whenever the config changes, which is also
    // exactly when enablement can change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      config,
      inactiveNotes,
      modulesByName,
      setModuleDisabled,
      rowOwnsStyle,
      ownStyleFor,
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
      const definition = modulesByName.get(name);
      if (!definition || optionsFor(name).length === 0) return null;
      const identity = namedModuleIdentity(name);
      const family = identity ? config[identity.kind] : undefined;
      const existing =
        family && typeof family === "object" && !Array.isArray(family)
          ? Object.keys(family)
          : [];
      return (
        <>
          {identity ? (
            <NamedModuleActions
              key={name}
              kind={identity.kind}
              instance={identity.instance}
              existing={existing}
              onRename={(nextInstance) =>
                setConfig(renameNamedModule(config, name, nextInstance))
              }
            />
          ) : null}
          {identity?.kind === "custom" ? (
            <CustomPreviewControls
              instance={identity.instance}
              when={moduleOptionsForConfig(config, name).when ?? definition.defaults.when}
              value={scenario.custom?.[identity.instance]}
              onChange={(next) => updateScenario({
                custom: { ...scenario.custom, [identity.instance]: next },
              })}
            />
          ) : null}
          <SettingsForm
            options={optionsFor(name)}
            values={moduleOptionsForConfig(config, name)}
            onChange={(key, value) => updateModuleOption(name, key, value)}
            onReset={(key) => resetModuleOption(name, key)}
            formatVariables={variablesFor(name)}
            describeVariable={(variable) => name === "vcs" ? describeModule(variable) : describeVariable(name, variable)}
            describeVariableLinks={(variable) => variableDoc(name, variable)?.links}
            palette={palette}
            paletteNames={paletteNames}
            inUseColors={inUseTokens}
            ownStyle={ownStyleFor(name) ?? undefined}
            styleVariables={moduleFormatStyles(definition, config, scenario)}
            variables={moduleFormatVariables(definition, config, scenario)}
            reveal={
              revealed?.module === name
                ? { key: revealed.key, nonce: revealed.nonce }
                : undefined
            }
            theme={theme}
            fontStack={font.stack}
          />
        </>
      );
    },
    [
      config,
      modulesByName,
      optionsFor,
      ownStyleFor,
      scenario,
      revealed,
      variablesFor,
      updateModuleOption,
      resetModuleOption,
      palette,
      paletteNames,
      inUseTokens,
      theme,
      font.stack,
      setConfig,
      updateScenario,
    ],
  );

  const createNamedModule = useCallback(
    (kind: NamedModuleKind, instance: string) => {
      setConfig(addNamedModule(config, kind, instance, format));
    },
    [config, format, setConfig],
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

  const share = useCallback(() => {
    // A share can beat the session effect's debounce, so the current config is
    // encoded here rather than returning a URL that is a quarter second old.
    const fragment = encodeShare(config);
    const url = `${window.location.origin}${window.location.pathname}#${fragment}`;
    window.history.replaceState(null, "", `#${fragment}`);
    return url;
  }, [config]);

  const loadPreset = useCallback(
    (id: string) => {
      const preset = PRESETS.find((p) => p.id === id);
      if (!preset) return;
      const result = parseConfig(preset.toml);
      if (!result.ok) return;
      setConfig(result.config);
      if (preset.environment) updateScenario(preset.environment);
    },
    [setConfig, updateScenario],
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
      <SiteHeader>
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

        <HeaderActions getShareUrl={share} />
      </SiteHeader>

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
                terminalWidth={scenario.terminalWidth}
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
                <PresetPicker onPick={loadPreset} />
              </div>
            </div>
            <p className="mb-3 text-xs text-neutral-500">
              What the prompt contains, and in what order. Reorder, remove, recolour,
              or add pieces here. Drag the handles to reorder; group a run of
              related modules so they share one style.
            </p>
            <p className="mb-3 flex flex-wrap gap-x-3 gap-y-1 text-xs">
              <Link
                href="/guides/format-strings"
                className="text-accent-300 underline underline-offset-2 hover:text-accent-200"
              >
                Format string guide
              </Link>
              <Link
                href="/guides/style-strings"
                className="text-accent-300 underline underline-offset-2 hover:text-accent-200"
              >
                Style string guide
              </Link>
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
              createNamedModule={createNamedModule}
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
                <p className="mb-3 text-xs text-neutral-500">
                  Bringing an existing file?{" "}
                  <Link
                    href="/guides/import-existing-config"
                    className="text-accent-300 underline underline-offset-2 hover:text-accent-200"
                  >
                    Read the import guide
                  </Link>
                  .
                </p>
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
