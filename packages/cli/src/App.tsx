import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { readFile } from "node:fs/promises";
import { Box, useApp, useInput, useStdin, useStdout } from "ink";
import { Text } from "./safeText";
import { TextInput } from "./TextInput";

import { expandPath, hashContent, loadConfig, type LoadedConfig } from "./configFile";
import { saveReviewDecision, saveReviewedDocument } from "./saveReview";
import { changedPaths, reviewLines } from "./documentReview";
import { loadWorkspace, saveWorkspace } from "./workspaceFile";
import { loadDraft, removeDraft, saveDraft, type Draft } from "./draftFile";
import { editConfigExternally } from "./externalEditor";
import {
  changeConfig,
  createTimeline,
  displayValue,
  isDirty,
  markSaved,
  optionsForModule,
  parseEditedValue,
  redoConfig,
  undoConfig,
  type CliOption,
} from "./model";
import {
  dissolveGroup,
  duplicateItem,
  flattenFormat,
  formatItems,
  indentItem,
  moveSibling,
  outdentItem,
  setFormatItems,
  wrapInGroup,
  type FormatSide,
} from "./formatEditor";
import { PromptPreview } from "./Preview";
import { addValue, initialArrayEntry, parseScalarLike, removeValue, renameValue, updateValue, valueAt, valueRows, type ValuePath } from "./structuredValue";
import { replaceStyleToken, setStyleColor, styleTokens } from "./styleEditor";
import { createPalette, deletePalette, deletePaletteColor, paletteTables, renamePalette, setPaletteColor } from "./palettes";
import { resolveDefaults } from "@/lib/config/defaults";
import { structuredEditorFor } from "@/lib/config/structuredOptions";
import { colorsInUse } from "@/lib/config/colorsInUse";
import { loadGlyphs, searchGlyphs, type Glyph, type GlyphCatalogue } from "@/lib/config/glyphs";
import { applyPaletteSwitch, planPaletteSwitch } from "@/lib/config/paletteSwitch";
import { itemLabel, itemToSource, type FormatItem } from "@/lib/config/formatItems";
import { collectModuleNames, getAt, insertAt, pathKey, removeAt, updateAt, type Path } from "@/lib/config/formatTree";
import { withModuleOption, withoutModuleOption, withRootOption } from "@/lib/config/mutations";
import { addNamedModule, duplicateNamedModule, isValidNamedModuleInstance, removeNamedModule, renameNamedModule } from "@/lib/config/namedModules";
import { describeModule } from "@/lib/config/descriptions";
import { getOptionSchema } from "@/lib/config/schema";
import { serialiseConfig } from "@/lib/config/toml";
import { validateConfig } from "@/lib/config/diagnostics";
import { PRESETS } from "@/lib/config/presets";
import { decodeShare, encodeShare } from "@/lib/config/share";
import { parseFormatString } from "@/lib/engine/formatString";
import {
  isModuleDisabled,
  renderPrompt,
  type StarshipConfig,
} from "@/lib/engine/prompt";
import {
  moduleDefinitionsForConfig,
} from "@/lib/engine/modules";
import { PROMPT_ORDER } from "@/lib/engine/promptOrder";
import { DEFAULT_FORMAT } from "@/lib/engine/prompt";
import { namedModuleIdentity, type NamedModuleKind } from "@/lib/engine/modules";
import { getScenario, listScenarios } from "@/lib/scenarios";
import { inactiveReason } from "@/lib/config/inactiveReason";
import { segmentsText } from "@/lib/engine/types";
import { loadScenarioFile, saveScenarioFile } from "./scenarioFile";
import type { Scenario } from "@/lib/scenarios/types";

type View = "format" | "settings" | "structured" | "style" | "glyph" | "palette" | "palette-colors" | "environment" | "environment-structured" | "scenarios" | "compare" | "visibility" | "output" | "share" | "actions" | "add" | "save" | "replace" | "conflict" | "recover" | "help";

type StyleTarget =
  | { kind: "module"; name: string; option: string }
  | { kind: "format"; side: FormatSide; path: Path };

interface EditState {
  id: string;
  label: string;
  initialValue: string;
  suggestions?: string[];
  submit(value: string): void;
}

interface EnvironmentField {
  key: string;
  label: string;
  kind: "string" | "number" | "boolean" | "enum" | "structured";
  choices?: string[];
  get(scenario: Scenario): unknown;
  set(scenario: Scenario, value: unknown): Scenario;
}

const ENVIRONMENT_FIELDS: EnvironmentField[] = [
  { key: "path", label: "Directory", kind: "string", get: (s) => s.path, set: (s, value) => ({ ...s, path: String(value) }) },
  { key: "home", label: "Home directory", kind: "string", get: (s) => s.home, set: (s, value) => ({ ...s, home: String(value) }) },
  { key: "terminalWidth", label: "Prompt width", kind: "number", get: (s) => s.terminalWidth, set: (s, value) => ({ ...s, terminalWidth: Math.max(20, Math.min(500, Math.round(Number(value)))) }) },
  { key: "status", label: "Last exit status", kind: "number", get: (s) => s.status, set: (s, value) => ({ ...s, status: Number(value) }) },
  { key: "cmdDurationMs", label: "Command duration (ms)", kind: "number", get: (s) => s.cmdDurationMs, set: (s, value) => ({ ...s, cmdDurationMs: Math.max(0, Number(value)) }) },
  { key: "username", label: "Username", kind: "string", get: (s) => s.username, set: (s, value) => ({ ...s, username: String(value) }) },
  { key: "hostname", label: "Hostname", kind: "string", get: (s) => s.hostname, set: (s, value) => ({ ...s, hostname: String(value) }) },
  {
    key: "shell",
    label: "Shell",
    kind: "enum",
    choices: ["bash", "zsh", "fish", "powershell", "pwsh", "ion", "elvish", "tcsh", "nu", "xonsh", "cmd"],
    get: (s) => s.shell,
    set: (s, value) => ({ ...s, shell: value as Scenario["shell"] }),
  },
  { key: "ssh", label: "Connected over SSH", kind: "boolean", get: (s) => s.ssh, set: (s, value) => ({ ...s, ssh: Boolean(value) }) },
  { key: "isRoot", label: "Running as root", kind: "boolean", get: (s) => s.isRoot, set: (s, value) => ({ ...s, isRoot: Boolean(value) }) },
  { key: "readOnly", label: "Read-only directory", kind: "boolean", get: (s) => s.readOnly, set: (s, value) => ({ ...s, readOnly: Boolean(value) }) },
  { key: "jobs", label: "Background jobs", kind: "number", get: (s) => s.jobs, set: (s, value) => ({ ...s, jobs: Math.max(0, Number(value)) }) },
  { key: "signal", label: "Last signal", kind: "string", get: (s) => s.signal ?? "", set: (s, value) => ({ ...s, signal: String(value) || undefined }) },
  { key: "time", label: "Fixed preview time", kind: "string", get: (s) => s.time, set: (s, value) => ({ ...s, time: String(value) }) },
  { key: "keymap", label: "Vim keymap", kind: "enum", choices: ["insert", "normal", "visual", "replace", "replace_one"], get: (s) => s.keymap, set: (s, value) => ({ ...s, keymap: value as Scenario["keymap"] }) },
  { key: "shlvl", label: "Shell nesting depth", kind: "number", get: (s) => s.shlvl ?? 1, set: (s, value) => ({ ...s, shlvl: Math.max(0, Number(value)) }) },
  { key: "files", label: "Files and folders", kind: "structured", get: (s) => s.files, set: (s, value) => ({ ...s, files: value as string[] }) },
  { key: "toolVersions", label: "Installed tool versions", kind: "structured", get: (s) => s.toolVersions, set: (s, value) => ({ ...s, toolVersions: value as Scenario["toolVersions"] }) },
  { key: "env", label: "Environment variables", kind: "structured", get: (s) => s.env, set: (s, value) => ({ ...s, env: value as Scenario["env"] }) },
  { key: "git", label: "Git state", kind: "structured", get: (s) => s.git ?? getScenario("dirty-repo").git, set: (s, value) => ({ ...s, git: value as Scenario["git"] }) },
  { key: "aws", label: "AWS context", kind: "structured", get: (s) => s.aws ?? { profile: "", region: "" }, set: (s, value) => ({ ...s, aws: value as Scenario["aws"] }) },
  { key: "gcloud", label: "Google Cloud context", kind: "structured", get: (s) => s.gcloud ?? { project: "", region: "" }, set: (s, value) => ({ ...s, gcloud: value as Scenario["gcloud"] }) },
  { key: "azure", label: "Azure context", kind: "structured", get: (s) => s.azure ?? { subscription: "", username: "" }, set: (s, value) => ({ ...s, azure: value as Scenario["azure"] }) },
  { key: "kubernetes", label: "Kubernetes context", kind: "structured", get: (s) => s.kubernetes ?? { context: "", namespace: "" }, set: (s, value) => ({ ...s, kubernetes: value as Scenario["kubernetes"] }) },
  { key: "terraform", label: "Terraform workspace", kind: "structured", get: (s) => s.terraform ?? { workspace: "" }, set: (s, value) => ({ ...s, terraform: value as Scenario["terraform"] }) },
  { key: "nix", label: "Nix shell", kind: "structured", get: (s) => s.nix ?? { name: "", impure: false }, set: (s, value) => ({ ...s, nix: value as Scenario["nix"] }) },
  { key: "conda", label: "Conda environment", kind: "structured", get: (s) => s.conda ?? { environment: "" }, set: (s, value) => ({ ...s, conda: value as Scenario["conda"] }) },
  { key: "python", label: "Python virtualenv", kind: "structured", get: (s) => s.python ?? { virtualenv: "" }, set: (s, value) => ({ ...s, python: value as Scenario["python"] }) },
  { key: "container", label: "Container", kind: "structured", get: (s) => s.container ?? { name: "" }, set: (s, value) => ({ ...s, container: value as Scenario["container"] }) },
  { key: "docker", label: "Docker context", kind: "structured", get: (s) => s.docker ?? { context: "" }, set: (s, value) => ({ ...s, docker: value as Scenario["docker"] }) },
  { key: "battery", label: "Battery", kind: "structured", get: (s) => s.battery ?? { percentage: 50, status: "discharging" }, set: (s, value) => ({ ...s, battery: value as Scenario["battery"] }) },
  { key: "os", label: "Operating system", kind: "structured", get: (s) => s.os ?? { name: "Linux", type: "Linux" }, set: (s, value) => ({ ...s, os: value as Scenario["os"] }) },
  { key: "nats", label: "NATS context", kind: "structured", get: (s) => s.nats ?? { name: "" }, set: (s, value) => ({ ...s, nats: value as Scenario["nats"] }) },
  { key: "netns", label: "Network namespace", kind: "structured", get: (s) => s.netns ?? { name: "" }, set: (s, value) => ({ ...s, netns: value as Scenario["netns"] }) },
  { key: "direnv", label: "direnv status", kind: "structured", get: (s) => s.direnv ?? { loaded: false, allowed: "allowed" }, set: (s, value) => ({ ...s, direnv: value as Scenario["direnv"] }) },
  { key: "hgState", label: "Mercurial operation", kind: "string", get: (s) => s.hgState ?? "", set: (s, value) => ({ ...s, hgState: String(value) as Scenario["hgState"] }) },
  { key: "custom", label: "Simulated custom output", kind: "structured", get: (s) => s.custom ?? {}, set: (s, value) => ({ ...s, custom: value as Scenario["custom"] }) },
  {
    key: "branch",
    label: "Git branch",
    kind: "string",
    get: (s) => s.git?.branch ?? "",
    set: (s, value) => s.git ? { ...s, git: { ...s.git, branch: String(value) } } : s,
  },
];

const OPTIONAL_ENVIRONMENT_CONTEXTS = new Set([
  "git", "aws", "gcloud", "azure", "kubernetes", "terraform", "nix", "conda", "python",
  "container", "docker", "battery", "os", "nats", "netns", "direnv", "custom",
]);

function useDimensions(columnsOverride?: number, rowsOverride?: number) {
  const { stdout } = useStdout();
  const [dimensions, setDimensions] = useState(() => ({
    columns: stdout.columns ?? 100,
    rows: stdout.rows ?? 32,
  }));

  useEffect(() => {
    const resize = () => setDimensions({
      columns: stdout.columns ?? 100,
      rows: stdout.rows ?? 32,
    });
    stdout.on("resize", resize);
    return () => { stdout.off("resize", resize); };
  }, [stdout]);

  return {
    columns: columnsOverride ?? dimensions.columns,
    rows: rowsOverride ?? dimensions.rows,
  };
}

function clampSelection(index: number, length: number): number {
  return Math.max(0, Math.min(index, Math.max(0, length - 1)));
}

function visibleWindow<T>(items: T[], selected: number, height: number): { items: T[]; start: number } {
  const size = Math.max(1, height);
  const start = Math.max(0, Math.min(selected - Math.floor(size / 2), items.length - size));
  return { items: items.slice(start, start + size), start };
}

function Panel({
  title,
  hint,
  children,
  width,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  width?: number | string;
}) {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="gray" width={width} minWidth={0}>
      <Box paddingX={1} justifyContent="space-between">
        <Text bold color="cyan">{title}</Text>
        {hint ? <Text dimColor>{hint}</Text> : null}
      </Box>
      {children}
    </Box>
  );
}

function Row({
  selected,
  marker,
  label,
  value,
  muted,
}: {
  selected: boolean;
  marker?: string;
  label: string;
  value?: string;
  muted?: boolean;
}) {
  return (
    <Box paddingX={1} backgroundColor={selected ? "ansi256(236)" : undefined}>
      <Text color={selected ? "yellow" : muted ? "gray" : undefined} wrap="truncate-end">
        {selected ? "›" : " "} {marker ?? " "} {label}
      </Text>
      <Box flexGrow={1} />
      {value ? <Text dimColor wrap="truncate-start">{value}</Text> : null}
    </Box>
  );
}

function InputBar({ edit }: { edit: EditState }) {
  return (
    <Box borderStyle="single" borderColor="yellow" paddingX={1}>
      <Text color="yellow">{edit.label}: </Text>
      <TextInput
        key={edit.id}
        defaultValue={edit.initialValue}
        suggestions={edit.suggestions}
        onSubmit={edit.submit}
      />
      <Text dimColor>  Enter apply · Esc cancel</Text>
    </Box>
  );
}

function formatItemModule(item: FormatItem | undefined): string | null {
  return item?.kind === "module" ? item.name : null;
}

function inputValue(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value) ?? "";
}

export interface BuilderAppProps {
  loaded: LoadedConfig;
  scenarioId?: string;
  color?: boolean;
  columns?: number;
  rows?: number;
}

export function BuilderApp({
  loaded,
  scenarioId = "dirty-repo",
  color = true,
  columns: columnsOverride,
  rows: rowsOverride,
}: BuilderAppProps) {
  const { exit } = useApp();
  const { setRawMode, isRawModeSupported } = useStdin();
  const { columns, rows } = useDimensions(columnsOverride, rowsOverride);
  const [timeline, setTimeline] = useState(() => createTimeline(loaded.config, loaded.source === "file"));
  const [scenario, setScenario] = useState(() => getScenario(scenarioId));
  const [view, setView] = useState<View>("format");
  const viewRef = useRef(view);
  useLayoutEffect(() => {
    viewRef.current = view;
  }, [view]);
  const [previousView, setPreviousView] = useState<View>("format");
  const [formatSide, setFormatSide] = useState<FormatSide>("left");
  const formatSideRef = useRef<FormatSide>("left");
  useLayoutEffect(() => { formatSideRef.current = formatSide; }, [formatSide]);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [formatSelection, setFormatSelection] = useState(0);
  const [settingsSelection, setSettingsSelection] = useState(0);
  const [structuredPath, setStructuredPath] = useState<ValuePath>([]);
  const [structuredSelection, setStructuredSelection] = useState(0);
  const [styleTarget, setStyleTarget] = useState<StyleTarget | null>(null);
  const [styleSelection, setStyleSelection] = useState(0);
  const [paletteSelection, setPaletteSelection] = useState(0);
  const [paletteColorSelection, setPaletteColorSelection] = useState(0);
  const [paletteName, setPaletteName] = useState("");
  const [glyphCatalogue, setGlyphCatalogue] = useState<GlyphCatalogue | null>(null);
  const [glyphTarget, setGlyphTarget] = useState<{ module: string; option: string } | null>(null);
  const [glyphSelection, setGlyphSelection] = useState(0);
  const [recentGlyphs, setRecentGlyphs] = useState<string[]>([]);
  const [environmentSelection, setEnvironmentSelection] = useState(0);
  const [environmentPath, setEnvironmentPath] = useState<ValuePath>([]);
  const [environmentEntrySelection, setEnvironmentEntrySelection] = useState(0);
  const [scenarioSelection, setScenarioSelection] = useState(0);
  const [compareSelection, setCompareSelection] = useState(0);
  const [compareSelected, setCompareSelected] = useState<Set<string>>(() => new Set(listScenarios().map((candidate) => candidate.id)));
  const [visibilitySelection, setVisibilitySelection] = useState(0);
  const [addSelection, setAddSelection] = useState(0);
  const [actionSelection, setActionSelection] = useState(0);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [moving, setMoving] = useState<{ items: FormatItem[]; path: Path } | null>(null);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [fullToml, setFullToml] = useState(false);
  const [outputScroll, setOutputScroll] = useState(0);
  const [message, setMessage] = useState(loaded.source === "preset" ? `Started from ${loaded.sourceLabel}` : `Loaded ${loaded.sourceLabel}`);
  const [messageIsError, setMessageIsError] = useState(false);
  const announce = (text: string) => {
    setMessage(text);
    setMessageIsError(false);
  };
  const fail = (text: string) => {
    setMessage(text);
    setMessageIsError(true);
  };
  const [writePath, setWritePath] = useState(loaded.writePath);
  const [displayPath, setDisplayPath] = useState(loaded.displayPath);
  const [expectedHash, setExpectedHash] = useState(loaded.expectedHash);
  const [sourceContent, setSourceContent] = useState(loaded.originalContent ?? null);
  const [saving, setSaving] = useState(false);
  const [saveScroll, setSaveScroll] = useState(0);
  const [diskContent, setDiskContent] = useState<string | null>(sourceContent);
  const [pendingDocument, setPendingDocument] = useState<LoadedConfig | null>(null);
  const [pendingScenario, setPendingScenario] = useState<Scenario | null>(null);
  const [recoveryDraft, setRecoveryDraft] = useState<Draft | null>(null);
  const [quitArmed, setQuitArmed] = useState(false);

  const config = timeline.config;
  const definitions = useMemo(() => moduleDefinitionsForConfig(config), [config]);
  const byName = useMemo(() => new Map(definitions.map((definition) => [definition.name, definition])), [definitions]);
  const defaults = useMemo(() => resolveDefaults(definitions), [definitions]);
  const baseItems = useMemo(() => formatItems(config, formatSide), [config, formatSide]);
  const items = moving?.items ?? baseItems;
  const normalizedQuery = query.trim().toLowerCase();
  const actionRows = useMemo(() => [
    { id: "save", label: "Review and save configuration" },
    { id: "undo", label: "Undo configuration edit" },
    { id: "redo", label: "Redo configuration edit" },
    { id: "format", label: "Open prompt format" },
    { id: "environment", label: "Open simulated environment" },
    { id: "output", label: "Open generated TOML" },
    { id: "palette", label: "Edit palettes" },
    { id: "scenarios", label: "Choose preview scenario" },
    { id: "compare", label: "Compare preview scenarios" },
    { id: "share", label: "Show config-only share link" },
    { id: "external", label: "Open external TOML editor" },
    { id: "help", label: "Show keyboard help" },
    ...definitions.map((definition) => ({ id: `module:${definition.name}`, label: `Settings: ${definition.name}` })),
  ].filter((action) => !normalizedQuery || action.label.toLowerCase().includes(normalizedQuery)), [definitions, normalizedQuery]);
  const formatEntries = useMemo(
    () => flattenFormat(items, normalizedQuery ? new Set() : collapsed)
      .filter(({ label }) => !normalizedQuery || label.toLowerCase().includes(normalizedQuery)),
    [items, collapsed, normalizedQuery],
  );
  const selectedFormatIndex = clampSelection(formatSelection, formatEntries.length);
  const selectedEntry = formatEntries[selectedFormatIndex];
  const formatBreadcrumb = selectedEntry?.path.map((_, index) => {
    const item = getAt(items, selectedEntry.path.slice(0, index + 1));
    return item ? itemLabel(item) : "?";
  }).join(" › ");
  const selectedName = formatItemModule(selectedEntry?.item);
  const selectedDefinition = selectedModule ? byName.get(selectedModule) : undefined;
  const moduleOptions = selectedDefinition ? optionsForModule(selectedDefinition, config)
    .filter((option) => view !== "settings" || !normalizedQuery || option.key.toLowerCase().includes(normalizedQuery) ||
      getOptionSchema(selectedDefinition.name.split(".")[0], option.key)?.description?.toLowerCase().includes(normalizedQuery)) : [];
  const selectedOptionIndex = clampSelection(settingsSelection, moduleOptions.length);
  const selectedOption = moduleOptions[selectedOptionIndex];
  const selectedEnvironment = ENVIRONMENT_FIELDS[clampSelection(environmentSelection, ENVIRONMENT_FIELDS.length)];
  const environmentRoot = selectedEnvironment?.get(scenario);
  const environmentCurrent = valueAt(environmentRoot, environmentPath);
  const environmentRows = valueRows(environmentCurrent);
  const structuredRoot = selectedOption && (Array.isArray(selectedOption.value) || selectedOption.value && typeof selectedOption.value === "object")
    ? selectedOption.value : selectedOption?.kind === "array" ? [] : {};
  const structuredCurrent = valueAt(structuredRoot, structuredPath);
  const structuredRows = valueRows(structuredCurrent);
  const styleValue = styleTarget?.kind === "module"
    ? optionsForModule(byName.get(styleTarget.name)!, config).find((option) => option.key === styleTarget.option)?.value
    : styleTarget?.kind === "format"
      ? (() => {
        const item = getAt(formatItems(config, styleTarget.side), styleTarget.path);
        return item && item.kind !== "raw" ? item.style : undefined;
      })() : undefined;
  const currentStyle = typeof styleValue === "string" ? styleValue : "";
  const currentStyleTokens = styleTokens(currentStyle);
  const paletteNames = Object.keys(paletteTables(config));
  const paletteColors = Object.entries(paletteTables(config)[paletteName] ?? {});
  const glyphResults = glyphCatalogue ? (() => {
    const found = searchGlyphs(glyphCatalogue, query, null, 100).results;
    const recent = recentGlyphs.map((code) => glyphCatalogue.glyphs.find((glyph) => glyph.code === code))
      .filter((glyph): glyph is Glyph => glyph !== undefined)
      .filter((glyph) => !normalizedQuery || glyph.name.toLowerCase().includes(normalizedQuery));
    return [...recent, ...found.filter((glyph) => !recent.some((item) => item.code === glyph.code))].slice(0, 100);
  })() : [];
  const rendered = useMemo(() => renderPrompt({
    config,
    scenario: { ...scenario, terminalWidth: Math.max(20, Math.min(scenario.terminalWidth, columns - 6)) },
    modules: definitions,
    defaultOrder: PROMPT_ORDER,
  }), [columns, config, definitions, scenario]);
  const comparison = useMemo(() => view !== "compare" ? [] : listScenarios().map((candidate) => ({
    scenario: candidate,
    preview: renderPrompt({ config, scenario: candidate, modules: definitions, defaultOrder: PROMPT_ORDER }),
  })), [config, definitions, view]);
  const visibilityRows = useMemo(() => {
    if (view !== "visibility") return [];
    const referenced = new Set(collectModuleNames([...formatItems(config, "left"), ...formatItems(config, "right")]));
    return definitions.map((definition) => {
      const name = definition.name;
      if (isModuleDisabled(config, definition)) return { name, status: "disabled", reason: "Disabled in this configuration." };
      if (!referenced.has(name)) return { name, status: "unreferenced", reason: "Add this module to the left or right prompt format." };
      const isolated = renderPrompt({ config: { ...config, format: itemToSource({ kind: "module", name }), right_format: "" }, scenario, modules: definitions, defaultOrder: PROMPT_ORDER });
      if (isolated.warnings.length) return { name, status: "warning", reason: isolated.warnings.join("; ") };
      if (!isolated.lines.some((line) => segmentsText(line).trim())) {
        const options = Object.fromEntries(optionsForModule(definition, config).map((option) => [option.key, option.value]));
        return { name, status: "hidden", reason: inactiveReason(name, scenario, options) };
      }
      return { name, status: "visible", reason: "This module produces output in the current simulated environment." };
    }).filter((row) => !normalizedQuery || row.name.toLowerCase().includes(normalizedQuery) || row.status.includes(normalizedQuery));
  }, [config, definitions, normalizedQuery, scenario, view]);
  const selectedInactiveReason = selectedSummaryReason();
  function selectedSummaryReason(): string | null {
    if (!selectedName) return null;
    const definition = byName.get(selectedName);
    if (!definition) return "Unknown module. It is preserved in the format but cannot be previewed.";
    if (isModuleDisabled(config, definition)) return "Disabled in this configuration. Press Space to enable it.";
    const referenced = collectModuleNames([...formatItems(config, "left"), ...formatItems(config, "right")]).includes(selectedName);
    if (!referenced) return "Not referenced by the left or right prompt format.";
    const isolated = renderPrompt({ config: { ...config, format: itemToSource({ kind: "module", name: selectedName }), right_format: "" }, scenario, modules: definitions, defaultOrder: PROMPT_ORDER });
    if (isolated.lines.some((line) => segmentsText(line).trim())) return null;
    const options = Object.fromEntries(optionsForModule(definition, config).map((option) => [option.key, option.value]));
    return inactiveReason(selectedName, scenario, options);
  }
  const serialised = useMemo(
    () => serialiseConfig(config, { full: fullToml, defaults }),
    [config, defaults, fullToml],
  );
  const proposedContent = !isDirty(timeline) && sourceContent !== null ? sourceContent : serialiseConfig(config, { defaults });
  const diagnostics = useMemo(() => validateConfig(config), [config]);
  const saveReview = reviewLines(diskContent, proposedContent);
  const semanticChanges = changedPaths(timeline.baseline ?? {}, config);
  const diskChanged = (diskContent === null ? null : hashContent(diskContent)) !== expectedHash;
  const dirty = isDirty(timeline);
  const narrow = columns < 100;
  const contentHeight = Math.max(6, rows - (narrow ? 15 : 13));

  useEffect(() => {
    let active = true;
    void loadDraft(writePath).then((draft) => {
      if (!active || !draft || JSON.stringify(draft.config) === JSON.stringify(config)) return;
      setRecoveryDraft(draft);
      setView("recover");
    }).catch((error: Error) => fail(`Recovery draft: ${error.message}`));
    return () => { active = false; };
    // Check only when the active document changes, not on every edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [writePath]);

  useEffect(() => {
    if (!dirty || timeline.past.length === 0) return;
    const timer = setTimeout(() => {
      void saveDraft({ targetPath: writePath, baselineHash: expectedHash, config, scenario })
        .catch((error: Error) => fail(`Could not save recovery draft: ${error.message}`));
    }, 700);
    return () => clearTimeout(timer);
  }, [config, dirty, expectedHash, scenario, timeline.past.length, writePath]);

  const commit = (next: StarshipConfig, confirmation?: string) => {
    setTimeline((current) => changeConfig(current, next));
    if (confirmation) announce(confirmation);
    setQuitArmed(false);
  };

  const selectPath = (nextItems: FormatItem[], path: Path) => {
    const index = flattenFormat(nextItems, collapsed).findIndex((entry) => pathKey(entry.path) === pathKey(path));
    if (index >= 0) setFormatSelection(index);
  };

  const commitFormat = (nextItems: FormatItem[], confirmation: string, focus?: Path) => {
    if (nextItems === items) return;
    commit(setFormatItems(config, formatSideRef.current, nextItems), confirmation);
    if (focus) selectPath(nextItems, focus);
  };

  const openView = (next: View) => {
    const currentView = viewRef.current;
    setPreviousView(currentView === "help" || currentView === "save" || currentView === "add" ? previousView : currentView);
    setView(next);
    setQuery("");
    setSearching(false);
    setMoving(null);
  };

  const beginOptionEdit = (option: CliOption) => {
    if (!selectedDefinition) return;
    if (option.kind === "style") {
      setStyleTarget({ kind: "module", name: selectedDefinition.name, option: option.key });
      setStyleSelection(0);
      setView("style");
      return;
    }
    if (option.kind === "array" || option.kind === "raw" && option.value !== null && typeof option.value === "object") {
      setStructuredPath([]);
      setStructuredSelection(0);
      setView("structured");
      return;
    }
    setEdit({
      id: `${selectedDefinition.name}-${option.key}`,
      label: `${selectedDefinition.name}.${option.key}`,
      initialValue: inputValue(option.value),
      suggestions: option.choices?.map((choice) => choice.value),
      submit(value) {
        try {
          const parsed = parseEditedValue(option.kind, value);
          if (option.kind === "format") parseFormatString(String(parsed));
          commit(withModuleOption(config, selectedDefinition.name, option.key, parsed), `Changed ${selectedDefinition.name}.${option.key}`);
          setEdit(null);
        } catch (error) {
          fail((error as Error).message);
        }
      },
    });
  };

  const beginEnvironmentEdit = (field: EnvironmentField) => {
    const current = field.get(scenario);
    setEdit({
      id: `environment-${field.key}`,
      label: field.label,
      initialValue: inputValue(current),
      suggestions: field.choices,
      submit(value) {
        try {
          const parsed = field.kind === "number" ? parseEditedValue("number", value) : value;
          if (field.choices && !field.choices.includes(String(parsed))) throw new Error(`Choose one of: ${field.choices.join(", ")}.`);
          if ((field.key === "terminalWidth" || field.key === "jobs") && !Number.isInteger(Number(parsed))) throw new Error("Enter a whole number.");
          if (field.key === "time" && !Number.isFinite(Date.parse(String(parsed)))) throw new Error("Enter a fixed ISO date and time.");
          setScenario((existing) => field.set(existing, parsed));
          announce(`Changed simulated ${field.label.toLowerCase()}`);
          setEdit(null);
        } catch (error) {
          fail((error as Error).message);
        }
      },
    });
  };

  const applyStyle = (next: string) => {
    if (!styleTarget) return;
    if (styleTarget.kind === "module") {
      commit(withModuleOption(config, styleTarget.name, styleTarget.option, next), `Changed ${styleTarget.name}.${styleTarget.option}`);
    } else {
      const source = formatItems(config, styleTarget.side);
      const nextItems = updateAt(source, styleTarget.path, (item) => item.kind === "raw" ? item : { ...item, style: next });
      commit(setFormatItems(config, styleTarget.side, nextItems), "Changed format style");
    }
  };

  const runExternalEditor = async () => {
    if (isRawModeSupported) setRawMode(false);
    try {
      const result = await editConfigExternally(config);
      if (result.ok) commit(result.config, "Applied configuration from external editor");
      else fail(result.error);
    } catch (error) {
      fail(`External editor failed: ${(error as Error).message}`);
    } finally {
      if (isRawModeSupported) setRawMode(true);
    }
  };

  const refreshSaveReview = async () => {
    try {
      setDiskContent(await readFile(writePath, "utf8"));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") setDiskContent(null);
      else fail((error as Error).message);
    }
  };

  const openSaveReview = () => {
    setSaveScroll(0);
    openView("save");
    void refreshSaveReview();
  };

  const replaceDocument = (next: LoadedConfig, nextScenario?: Scenario | null) => {
    setTimeline(createTimeline(next.config, next.source === "file"));
    setWritePath(next.writePath);
    setDisplayPath(next.displayPath);
    setExpectedHash(next.expectedHash);
    setSourceContent(next.originalContent ?? null);
    setDiskContent(next.originalContent ?? null);
    setPendingDocument(null);
    setPendingScenario(null);
    if (nextScenario) setScenario(nextScenario);
    setView("format");
    announce(`Opened ${next.sourceLabel}`);
  };

  const requestReplace = async (next: LoadedConfig, nextScenario?: Scenario) => {
    if (dirty) {
      setPendingDocument(next);
      setPendingScenario(nextScenario ?? null);
      setView("replace");
    } else replaceDocument(next, nextScenario);
  };

  const doSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const content = proposedContent;
      const result = await saveReviewedDocument({ path: displayPath, expectedWritePath: writePath, draftPath: writePath, content, expectedHash });
      setExpectedHash(result.hash);
      setSourceContent(content);
      setDiskContent(content);
      setTimeline((current) => markSaved(current));
      announce(`${result.backupPath ? `Saved ${displayPath}; backup: ${result.backupPath}` : `Saved ${displayPath}`}${result.warnings.length ? "; " + result.warnings.join("; ") : ""}`);
      setView("output");
    } catch (error) {
      fail((error as Error).message);
      if ((error as Error).name === "ConfigConflictError") {
        await refreshSaveReview();
        setView("conflict");
      }
    } finally {
      setSaving(false);
    }
  };

  useInput((input, key) => {
    const currentView = viewRef.current;
    if (saving) return;
    if (edit) {
      if (key.escape) setEdit(null);
      return;
    }
    if (searching) {
      if (key.escape) setSearching(false);
      return;
    }
    if (moving) {
      if (key.escape) {
        setMoving(null);
        announce("Move cancelled");
      } else if (key.return) {
        commit(setFormatItems(config, formatSide, moving.items), "Reordered prompt format");
        setMoving(null);
      } else if (key.upArrow || input === "k") {
        const next = moveSibling(moving.items, moving.path, -1);
        if (next !== moving.items) {
          const path = [...moving.path];
          path[path.length - 1] -= 1;
          setMoving({ items: next, path });
          selectPath(next, path);
        }
      } else if (key.downArrow || input === "j") {
        const next = moveSibling(moving.items, moving.path, 1);
        if (next !== moving.items) {
          const path = [...moving.path];
          path[path.length - 1] += 1;
          setMoving({ items: next, path });
          selectPath(next, path);
        }
      }
      return;
    }

    if (key.ctrl && input === "s") {
      openSaveReview();
      return;
    }
    if (key.ctrl && input === "z") {
      const undone = undoConfig(timeline);
      if (undone !== timeline) {
        setTimeline(undone);
        announce("Undid last configuration change");
      }
      return;
    }
    if (key.ctrl && input === "y") {
      const redone = redoConfig(timeline);
      if (redone !== timeline) {
        setTimeline(redone);
        announce("Redid configuration change");
      }
      return;
    }
    if (input === "?") {
      openView("help");
      return;
    }
    if (input === ":" || key.ctrl && input === "p") {
      setActionSelection(0);
      openView("actions");
      setSearching(true);
      return;
    }
    if (input === "P" && (currentView === "format" || currentView === "settings")) {
      setPaletteSelection(Math.max(0, paletteNames.indexOf(String(config.palette ?? ""))));
      openView("palette");
      return;
    }
    if (input === "v" && (currentView === "format" || currentView === "settings")) {
      setVisibilitySelection(0);
      openView("visibility");
      return;
    }
    if (input === "q") {
      if (!dirty || quitArmed) exit();
      else {
        setQuitArmed(true);
        announce("Unsaved changes. Press q again to quit, or Ctrl+S to save.");
      }
      return;
    }
    if (input === "1") { openView("format"); return; }
    if (input === "2") { openView("environment"); return; }
    if (input === "3") { openView("output"); return; }
    if (key.escape && currentView === "save") {
      if (saveReviewDecision("cancel", { busy: saving, diskChanged, hasErrors: false }) === "cancel") setView(previousView);
      return;
    }
    if (key.escape && (currentView === "settings" || currentView === "add" || currentView === "help" || currentView === "replace" || currentView === "conflict" || currentView === "share" || currentView === "recover" || currentView === "actions" || currentView === "visibility")) {
      if (currentView === "replace") { setPendingDocument(null); setPendingScenario(null); }
      setView(currentView === "settings" || currentView === "add" ? "format" : previousView);
      return;
    }

    if (currentView === "format") {
      const items = formatSideRef.current === formatSide ? baseItems : formatItems(config, formatSideRef.current);
      const entries = flattenFormat(items, normalizedQuery ? new Set() : collapsed)
        .filter(({ label }) => !normalizedQuery || label.toLowerCase().includes(normalizedQuery));
      const selectedEntry = entries[clampSelection(formatSelection, entries.length)];
      if (key.upArrow || input === "k") setFormatSelection((current) => clampSelection(current - 1, formatEntries.length));
      else if (key.downArrow || input === "j") setFormatSelection((current) => clampSelection(current + 1, formatEntries.length));
      else if (key.tab) {
        const nextSide = formatSideRef.current === "left" ? "right" : "left";
        formatSideRef.current = nextSide;
        setFormatSide(nextSide);
        setFormatSelection(0);
        setCollapsed(new Set());
      }
      else if (input === "n") {
        commit(withRootOption(config, "add_newline", config.add_newline === false), "Changed prompt newline setting");
      }
      else if (input === "N") {
        setEdit({
          id: "create-named-module",
          label: "New named module (custom.NAME or env_var.NAME)",
          initialValue: "custom.project",
          submit(value) {
            const match = /^(custom|env_var)\.(.+)$/.exec(value.trim());
            if (!match || !isValidNamedModuleInstance(match[2])) {
              fail("Use custom.NAME or env_var.NAME; names start with a letter or underscore.");
              return;
            }
            const name = `${match[1]}.${match[2]}`;
            if (byName.has(name)) { fail(`${name} already exists.`); return; }
            const next = addNamedModule(config, match[1] as NamedModuleKind, match[2],
              typeof config.format === "string" ? config.format : DEFAULT_FORMAT);
            commit(next, `Created ${name}`);
            setFormatSide("left");
            formatSideRef.current = "left";
            setEdit(null);
          },
        });
      }
      else if (input === "/") setSearching(true);
      else if (input === "a") {
        setAddSelection(0);
        openView("add");
      } else if (input === "m" && selectedEntry && !normalizedQuery) {
        setMoving({ items: baseItems, path: selectedEntry.path });
        announce("Move mode: arrows reposition, Enter commits, Esc cancels");
      } else if ((key.rightArrow || key.return) && selectedEntry?.item.kind === "group") {
        setCollapsed((current) => {
          const next = new Set(current);
          next.delete(pathKey(selectedEntry.path));
          if (key.return && !current.has(pathKey(selectedEntry.path))) next.add(pathKey(selectedEntry.path));
          return next;
        });
      } else if (key.leftArrow && selectedEntry?.item.kind === "group") {
        setCollapsed((current) => new Set([...current, pathKey(selectedEntry.path)]));
      } else if (selectedEntry && input === "g") {
        commitFormat(wrapInGroup(items, selectedEntry.path), "Grouped format item", selectedEntry.path);
      } else if (selectedEntry && input === "u" && selectedEntry.item.kind === "group") {
        commitFormat(dissolveGroup(items, selectedEntry.path), "Ungrouped format items", selectedEntry.path);
      } else if (selectedEntry && input === "d") {
        const path = [...selectedEntry.path];
        path[path.length - 1] += 1;
        commitFormat(duplicateItem(items, selectedEntry.path), "Duplicated format item", path);
      } else if (selectedName && input === "R") {
        const identity = namedModuleIdentity(selectedName);
        if (!identity) { fail("Only named custom and environment modules can be renamed."); return; }
        setEdit({
          id: `rename-${selectedName}`,
          label: `Rename ${selectedName} to instance name`,
          initialValue: identity.instance,
          submit(value) {
            const name = value.trim();
            if (!isValidNamedModuleInstance(name)) { fail("Invalid module instance name."); return; }
            const next = renameNamedModule(config, selectedName, name);
            if (next === config) { fail("That name is already used."); return; }
            commit(next, `Renamed ${selectedName} to ${identity.kind}.${name}`);
            setEdit(null);
          },
        });
      } else if (selectedName && input === "D") {
        if (!namedModuleIdentity(selectedName)) { fail("Only named modules can be duplicated with D."); return; }
        setEdit({ id: `duplicate-${selectedName}`, label: `Duplicate ${selectedName} as instance name`, initialValue: `${selectedName.split(".")[1]}_copy`, submit(value) {
          const next = duplicateNamedModule(config, selectedName, value.trim(), typeof config.format === "string" ? config.format : DEFAULT_FORMAT);
          if (next === config) { fail("Enter a new, valid instance name."); return; }
          commit(next, `Duplicated ${selectedName} as ${value.trim()}`);
          setEdit(null);
        } });
      } else if (selectedName && input === "X") {
        if (!namedModuleIdentity(selectedName)) { fail("Only named modules can be removed with X."); return; }
        commit(removeNamedModule(config, selectedName), `Removed ${selectedName} and its references`);
        setFormatSelection((current) => Math.max(0, current - 1));
      } else if (selectedEntry && input === ">") {
        const prior = getAt(items, [...selectedEntry.path.slice(0, -1), selectedEntry.path.at(-1)! - 1]);
        const next = indentItem(items, selectedEntry.path);
        if (next !== items && prior?.kind === "group") {
          const path = [...selectedEntry.path.slice(0, -1), selectedEntry.path.at(-1)! - 1, prior.items.length];
          commitFormat(next, "Moved format item into group", path);
        }
      } else if (selectedEntry && input === "<") {
        const next = outdentItem(items, selectedEntry.path);
        if (next !== items) {
          const parentPath = selectedEntry.path.slice(0, -1);
          const path = [...parentPath];
          if (getAt(next, parentPath)) path[path.length - 1] += 1;
          commitFormat(next, "Moved format item out of group", path);
        }
      } else if (selectedEntry && input === "c" && selectedEntry.item.kind === "group") {
        commitFormat(updateAt(items, selectedEntry.path, (item) => item.kind === "group"
          ? { ...item, conditional: item.conditional ? undefined : true } : item), "Changed group condition", selectedEntry.path);
      } else if (selectedEntry && input === "S" && selectedEntry.item.kind !== "raw") {
        setStyleTarget({ kind: "format", side: formatSideRef.current, path: selectedEntry.path });
        setStyleSelection(0);
        setView("style");
      } else if (selectedEntry && input === "t") {
        const path = [...selectedEntry.path];
        path[path.length - 1] += 1;
        commitFormat(insertAt(items, path, { kind: "text", value: " " }), "Added literal text", path);
      } else if (selectedEntry && input === "e" && selectedEntry.item.kind !== "module") {
        const field = selectedEntry.item.kind === "group" ? "style" : selectedEntry.item.kind === "raw" ? "source" : "value";
        const initialValue = selectedEntry.item.kind === "group" ? selectedEntry.item.style ?? ""
          : selectedEntry.item.kind === "raw" ? selectedEntry.item.source : selectedEntry.item.value;
        setEdit({
          id: `format-${formatSide}-${pathKey(selectedEntry.path)}`,
          label: `${formatSide} ${field}`,
          initialValue,
          submit(value) {
            if (selectedEntry.item.kind === "raw") {
              try { parseFormatString(value); } catch (error) { fail((error as Error).message); return; }
            }
            commitFormat(updateAt(items, selectedEntry.path, (item) => {
              if (item.kind === "group") return { ...item, style: value };
              if (item.kind === "raw") return { ...item, source: value };
              if (item.kind === "text") return { ...item, value };
              return item;
            }), `Edited ${field}`, selectedEntry.path);
            setEdit(null);
          },
        });
      } else if ((input === "x" || key.delete) && selectedEntry) {
        const next = removeAt(items, selectedEntry.path);
        commitFormat(next, `Removed ${itemLabel(selectedEntry.item)} from the format`);
        setFormatSelection((current) => clampSelection(current, flattenFormat(next, collapsed).length));
      } else if ((key.return || input === " ") && selectedName) {
        const definition = byName.get(selectedName);
        if (!definition) return;
        if (input === " ") {
          commit(withModuleOption(config, selectedName, "disabled", !isModuleDisabled(config, definition)), `${selectedName} ${isModuleDisabled(config, definition) ? "enabled" : "disabled"}`);
        } else {
          setSelectedModule(selectedName);
          setSettingsSelection(0);
          setQuery("");
          setView("settings");
        }
      }
      return;
    }

    if (currentView === "settings") {
      if (!selectedDefinition || !selectedOption) return;
      if (key.upArrow || input === "k") setSettingsSelection((current) => clampSelection(current - 1, moduleOptions.length));
      else if (key.downArrow || input === "j") setSettingsSelection((current) => clampSelection(current + 1, moduleOptions.length));
      else if (input === "/") setSearching(true);
      else if (input === "r") {
        commit(withoutModuleOption(config, selectedDefinition.name, selectedOption.key), `Restored ${selectedDefinition.name}.${selectedOption.key}`);
      } else if (input === "G" && selectedOption.key.includes("symbol")) {
        setGlyphTarget({ module: selectedDefinition.name, option: selectedOption.key });
        setGlyphSelection(0);
        openView("glyph");
        setSearching(true);
        void loadGlyphs().then(setGlyphCatalogue).catch((error: Error) => fail(error.message));
      } else if (input === " " && selectedOption.kind === "boolean") {
        commit(withModuleOption(config, selectedDefinition.name, selectedOption.key, !selectedOption.value), `Changed ${selectedDefinition.name}.${selectedOption.key}`);
      } else if ((key.leftArrow || key.rightArrow) && selectedOption.choices?.length) {
        const values = selectedOption.choices.map((choice) => choice.value);
        const current = values.indexOf(String(selectedOption.value));
        const direction = key.leftArrow ? -1 : 1;
        const next = values[(current + direction + values.length) % values.length];
        commit(withModuleOption(config, selectedDefinition.name, selectedOption.key, next), `Changed ${selectedDefinition.name}.${selectedOption.key}`);
      } else if (key.return || input === "e") beginOptionEdit(selectedOption);
      return;
    }

    if (currentView === "glyph") {
      if (key.escape) setView("settings");
      else if (key.upArrow || input === "k") setGlyphSelection((index) => clampSelection(index - 1, glyphResults.length));
      else if (key.downArrow || input === "j") setGlyphSelection((index) => clampSelection(index + 1, glyphResults.length));
      else if (input === "/") setSearching(true);
      else if (key.return && glyphTarget && glyphResults[glyphSelection]) {
        const glyph = glyphResults[glyphSelection];
        const old = selectedOption?.value;
        const trailing = typeof old === "string" ? old.match(/\s+$/)?.[0] ?? "" : "";
        commit(withModuleOption(config, glyphTarget.module, glyphTarget.option, `${glyph.char}${trailing}`),
          `Selected ${glyph.name} symbol`);
        setRecentGlyphs((current) => [glyph.code, ...current.filter((code) => code !== glyph.code)].slice(0, 8));
        setView("settings");
      }
      return;
    }

    if (currentView === "structured") {
      if (!selectedDefinition || !selectedOption) { setView("settings"); return; }
      const current = valueAt(structuredRoot, structuredPath);
      const rows = valueRows(current);
      const row = rows[clampSelection(structuredSelection, rows.length)];
      const editor = structuredEditorFor(selectedDefinition.name, selectedOption.key);
      const apply = (next: unknown, description: string) => {
        commit(withModuleOption(config, selectedDefinition.name, selectedOption.key, next), description);
      };
      if (key.escape) {
        if (structuredPath.length > 0) {
          setStructuredPath(structuredPath.slice(0, -1));
          setStructuredSelection(0);
        } else setView("settings");
      } else if (key.upArrow || input === "k") {
        setStructuredSelection((index) => clampSelection(index - 1, rows.length));
      } else if (key.downArrow || input === "j") {
        setStructuredSelection((index) => clampSelection(index + 1, rows.length));
      } else if (input === "a") {
        if (Array.isArray(current)) {
          const entry = structuredPath.length === 0 ? initialArrayEntry(editor) : "";
          apply(addValue(structuredRoot, structuredPath, null, entry), `Added ${selectedOption.key} entry`);
          setStructuredSelection(rows.length);
        } else {
          setEdit({
            id: `structured-add-${structuredPath.join(".")}`,
            label: "New field name",
            initialValue: "",
            submit(value) {
              const name = value.trim();
              if (!name || rows.some((candidate) => candidate.key === name)) { fail("Enter a unique field name."); return; }
              apply(addValue(structuredRoot, structuredPath, name, ""), `Added ${name}`);
              setStructuredSelection(rows.length);
              setEdit(null);
            },
          });
        }
      } else if (row && (input === "x" || key.delete)) {
        apply(removeValue(structuredRoot, [...structuredPath, row.key]), `Removed ${String(row.key)}`);
        setStructuredSelection((index) => clampSelection(index, rows.length - 1));
      } else if (row && input === "r" && typeof row.key === "string") {
        setEdit({
          id: `structured-rename-${structuredPath.join(".")}-${row.key}`,
          label: "Rename field",
          initialValue: row.key,
          submit(value) {
            const name = value.trim();
            if (name !== row.key && rows.some((candidate) => candidate.key === name)) { fail("That field already exists."); return; }
            apply(renameValue(structuredRoot, [...structuredPath, row.key], name), `Renamed ${row.key}`);
            setEdit(null);
          },
        });
      } else if (row && (key.return || input === "e" || input === " ")) {
        if (row.value !== null && typeof row.value === "object") {
          setStructuredPath([...structuredPath, row.key]);
          setStructuredSelection(0);
        } else if (input === " " && typeof row.value === "boolean") {
          apply(updateValue(structuredRoot, [...structuredPath, row.key], !row.value), `Changed ${String(row.key)}`);
        } else {
          setEdit({
            id: `structured-${structuredPath.join(".")}-${row.key}`,
            label: String(row.key),
            initialValue: String(row.value ?? ""),
            submit(value) {
              try {
                const parsed = parseScalarLike(row.value, value);
                apply(updateValue(structuredRoot, [...structuredPath, row.key], parsed), `Changed ${String(row.key)}`);
                setEdit(null);
              } catch (error) { fail((error as Error).message); }
            },
          });
        }
      }
      return;
    }

    if (currentView === "style") {
      const tokens = styleTokens(currentStyle);
      const selected = clampSelection(styleSelection, tokens.length);
      const beginColor = (kind: "fg" | "bg") => {
        const palette = config.palette && config.palettes?.[config.palette];
        const names = palette && typeof palette === "object" ? Object.keys(palette) : [];
        setEdit({
          id: `style-${kind}`,
          label: `${kind === "fg" ? "Foreground" : "Background"} color`,
          initialValue: "",
          suggestions: [...names, "red", "green", "yellow", "blue", "purple", "cyan", "white", "#ffffff"],
          submit(value) {
            applyStyle(setStyleColor(currentStyle, kind, value));
            setEdit(null);
          },
        });
      };
      if (key.escape) setView(styleTarget?.kind === "format" ? "format" : "settings");
      else if (key.upArrow || input === "k") setStyleSelection((index) => clampSelection(index - 1, tokens.length));
      else if (key.downArrow || input === "j") setStyleSelection((index) => clampSelection(index + 1, tokens.length));
      else if (input === "f" || input === "b") beginColor(input === "f" ? "fg" : "bg");
      else if (input === "a") {
        setEdit({
          id: "style-add",
          label: "Style token or modifier",
          initialValue: "bold",
          suggestions: ["bold", "italic", "underline", "dimmed", "inverted", "strikethrough"],
          submit(value) {
            if (value.trim()) applyStyle([...tokens, value.trim()].join(" "));
            setEdit(null);
          },
        });
      } else if (tokens[selected] && (input === "e" || key.return)) {
        setEdit({
          id: `style-${selected}`,
          label: "Style token",
          initialValue: tokens[selected],
          submit(value) {
            applyStyle(replaceStyleToken(currentStyle, selected, value));
            setEdit(null);
          },
        });
      } else if (tokens[selected] && (input === "x" || key.delete)) {
        applyStyle(replaceStyleToken(currentStyle, selected, ""));
        setStyleSelection((index) => clampSelection(index, tokens.length - 1));
      }
      return;
    }

    if (currentView === "palette") {
      const names = Object.keys(paletteTables(config));
      const selected = names[clampSelection(paletteSelection, names.length)];
      if (key.escape) setView(previousView);
      else if (key.upArrow || input === "k") setPaletteSelection((index) => clampSelection(index - 1, names.length));
      else if (key.downArrow || input === "j") setPaletteSelection((index) => clampSelection(index + 1, names.length));
      else if (input === "a") {
        setEdit({ id: "new-palette", label: "New palette name", initialValue: "my_palette", submit(value) {
          const next = createPalette(config, value.trim());
          if (next === config) { fail("Enter a unique palette name."); return; }
          commit(next, `Created palette ${value.trim()}`);
          setPaletteSelection(names.length);
          setEdit(null);
        } });
      } else if (selected && input === "d") {
        const name = `${selected}_copy`;
        const next = createPalette(config, name, selected);
        if (next === config) fail(`${name} already exists.`);
        else { commit(next, `Duplicated ${selected}`); setPaletteSelection(names.length); }
      } else if (selected && input === "r") {
        setEdit({ id: `rename-palette-${selected}`, label: "Rename palette", initialValue: selected, submit(value) {
          const next = renamePalette(config, selected, value.trim());
          if (next === config) { fail("Enter a new, unused palette name."); return; }
          commit(next, `Renamed palette ${selected}`);
          setEdit(null);
        } });
      } else if (selected && (input === "x" || key.delete)) {
        const next = deletePalette(config, selected);
        if (next === config) fail("Select another palette before deleting the active one.");
        else { commit(next, `Removed palette ${selected}`); setPaletteSelection((index) => clampSelection(index, names.length - 1)); }
      } else if (selected && (input === "c" || key.rightArrow)) {
        setPaletteName(selected);
        setPaletteColorSelection(0);
        setView("palette-colors");
      } else if (selected && key.return) {
        const plan = planPaletteSwitch(config, selected);
        commit(applyPaletteSwitch(config, selected, { remap: true }),
          plan.affected.length ? `Selected ${selected}; remapped ${plan.affected.join(", ")}` : `Selected ${selected}`);
      }
      return;
    }

    if (currentView === "palette-colors") {
      const colors = Object.entries(paletteTables(config)[paletteName] ?? {});
      const row = colors[clampSelection(paletteColorSelection, colors.length)];
      if (key.escape || key.leftArrow) setView("palette");
      else if (key.upArrow || input === "k") setPaletteColorSelection((index) => clampSelection(index - 1, colors.length));
      else if (key.downArrow || input === "j") setPaletteColorSelection((index) => clampSelection(index + 1, colors.length));
      else if (input === "a") {
        setEdit({ id: `add-color-${paletteName}`, label: "New color (name=#RRGGBB)", initialValue: "accent=#ffffff", submit(value) {
          const separator = value.indexOf("=");
          const name = value.slice(0, separator).trim();
          const color = value.slice(separator + 1).trim();
          if (separator < 1 || Object.hasOwn(paletteTables(config)[paletteName] ?? {}, name)) { fail("Enter an unused name=color pair."); return; }
          const next = setPaletteColor(config, paletteName, name, color);
          if (next === config) { fail("Enter a valid named, indexed, or hex color."); return; }
          commit(next, `Added color ${name}`);
          setPaletteColorSelection(colors.length);
          setEdit(null);
        } });
      } else if (row && (input === "e" || key.return)) {
        setEdit({ id: `edit-color-${row[0]}`, label: `${row[0]} color`, initialValue: row[1], submit(value) {
          const next = setPaletteColor(config, paletteName, row[0], value.trim());
          if (next === config) { fail("Enter a valid named, indexed, or hex color."); return; }
          commit(next, `Changed color ${row[0]}`);
          setEdit(null);
        } });
      } else if (row && (input === "x" || key.delete)) {
        const used = paletteName === config.palette && colorsInUse(config).some((color) => color.token === row[0] && color.fromPalette);
        if (used) fail(`${row[0]} is used by a style. Replace its references first.`);
        else {
          commit(deletePaletteColor(config, paletteName, row[0]), `Removed color ${row[0]}`);
          setPaletteColorSelection((index) => clampSelection(index, colors.length - 1));
        }
      }
      return;
    }

    if (currentView === "environment") {
      const selected = ENVIRONMENT_FIELDS[clampSelection(environmentSelection, ENVIRONMENT_FIELDS.length)];
      if (key.upArrow || input === "k") setEnvironmentSelection((current) => clampSelection(current - 1, ENVIRONMENT_FIELDS.length));
      else if (key.downArrow || input === "j") setEnvironmentSelection((current) => clampSelection(current + 1, ENVIRONMENT_FIELDS.length));
      else if (input === "p") {
        setScenarioSelection(Math.max(0, listScenarios().findIndex((candidate) => candidate.id === scenario.id)));
        setView("scenarios");
      } else if (input === "c") setView("compare");
      else if (input === "o") {
        setEdit({ id: "open-scenario", label: "Open scenario JSON", initialValue: "", submit(value) {
          void loadScenarioFile(expandPath(value)).then((next) => {
            setScenario(next);
            announce(`Loaded simulated scenario ${next.label}`);
            setEdit(null);
          }).catch((error: Error) => fail(error.message));
        } });
      } else if (input === "s") {
        setEdit({ id: "save-scenario", label: "Save scenario JSON (new file)", initialValue: "scenario.json", submit(value) {
          void saveScenarioFile(expandPath(value), scenario).then(() => {
            announce(`Saved simulated scenario to ${expandPath(value)}`);
            setEdit(null);
          }).catch((error: Error) => fail(error.message));
        } });
      } else if (input === "x" && selected && OPTIONAL_ENVIRONMENT_CONTEXTS.has(selected.key)) {
        setScenario((current) => selected.set(current, undefined));
        announce(`Cleared simulated ${selected.label.toLowerCase()}`);
      } else if (selected && (key.return || input === " ")) {
        if (selected.kind === "boolean") {
          setScenario((current) => selected.set(current, !selected.get(current)));
        } else if (selected.kind === "structured") {
          setEnvironmentPath([]);
          setEnvironmentEntrySelection(0);
          setView("environment-structured");
        } else beginEnvironmentEdit(selected);
      }
      return;
    }

    if (currentView === "scenarios") {
      const candidates = listScenarios();
      if (key.escape) setView("environment");
      else if (key.upArrow || input === "k") setScenarioSelection((current) => clampSelection(current - 1, candidates.length));
      else if (key.downArrow || input === "j") setScenarioSelection((current) => clampSelection(current + 1, candidates.length));
      else if (key.return) {
        const next = candidates[clampSelection(scenarioSelection, candidates.length)];
        setScenario(structuredClone(next));
        setView("environment");
        announce(`Switched to ${next.label}; starship.toml is unchanged`);
      }
      return;
    }

    if (currentView === "compare") {
      if (key.escape || key.return) setView("environment");
      else if (key.upArrow || input === "k") setCompareSelection((index) => clampSelection(index - 1, comparison.length));
      else if (key.downArrow || input === "j") setCompareSelection((index) => clampSelection(index + 1, comparison.length));
      else if (input === " " && comparison[compareSelection]) {
        const id = comparison[compareSelection].scenario.id;
        setCompareSelected((current) => {
          const next = new Set(current);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        });
      }
      return;
    }

    if (currentView === "visibility") {
      const row = visibilityRows[clampSelection(visibilitySelection, visibilityRows.length)];
      if (key.upArrow || input === "k") setVisibilitySelection((index) => clampSelection(index - 1, visibilityRows.length));
      else if (key.downArrow || input === "j") setVisibilitySelection((index) => clampSelection(index + 1, visibilityRows.length));
      else if (input === "/") setSearching(true);
      else if (input === "e") setView("environment");
      else if (key.return && row) { setSelectedModule(row.name); setSettingsSelection(0); setView("settings"); }
      return;
    }

    if (currentView === "environment-structured") {
      if (!selectedEnvironment) { setView("environment"); return; }
      const root = selectedEnvironment.get(scenario);
      const current = valueAt(root, environmentPath);
      const rows = valueRows(current);
      const row = rows[clampSelection(environmentEntrySelection, rows.length)];
      const apply = (next: unknown, description: string) => {
        setScenario((existing) => selectedEnvironment.set(existing, next));
        announce(description);
      };
      if (key.escape) {
        if (environmentPath.length) { setEnvironmentPath(environmentPath.slice(0, -1)); setEnvironmentEntrySelection(0); }
        else setView("environment");
      } else if (key.upArrow || input === "k") setEnvironmentEntrySelection((index) => clampSelection(index - 1, rows.length));
      else if (key.downArrow || input === "j") setEnvironmentEntrySelection((index) => clampSelection(index + 1, rows.length));
      else if (input === "a") {
        if (Array.isArray(current)) {
          apply(addValue(root, environmentPath, null, ""), "Added simulated file or folder");
          setEnvironmentEntrySelection(rows.length);
        } else {
          setEdit({ id: "environment-add", label: selectedEnvironment.key === "custom" && !environmentPath.length ? "Custom module name" : "New field name", initialValue: "", submit(value) {
            const name = value.trim();
            if (!name || rows.some((entry) => entry.key === name)) { fail("Enter a unique field name."); return; }
            const initial = selectedEnvironment.key === "custom" && !environmentPath.length ? { output: "sample", when: true } : "";
            apply(addValue(root, environmentPath, name, initial), `Added simulated ${name}`);
            setEnvironmentEntrySelection(rows.length);
            setEdit(null);
          } });
        }
      } else if (row && (input === "x" || key.delete)) {
        apply(removeValue(root, [...environmentPath, row.key]), `Removed simulated ${String(row.key)}`);
        setEnvironmentEntrySelection((index) => clampSelection(index, rows.length - 1));
      } else if (row && (key.return || input === "e" || input === " ")) {
        if (row.value !== null && typeof row.value === "object") {
          setEnvironmentPath([...environmentPath, row.key]);
          setEnvironmentEntrySelection(0);
        } else if (input === " " && typeof row.value === "boolean") {
          apply(updateValue(root, [...environmentPath, row.key], !row.value), `Changed simulated ${String(row.key)}`);
        } else {
          setEdit({ id: `environment-${environmentPath.join(".")}-${row.key}`, label: String(row.key), initialValue: String(row.value ?? ""), submit(value) {
            try {
              apply(updateValue(root, [...environmentPath, row.key], parseScalarLike(row.value, value)), `Changed simulated ${String(row.key)}`);
              setEdit(null);
            } catch (error) { fail((error as Error).message); }
          } });
        }
      }
      return;
    }

    if (currentView === "output") {
      const lineCount = serialised.split("\n").length;
      if (key.upArrow || input === "k") setOutputScroll((current) => Math.max(0, current - 1));
      else if (key.downArrow || input === "j") setOutputScroll((current) => Math.min(Math.max(0, lineCount - contentHeight), current + 1));
      else if (key.pageUp) setOutputScroll((current) => Math.max(0, current - contentHeight));
      else if (key.pageDown) setOutputScroll((current) => Math.min(Math.max(0, lineCount - contentHeight), current + contentHeight));
      else if (input === "f") setFullToml((current) => !current);
      else if (input === "e") void runExternalEditor();
      else if (input === "r") {
        void loadConfig({ path: displayPath, requireFile: true }).then(requestReplace).catch((error: Error) => fail(error.message));
      } else if (input === "o") {
        setEdit({ id: "open-config", label: "Open starship.toml path", initialValue: displayPath, submit(value) {
          void loadConfig({ path: value, requireFile: true }).then((next) => { setEdit(null); void requestReplace(next); }).catch((error: Error) => fail(error.message));
        } });
      } else if (input === "p") {
        setEdit({ id: "open-preset", label: `Preset ID (${PRESETS.map((preset) => preset.id).join(", ")})`, initialValue: PRESETS[0]?.id ?? "", submit(value) {
          void loadConfig({ path: displayPath, preset: value.trim() }).then((next) => { setEdit(null); void requestReplace(next); }).catch((error: Error) => fail(error.message));
        } });
      } else if (input === "w") {
        setEdit({ id: "export-workspace", label: "Export workspace JSON (new file)", initialValue: "starship-workspace.json", submit(value) {
          void saveWorkspace(expandPath(value), { config, scenario, previewWidth: scenario.terminalWidth }).then(() => {
            setEdit(null);
            announce(`Exported workspace to ${expandPath(value)}`);
          }).catch((error: Error) => fail(error.message));
        } });
      } else if (input === "i") {
        setEdit({ id: "import-workspace", label: "Import workspace JSON", initialValue: "", submit(value) {
          void loadWorkspace(expandPath(value)).then((workspace) => {
            setEdit(null);
            const next: LoadedConfig = { config: workspace.config, displayPath, writePath, expectedHash, originalContent: null, source: "preset", sourceLabel: `workspace ${value}` };
            void requestReplace(next, { ...workspace.scenario, terminalWidth: workspace.previewWidth ?? workspace.scenario.terminalWidth });
          }).catch((error: Error) => fail(error.message));
        } });
      } else if (input === "l") setView("share");
      else if (input === "u") {
        setEdit({ id: "import-share", label: "Paste builder share link", initialValue: "", submit(value) {
          const shared = decodeShare(value.slice(value.indexOf("#") >= 0 ? value.indexOf("#") : 0));
          if (!shared) { fail("Invalid or unsupported config-only share link."); return; }
          setEdit(null);
          const next: LoadedConfig = { config: shared, displayPath, writePath, expectedHash, originalContent: null, source: "preset", sourceLabel: "config-only share link" };
          void requestReplace(next);
        } });
      }
      return;
    }

    if (currentView === "add") {
      const present = new Set(collectModuleNames(items));
      const candidates = definitions.filter((definition) => !present.has(definition.name) && (!normalizedQuery || definition.name.includes(normalizedQuery)));
      const selection = clampSelection(addSelection, candidates.length);
      if (key.upArrow || input === "k") setAddSelection((current) => clampSelection(current - 1, candidates.length));
      else if (key.downArrow || input === "j") setAddSelection((current) => clampSelection(current + 1, candidates.length));
      else if (input === "/") setSearching(true);
      else if (key.return && candidates[selection]) {
        const item: FormatItem = { kind: "module", name: candidates[selection].name };
        const path = selectedEntry
          ? [...selectedEntry.path.slice(0, -1), selectedEntry.path.at(-1)! + 1]
          : [items.length];
        const next = insertAt(items, path, item);
        commitFormat(next, `Added $${candidates[selection].name}`, path);
        setView("format");
      }
      return;
    }

    if (currentView === "actions") {
      if (key.upArrow || input === "k") setActionSelection((index) => clampSelection(index - 1, actionRows.length));
      else if (key.downArrow || input === "j") setActionSelection((index) => clampSelection(index + 1, actionRows.length));
      else if (input === "/") setSearching(true);
      else if (key.return) {
        const action = actionRows[clampSelection(actionSelection, actionRows.length)];
        if (!action) return;
        if (action.id.startsWith("module:")) {
          setSelectedModule(action.id.slice(7));
          setSettingsSelection(0);
          setView("settings");
        } else if (action.id === "save") openSaveReview();
        else if (action.id === "undo") { setTimeline((current) => undoConfig(current)); setView(previousView); }
        else if (action.id === "redo") { setTimeline((current) => redoConfig(current)); setView(previousView); }
        else if (action.id === "external") { setView("output"); void runExternalEditor(); }
        else if (action.id === "palette") { setPaletteSelection(0); setView("palette"); }
        else setView(action.id as View);
        setQuery("");
      }
      return;
    }

    if (currentView === "save") {
      if (key.upArrow || input === "k") setSaveScroll((current) => Math.max(0, current - 1));
      else if (key.downArrow || input === "j") setSaveScroll((current) => Math.min(Math.max(0, saveReview.length - contentHeight), current + 1));
      else if (key.pageUp) setSaveScroll((current) => Math.max(0, current - contentHeight));
      else if (key.pageDown) setSaveScroll((current) => Math.min(Math.max(0, saveReview.length - contentHeight), current + contentHeight));
      else if (key.return) {
        const decision = saveReviewDecision("confirm", { busy: saving, diskChanged, hasErrors: diagnostics.some((item) => item.severity === "error") });
        if (decision === "conflict") { setView("conflict"); fail("The destination changed on disk. Reload or choose Save As."); }
        else if (decision === "invalid") fail("Fix configuration errors before saving.");
        else if (decision === "save") void doSave();
      }
      else if (input === "a") {
        setEdit({
          id: "save-path",
          label: "Save as",
          initialValue: displayPath,
          submit(value) {
            const next = expandPath(value);
            if (next !== displayPath) {
              setExpectedHash(null);
              setDisplayPath(next);
              setWritePath(next);
              setDiskContent(null);
              void readFile(next, "utf8").then((content) => setDiskContent(content)).catch((error: NodeJS.ErrnoException) => {
                if (error.code !== "ENOENT") fail(error.message);
              });
            }
            announce(`Save destination: ${next}`);
            setEdit(null);
          },
        });
      }
      return;
    }

    if (currentView === "replace") {
      if (input === "d" && pendingDocument) replaceDocument(pendingDocument, pendingScenario);
      return;
    }

    if (currentView === "conflict") {
      if (input === "r") {
        void loadConfig({ path: displayPath, requireFile: true }).then(requestReplace).catch((error: Error) => fail(error.message));
      } else if (input === "a") {
        setView("save");
        announce("Choose a new path with a; the changed destination will not be overwritten.");
      } else if (input === "v") setView("save");
      return;
    }

    if (currentView === "recover") {
      if (input === "r" && recoveryDraft) {
        setTimeline(createTimeline(recoveryDraft.config, false));
        setScenario(recoveryDraft.scenario);
        setExpectedHash(recoveryDraft.baselineHash);
        setView("format");
        announce("Recovered draft. Review the proposed save; detected disk changes will block saving.");
        setRecoveryDraft(null);
      } else if (input === "d" && recoveryDraft) {
        void removeDraft(recoveryDraft.targetPath).then(() => announce("Discarded recovery draft"))
          .catch((error: Error) => fail(error.message));
        setRecoveryDraft(null);
        setView("format");
      }
      return;
    }
  });

  const formatWindow = visibleWindow(formatEntries, selectedFormatIndex, contentHeight);
  const optionWindow = visibleWindow(moduleOptions, selectedOptionIndex, contentHeight);
  const selectedSummary = selectedName ? byName.get(selectedName) : undefined;
  const outputLines = serialised.split("\n").slice(outputScroll, outputScroll + contentHeight);
  const presentModules = new Set(collectModuleNames(items));
  const addCandidates = definitions.filter((definition) => !presentModules.has(definition.name) && (!normalizedQuery || definition.name.includes(normalizedQuery)));
  const addWindow = visibleWindow(addCandidates, clampSelection(addSelection, addCandidates.length), contentHeight);
  const selectedEnvironmentIndex = clampSelection(environmentSelection, ENVIRONMENT_FIELDS.length);
  const environmentWindow = visibleWindow(ENVIRONMENT_FIELDS, selectedEnvironmentIndex, contentHeight);
  const structuredWindow = visibleWindow(structuredRows, clampSelection(structuredSelection, structuredRows.length), contentHeight - 1);

  if (columns < 60) {
    return (
      <Box flexDirection="column" borderStyle="round" borderColor="yellow" paddingX={1}>
        <Text bold color="yellow">Starship Prompt Builder needs 60 columns</Text>
        <Text>Current width: {columns}. Widen the terminal to continue.</Text>
        <Text dimColor>q quit · Ctrl+S remains available after resizing</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" width={Math.max(40, columns)}>
      {narrow ? (
        <>
          <Box paddingX={1} justifyContent="space-between">
            <Text bold color="yellow">🚀 Starship Prompt Builder</Text>
            {dirty ? <Text color="yellow">● modified</Text> : <Text color="green">✓ saved</Text>}
          </Box>
          <Box paddingX={1}><Text dimColor wrap="truncate-start">{displayPath}</Text></Box>
        </>
      ) : (
        <Box paddingX={1} justifyContent="space-between">
          <Box flexShrink={0}><Text bold color="yellow">🚀 Starship Prompt Builder</Text></Box>
          <Box minWidth={0}>
            <Text dimColor wrap="truncate-start">{displayPath} {dirty ? <Text color="yellow">● modified</Text> : <Text color="green">✓ saved</Text>}</Text>
          </Box>
        </Box>
      )}

      <PromptPreview
        lines={rendered.lines}
        right={rendered.right}
        warnings={rendered.warnings}
        scenarioLabel={scenario.label}
        width={Math.max(20, Math.min(scenario.terminalWidth, columns - 6))}
        color={color}
      />

      <Box paddingX={1} gap={2}>
        <Text color={view === "format" || view === "settings" || view === "add" ? "cyan" : undefined}>1 Format · {formatSide === "left" ? "left" : "right"}</Text>
        <Text color={view === "environment" || view === "environment-structured" || view === "scenarios" || view === "compare" ? "cyan" : undefined}>2 Environment</Text>
        <Text color={view === "output" || view === "save" ? "cyan" : undefined}>3 TOML</Text>
        <Text color={view === "palette" || view === "palette-colors" ? "cyan" : undefined}>P Palettes</Text>
        <Text color={view === "help" ? "cyan" : undefined}>? Help</Text>
        <Text color={view === "actions" ? "cyan" : undefined}>: Actions</Text>
        <Text color={view === "visibility" ? "cyan" : undefined}>v Visibility</Text>
      </Box>

      {view === "format" ? (
        <Box flexDirection={narrow ? "column" : "row"}>
          <Panel title={`FORMAT · ${formatSide.toUpperCase()}`} hint={searching ? "typing search" : "Tab side · a add · m move · g group"} width={narrow ? "100%" : "62%"}>
            {formatBreadcrumb ? <Text dimColor wrap="truncate-end"> {formatBreadcrumb}</Text> : null}
            {searching ? (
              <Box paddingX={1}><Text color="yellow">Search: </Text><TextInput defaultValue={query} onChange={(value) => { setQuery(value); setFormatSelection(0); }} onSubmit={() => setSearching(false)} /></Box>
            ) : query ? <Text dimColor> Filter: {query}</Text> : null}
            {formatWindow.items.length === 0 ? <Text dimColor> No format items match.</Text> : formatWindow.items.map(({ item, path, label }, offset) => {
              const name = formatItemModule(item);
              const definition = name ? byName.get(name) : undefined;
              const disabled = definition ? isModuleDisabled(config, definition) : Boolean(item.kind === "text" && item.disabled);
              return <Row key={pathKey(path)} selected={formatWindow.start + offset === selectedFormatIndex} marker={name ? disabled ? "○" : "●" : "·"} label={label} value={name ? definition ? disabled ? "disabled" : "enabled" : "unknown" : undefined} muted={!name} />;
            })}
          </Panel>
          {!narrow ? (
            <Panel title={selectedSummary ? `MODULE · ${selectedSummary.name}` : "SELECTION"} hint="Enter settings · Space toggle" width="38%">
              {selectedSummary ? (
                <>
                  <Row selected={false} label="state" value={isModuleDisabled(config, selectedSummary) ? "disabled" : "enabled"} />
                  {selectedInactiveReason ? <Text dimColor wrap="wrap"> {selectedInactiveReason}</Text> : null}
                  {optionsForModule(selectedSummary, config).slice(0, Math.max(3, contentHeight - 2)).map((option) => <Row key={option.key} selected={false} label={option.key} value={displayValue(option.value, 24)} muted={!option.overridden} />)}
                </>
              ) : <Text dimColor> Select a module to inspect its settings.</Text>}
            </Panel>
          ) : null}
        </Box>
      ) : null}

      {view === "settings" ? (
        <Panel title={`SETTINGS · ${selectedDefinition?.name ?? "unknown"}`} hint="/ search · r reset · Esc back">
          {searching ? <Box paddingX={1}><Text color="yellow">Search: </Text><TextInput defaultValue={query} onChange={(value) => { setQuery(value); setSettingsSelection(0); }} onSubmit={() => setSearching(false)} /></Box> : query ? <Text dimColor> Filter: {query}</Text> : null}
          {selectedDefinition ? <Text dimColor> {describeModule(selectedDefinition.name)}</Text> : null}
          {selectedOption ? <Text dimColor wrap="wrap"> {getOptionSchema(selectedDefinition?.name.split(".")[0] ?? "", selectedOption.key)?.description ?? selectedOption.key} · default {displayValue(selectedOption.defaultValue, Math.max(16, Math.floor(columns / 2)))} · {selectedOption.overridden ? "explicit override" : "inherited default"}</Text> : null}
          {optionWindow.items.map((option, offset) => <Row key={option.key} selected={optionWindow.start + offset === selectedOptionIndex} marker={option.overridden ? "●" : "○"} label={option.key} value={displayValue(option.value, Math.max(18, Math.floor(columns / 2)))} muted={!option.overridden} />)}
        </Panel>
      ) : null}

      {view === "structured" ? (
        <Panel title={`EDIT · ${selectedDefinition?.name}.${selectedOption?.key}`} hint="a add · Enter edit/open · x remove · Esc back">
          <Text dimColor> {structuredPath.length ? structuredPath.join(" / ") : "Entries"} · {Array.isArray(structuredCurrent) ? "list" : "map"}</Text>
          {structuredRows.length === 0 ? <Text dimColor> No entries. Press a to add one.</Text> : null}
          {structuredWindow.items.map((row, index) => (
            <Row key={String(row.key)} selected={structuredWindow.start + index === structuredSelection}
              label={String(row.key)} value={displayValue(row.value, Math.max(15, Math.floor(columns / 2)))} />
          ))}
        </Panel>
      ) : null}

      {view === "style" ? (
        <Panel title="STYLE" hint="f foreground · b background · a modifier · Esc back">
          <Text dimColor> {styleTarget?.kind === "module" ? `${styleTarget.name}.${styleTarget.option}` : "Format item"} · {currentStyle || "inherited / empty"}</Text>
          {currentStyleTokens.length === 0 ? <Text dimColor> No explicit tokens. Press f, b, or a.</Text> : null}
          {visibleWindow(currentStyleTokens, clampSelection(styleSelection, currentStyleTokens.length), contentHeight - 1).items.map((token, index) => (
            <Row key={`${index}-${token}`} selected={visibleWindow(currentStyleTokens, clampSelection(styleSelection, currentStyleTokens.length), contentHeight - 1).start + index === styleSelection}
              label={token} />
          ))}
        </Panel>
      ) : null}

      {view === "glyph" ? (
        <Panel title="SYMBOLS" hint="/ search · Enter choose · Esc back">
          {searching ? <Box paddingX={1}><Text color="yellow">Search: </Text><TextInput defaultValue={query} onChange={(value) => { setQuery(value); setGlyphSelection(0); }} onSubmit={() => setSearching(false)} /></Box> : null}
          {!glyphCatalogue ? <Text dimColor> Loading symbols…</Text> : null}
          {glyphCatalogue && glyphResults.length === 0 ? <Text dimColor> No matching symbols.</Text> : null}
          {visibleWindow(glyphResults, clampSelection(glyphSelection, glyphResults.length), contentHeight - 1).items.map((glyph, index) => (
            <Row key={`${glyph.category}-${glyph.code}`} selected={visibleWindow(glyphResults, clampSelection(glyphSelection, glyphResults.length), contentHeight - 1).start + index === glyphSelection}
              label={`${glyph.char} ${glyph.name}`} value={recentGlyphs.includes(glyph.code) ? `recent · ${glyph.category}` : glyph.category} />
          ))}
          <Text dimColor> Nerd Font icons require a compatible terminal font; Unicode symbols work in more fonts.</Text>
        </Panel>
      ) : null}

      {view === "palette" ? (
        <Panel title="PALETTES" hint="Enter select · c colors · a add · d duplicate · r rename · x remove">
          {paletteNames.length === 0 ? <Text dimColor> No palettes. Press a to create one.</Text> : null}
          {visibleWindow(paletteNames, clampSelection(paletteSelection, paletteNames.length), contentHeight).items.map((name, index) => (
            <Row key={name} selected={visibleWindow(paletteNames, clampSelection(paletteSelection, paletteNames.length), contentHeight).start + index === paletteSelection}
              marker={name === config.palette ? "●" : "○"} label={name} value={`${Object.keys(paletteTables(config)[name]).length} colors`} />
          ))}
        </Panel>
      ) : null}

      {view === "palette-colors" ? (
        <Panel title={`COLORS · ${paletteName}`} hint="a add · Enter edit · x remove · Esc back">
          {paletteColors.length === 0 ? <Text dimColor> No colors. Press a to add one.</Text> : null}
          {visibleWindow(paletteColors, clampSelection(paletteColorSelection, paletteColors.length), contentHeight).items.map(([name, color], index) => (
            <Row key={name} selected={visibleWindow(paletteColors, clampSelection(paletteColorSelection, paletteColors.length), contentHeight).start + index === paletteColorSelection}
              label={name} value={color} />
          ))}
        </Panel>
      ) : null}

      {view === "environment" ? (
        <Panel title="SIMULATED ENVIRONMENT" hint="Enter edit · x clear context · p pick · c compare · o/s file">
          {environmentWindow.items.map((field, offset) => <Row key={field.key} selected={environmentWindow.start + offset === selectedEnvironmentIndex} label={field.label} value={displayValue(OPTIONAL_ENVIRONMENT_CONTEXTS.has(field.key) ? scenario[field.key as keyof Scenario] : field.get(scenario), Math.max(18, Math.floor(columns / 2)))} />)}
        </Panel>
      ) : null}

      {view === "environment-structured" ? (
        <Panel title={`SIMULATED · ${selectedEnvironment?.label ?? "environment"}`} hint="a add · Enter edit/open · x remove · Esc back">
          <Text dimColor> {environmentPath.length ? environmentPath.join(" / ") : "Entries"} · {Array.isArray(environmentCurrent) ? "list" : "map"}</Text>
          {environmentRows.length === 0 ? <Text dimColor> No simulated entries. Press a to add one.</Text> : null}
          {visibleWindow(environmentRows, clampSelection(environmentEntrySelection, environmentRows.length), contentHeight - 1).items.map((row, index) => (
            <Row key={String(row.key)} selected={visibleWindow(environmentRows, clampSelection(environmentEntrySelection, environmentRows.length), contentHeight - 1).start + index === environmentEntrySelection}
              label={String(row.key)} value={displayValue(row.value, Math.max(15, Math.floor(columns / 2)))} />
          ))}
        </Panel>
      ) : null}

      {view === "scenarios" ? (
        <Panel title="BUILT-IN SCENARIOS" hint="Enter switch · Esc back">
          {listScenarios().map((candidate, index) => <Row key={candidate.id} selected={index === scenarioSelection} marker={candidate.id === scenario.id ? "●" : "○"} label={candidate.label} value={candidate.description} />)}
        </Panel>
      ) : null}

      {view === "compare" ? (
        <Panel title="SCENARIO COMPARISON" hint="↑↓ select · Space include/exclude · Esc back">
          <Text dimColor> Compared with current: {scenario.label}. Configuration remains unchanged.</Text>
          {visibleWindow(comparison, compareSelection, contentHeight - 1).items.map(({ scenario: candidate, preview }, offset) => {
            const text = preview.lines.map(segmentsText).join(" ↵ ");
            const baseline = rendered.lines.map(segmentsText).join(" ↵ ");
            return <Row key={candidate.id} selected={visibleWindow(comparison, compareSelection, contentHeight - 1).start + offset === compareSelection}
              marker={compareSelected.has(candidate.id) ? text === baseline ? "=" : "≠" : "○"}
              label={candidate.label} value={compareSelected.has(candidate.id) ? text : "excluded"} />;
          })}
        </Panel>
      ) : null}

      {view === "visibility" ? (
        <Panel title="MODULE VISIBILITY" hint="/ search · Enter settings · e environment · Esc back">
          {searching ? <Box paddingX={1}><Text color="yellow">Search: </Text><TextInput defaultValue={query} onChange={(value) => { setQuery(value); setVisibilitySelection(0); }} onSubmit={() => setSearching(false)} /></Box> : query ? <Text dimColor> Filter: {query}</Text> : null}
          {visibilityRows[clampSelection(visibilitySelection, visibilityRows.length)] ? <Text dimColor wrap="wrap"> {visibilityRows[clampSelection(visibilitySelection, visibilityRows.length)].reason}</Text> : null}
          {visibleWindow(visibilityRows, clampSelection(visibilitySelection, visibilityRows.length), contentHeight - 1).items.map((row, index) => <Row
            key={row.name} selected={visibleWindow(visibilityRows, clampSelection(visibilitySelection, visibilityRows.length), contentHeight - 1).start + index === visibilitySelection}
            label={row.name} value={row.status} />)}
        </Panel>
      ) : null}

      {view === "output" ? (
        <Panel title={`STARSHIP.TOML · ${fullToml ? "full" : "minimal"}`} hint="f full · e editor · r reload · o open · p preset · w/i workspace · l/u link">
          {outputLines.map((line, index) => <Text key={`${outputScroll + index}-${line}`} wrap="truncate-end">{line || " "}</Text>)}
        </Panel>
      ) : null}

      {view === "share" ? (
        <Panel title="CONFIG-ONLY SHARE LINK" hint="Esc back">
          <Text wrap="wrap">https://starship.ndl.au/#{encodeShare(config)}</Text>
          <Text dimColor> Only starship.toml values are in this link. Use w in TOML for a workspace including the simulated environment.</Text>
        </Panel>
      ) : null}

      {view === "add" ? (
        <Panel title="ADD MODULE" hint="/ search · Esc cancel">
          {searching ? <Box paddingX={1}><Text color="yellow">Search: </Text><TextInput defaultValue={query} onChange={(value) => { setQuery(value); setAddSelection(0); }} onSubmit={() => setSearching(false)} /></Box> : query ? <Text dimColor> Filter: {query}</Text> : null}
          {addWindow.items.map((definition, offset) => <Row key={definition.name} selected={addWindow.start + offset === clampSelection(addSelection, addCandidates.length)} label={`$${definition.name}`} />)}
        </Panel>
      ) : null}

      {view === "actions" ? (
        <Panel title="ACTIONS, MODULES & SETTINGS" hint="/ search · Enter run · Esc back">
          {searching ? <Box paddingX={1}><Text color="yellow">Search: </Text><TextInput defaultValue={query} onChange={(value) => { setQuery(value); setActionSelection(0); }} onSubmit={() => setSearching(false)} /></Box> : query ? <Text dimColor> Filter: {query}</Text> : null}
          {visibleWindow(actionRows, clampSelection(actionSelection, actionRows.length), contentHeight - 1).items.map((action, index) => <Row
            key={action.id} selected={visibleWindow(actionRows, clampSelection(actionSelection, actionRows.length), contentHeight - 1).start + index === actionSelection}
            label={action.label} />)}
        </Panel>
      ) : null}

      {view === "save" ? (
        <Panel title="REVIEW SAVE" hint="↑↓ scroll · a Save As · Esc cancel">
          <Text> Destination: <Text color="cyan">{displayPath}</Text>{expectedHash ? " · unique private backup" : " · new file"}</Text>
          <Text color={diskChanged ? "red" : "yellow"}> {diskChanged ? "Destination changed on disk; cannot overwrite it." : "Enter  Save atomically"}</Text>
          <Text dimColor> Changes: {semanticChanges.length ? semanticChanges.slice(0, 7).join(", ") : "none"}{semanticChanges.length > 7 ? ` +${semanticChanges.length - 7} more` : ""}</Text>
          {typeof timeline.baseline?.format === "string" && timeline.baseline.format.includes("$all") && typeof config.format === "string" && !config.format.includes("$all")
            ? <Text color="yellow"> $all was materialized into an explicit module order.</Text> : null}
          <Text color={diagnostics.some((item) => item.severity === "error") ? "red" : "gray"}> Diagnostics: {diagnostics.length ? diagnostics.map((item) => `${item.severity} ${item.path}`).slice(0, 4).join("; ") : "none"}</Text>
          {saveReview.slice(saveScroll, saveScroll + Math.max(3, contentHeight - 4)).map((line, index) => (
            <Text key={`${saveScroll + index}-${line}`} wrap="truncate-end" color={line.startsWith("-") ? "red" : line.startsWith("+") ? "green" : undefined}>{line || " "}</Text>
          ))}
        </Panel>
      ) : null}

      {view === "replace" ? (
        <Panel title="UNSAVED CHANGES" hint="Esc keep editing">
          <Text> Open {pendingDocument?.sourceLabel}? Current edits will be lost.</Text>
          <Text color="yellow"> d  Discard edits and open</Text>
          <Text> Esc  Keep current document</Text>
        </Panel>
      ) : null}

      {view === "conflict" ? (
        <Panel title="FILE CHANGED ON DISK" hint="Esc keep editing">
          <Text> {displayPath} no longer matches the loaded version.</Text>
          <Text> r  Reload disk file (asks before discarding edits)</Text>
          <Text> a  Save As to a new path</Text>
          <Text> v  Compare disk file with the proposed regeneration</Text>
        </Panel>
      ) : null}

      {view === "recover" ? (
        <Panel title="RECOVERY DRAFT FOUND" hint="Esc keep current document">
          <Text> Unsaved work was found for {displayPath}.</Text>
          <Text color={recoveryDraft?.baselineHash === expectedHash ? "gray" : "yellow"}>
            {recoveryDraft?.baselineHash === expectedHash ? " Disk matches the draft baseline." : " Disk changed since this draft began; saving will require review or Save As."}
          </Text>
          <Text> r  Recover draft and simulated environment</Text>
          <Text> d  Discard draft and keep current document</Text>
        </Panel>
      ) : null}

      {view === "help" ? (
        <Panel title="KEYS" hint="Esc back">
          <Text> ↑↓ / j k   Navigate             Enter       Open or edit</Text>
          <Text> Space       Toggle module/value   Tab         Left/right prompt</Text>
          <Text> a / t       Add module / text     N / D       New / duplicate named</Text>
          <Text> g / u       Group / ungroup       &lt; / &gt;       Out / into group</Text>
          <Text> d / x       Duplicate / remove    R / X       Rename / remove named</Text>
          <Text> c           Group condition      m           Move sibling</Text>
          <Text> n           Prompt newline       /           Search</Text>
          <Text> Ctrl+Z/Y    Undo / redo            Ctrl+S      Review save</Text>
          <Text> 1 / 2 / 3   Main workspaces        e           Edit value or TOML</Text>
          <Text> : / Ctrl+P  Search actions and module settings</Text>
          <Text> v           Why modules are visible or hidden</Text>
          <Text> q           Quit                   ?           This help</Text>
        </Panel>
      ) : null}

      {edit ? <InputBar edit={edit} /> : null}
      <Box paddingX={1} justifyContent={narrow ? undefined : "space-between"} flexDirection={narrow ? "column" : "row"}>
        <Box minWidth={0} flexGrow={1}>
          <Text color={messageIsError ? "red" : "gray"} wrap="truncate-end">{message}</Text>
        </Box>
        <Box flexShrink={0}><Text dimColor>{moving ? "MOVE" : "↑↓ navigate · Ctrl+S save · ? help · q quit"}</Text></Box>
      </Box>
    </Box>
  );
}
