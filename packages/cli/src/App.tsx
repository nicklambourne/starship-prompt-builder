import React, { useEffect, useMemo, useState } from "react";
import { Box, Text, useApp, useInput, useStdin, useStdout } from "ink";
import { TextInput } from "@inkjs/ui";

import { expandPath, saveConfig, type LoadedConfig } from "./configFile";
import { editConfigExternally } from "./externalEditor";
import {
  changeConfig,
  createTimeline,
  displayValue,
  editableFormatItems,
  isDirty,
  markSaved,
  optionsForModule,
  parseEditedValue,
  redoConfig,
  undoConfig,
  withFormatItems,
  type CliOption,
} from "./model";
import { PromptPreview } from "./Preview";
import { resolveDefaults } from "@/lib/config/defaults";
import { itemLabel, moveItem, type FormatItem } from "@/lib/config/formatItems";
import { collectModuleNames } from "@/lib/config/formatTree";
import { withModuleOption, withoutModuleOption } from "@/lib/config/mutations";
import { serialiseConfig } from "@/lib/config/toml";
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
import { getScenario } from "@/lib/scenarios";
import type { Scenario } from "@/lib/scenarios/types";

type View = "format" | "settings" | "environment" | "output" | "add" | "save" | "help";

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
  kind: "string" | "number" | "boolean" | "enum";
  choices?: string[];
  get(scenario: Scenario): unknown;
  set(scenario: Scenario, value: unknown): Scenario;
}

const ENVIRONMENT_FIELDS: EnvironmentField[] = [
  { key: "path", label: "Directory", kind: "string", get: (s) => s.path, set: (s, value) => ({ ...s, path: String(value) }) },
  { key: "terminalWidth", label: "Prompt width", kind: "number", get: (s) => s.terminalWidth, set: (s, value) => ({ ...s, terminalWidth: Math.max(20, Number(value)) }) },
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
  {
    key: "branch",
    label: "Git branch",
    kind: "string",
    get: (s) => s.git?.branch ?? "",
    set: (s, value) => s.git ? { ...s, git: { ...s.git, branch: String(value) } } : s,
  },
];

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
  const [previousView, setPreviousView] = useState<View>("format");
  const [formatSelection, setFormatSelection] = useState(0);
  const [settingsSelection, setSettingsSelection] = useState(0);
  const [environmentSelection, setEnvironmentSelection] = useState(0);
  const [addSelection, setAddSelection] = useState(0);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [moving, setMoving] = useState<{ items: FormatItem[]; index: number } | null>(null);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [fullToml, setFullToml] = useState(false);
  const [outputScroll, setOutputScroll] = useState(0);
  const [message, setMessage] = useState(loaded.source === "preset" ? `Started from ${loaded.sourceLabel}` : `Loaded ${loaded.sourceLabel}`);
  const [writePath, setWritePath] = useState(loaded.writePath);
  const [displayPath, setDisplayPath] = useState(loaded.displayPath);
  const [expectedHash, setExpectedHash] = useState(loaded.expectedHash);
  const [saving, setSaving] = useState(false);
  const [quitArmed, setQuitArmed] = useState(false);

  const config = timeline.config;
  const definitions = useMemo(() => moduleDefinitionsForConfig(config), [config]);
  const byName = useMemo(() => new Map(definitions.map((definition) => [definition.name, definition])), [definitions]);
  const defaults = useMemo(() => resolveDefaults(definitions), [definitions]);
  const baseItems = useMemo(() => editableFormatItems(config), [config]);
  const items = moving?.items ?? baseItems;
  const normalizedQuery = query.trim().toLowerCase();
  const formatEntries = useMemo(
    () => items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => !normalizedQuery || itemLabel(item).toLowerCase().includes(normalizedQuery)),
    [items, normalizedQuery],
  );
  const selectedFormatIndex = clampSelection(formatSelection, formatEntries.length);
  const selectedEntry = formatEntries[selectedFormatIndex];
  const selectedName = formatItemModule(selectedEntry?.item);
  const selectedDefinition = selectedModule ? byName.get(selectedModule) : undefined;
  const moduleOptions = selectedDefinition ? optionsForModule(selectedDefinition, config) : [];
  const selectedOptionIndex = clampSelection(settingsSelection, moduleOptions.length);
  const selectedOption = moduleOptions[selectedOptionIndex];
  const rendered = useMemo(() => renderPrompt({
    config,
    scenario: { ...scenario, terminalWidth: Math.max(20, Math.min(scenario.terminalWidth, columns - 6)) },
    modules: definitions,
    defaultOrder: PROMPT_ORDER,
  }), [columns, config, definitions, scenario]);
  const serialised = useMemo(
    () => serialiseConfig(config, { full: fullToml, defaults }),
    [config, defaults, fullToml],
  );
  const dirty = isDirty(timeline);
  const narrow = columns < 100;
  const contentHeight = Math.max(6, rows - (narrow ? 15 : 13));

  const commit = (next: StarshipConfig, confirmation?: string) => {
    setTimeline((current) => changeConfig(current, next));
    if (confirmation) setMessage(confirmation);
    setQuitArmed(false);
  };

  const openView = (next: View) => {
    setPreviousView(view === "help" || view === "save" || view === "add" ? previousView : view);
    setView(next);
    setQuery("");
    setSearching(false);
    setMoving(null);
  };

  const beginOptionEdit = (option: CliOption) => {
    if (!selectedDefinition) return;
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
          setMessage((error as Error).message);
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
          setScenario((existing) => field.set(existing, parsed));
          setMessage(`Changed simulated ${field.label.toLowerCase()}`);
          setEdit(null);
        } catch (error) {
          setMessage((error as Error).message);
        }
      },
    });
  };

  const runExternalEditor = async () => {
    if (isRawModeSupported) setRawMode(false);
    try {
      const result = await editConfigExternally(config);
      if (result.ok) commit(result.config, "Applied configuration from external editor");
      else setMessage(result.error);
    } catch (error) {
      setMessage(`External editor failed: ${(error as Error).message}`);
    } finally {
      if (isRawModeSupported) setRawMode(true);
    }
  };

  const doSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const result = await saveConfig({ path: writePath, content: serialiseConfig(config, { defaults }), expectedHash });
      setExpectedHash(result.hash);
      setTimeline((current) => markSaved(current));
      setMessage(result.backupPath ? `Saved ${displayPath}; backup: ${result.backupPath}` : `Saved ${displayPath}`);
      setView("output");
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  useInput((input, key) => {
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
        setMessage("Move cancelled");
      } else if (key.return) {
        commit(withFormatItems(config, moving.items), "Reordered prompt format");
        setMoving(null);
      } else if (key.upArrow || input === "k") {
        const nextIndex = Math.max(0, moving.index - 1);
        setMoving({ items: moveItem(moving.items, moving.index, -1), index: nextIndex });
        setFormatSelection(nextIndex);
      } else if (key.downArrow || input === "j") {
        const nextIndex = Math.min(moving.items.length - 1, moving.index + 1);
        setMoving({ items: moveItem(moving.items, moving.index, 1), index: nextIndex });
        setFormatSelection(nextIndex);
      }
      return;
    }

    if (key.ctrl && input === "s") {
      openView("save");
      return;
    }
    if (key.ctrl && input === "z") {
      setTimeline(undoConfig);
      setMessage("Undid last configuration change");
      return;
    }
    if (key.ctrl && input === "y") {
      setTimeline(redoConfig);
      setMessage("Redid configuration change");
      return;
    }
    if (input === "?") {
      openView("help");
      return;
    }
    if (input === "q") {
      if (!dirty || quitArmed) exit();
      else {
        setQuitArmed(true);
        setMessage("Unsaved changes. Press q again to quit, or Ctrl+S to save.");
      }
      return;
    }
    if (input === "1") { openView("format"); return; }
    if (input === "2") { openView("environment"); return; }
    if (input === "3") { openView("output"); return; }
    if (key.escape && (view === "settings" || view === "add" || view === "help" || view === "save")) {
      setView(view === "settings" || view === "add" ? "format" : previousView);
      return;
    }

    if (view === "format") {
      if (key.upArrow || input === "k") setFormatSelection((current) => clampSelection(current - 1, formatEntries.length));
      else if (key.downArrow || input === "j") setFormatSelection((current) => clampSelection(current + 1, formatEntries.length));
      else if (input === "/") setSearching(true);
      else if (input === "a") {
        setAddSelection(0);
        openView("add");
      } else if (input === "m" && selectedEntry && !normalizedQuery) {
        setMoving({ items: baseItems, index: selectedEntry.index });
        setMessage("Move mode: arrows reposition, Enter commits, Esc cancels");
      } else if ((input === "x" || key.delete) && selectedEntry) {
        const next = items.filter((_, index) => index !== selectedEntry.index);
        commit(withFormatItems(config, next), `Removed ${itemLabel(selectedEntry.item)} from the format`);
        setFormatSelection((current) => clampSelection(current, next.length));
      } else if ((key.return || input === " ") && selectedName) {
        const definition = byName.get(selectedName);
        if (!definition) return;
        if (input === " ") {
          commit(withModuleOption(config, selectedName, "disabled", !isModuleDisabled(config, definition)), `${selectedName} ${isModuleDisabled(config, definition) ? "enabled" : "disabled"}`);
        } else {
          setSelectedModule(selectedName);
          setSettingsSelection(0);
          setView("settings");
        }
      }
      return;
    }

    if (view === "settings") {
      if (!selectedDefinition || !selectedOption) return;
      if (key.upArrow || input === "k") setSettingsSelection((current) => clampSelection(current - 1, moduleOptions.length));
      else if (key.downArrow || input === "j") setSettingsSelection((current) => clampSelection(current + 1, moduleOptions.length));
      else if (input === "r") {
        commit(withoutModuleOption(config, selectedDefinition.name, selectedOption.key), `Restored ${selectedDefinition.name}.${selectedOption.key}`);
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

    if (view === "environment") {
      const selected = ENVIRONMENT_FIELDS[clampSelection(environmentSelection, ENVIRONMENT_FIELDS.length)];
      if (key.upArrow || input === "k") setEnvironmentSelection((current) => clampSelection(current - 1, ENVIRONMENT_FIELDS.length));
      else if (key.downArrow || input === "j") setEnvironmentSelection((current) => clampSelection(current + 1, ENVIRONMENT_FIELDS.length));
      else if (input === "p") {
        setScenario(getScenario("dirty-repo"));
        setMessage("Restored the dirty git repository scenario");
      } else if (selected && (key.return || input === " ")) {
        if (selected.kind === "boolean") {
          setScenario((current) => selected.set(current, !selected.get(current)));
        } else beginEnvironmentEdit(selected);
      }
      return;
    }

    if (view === "output") {
      const lineCount = serialised.split("\n").length;
      if (key.upArrow || input === "k") setOutputScroll((current) => Math.max(0, current - 1));
      else if (key.downArrow || input === "j") setOutputScroll((current) => Math.min(Math.max(0, lineCount - contentHeight), current + 1));
      else if (key.pageUp) setOutputScroll((current) => Math.max(0, current - contentHeight));
      else if (key.pageDown) setOutputScroll((current) => Math.min(Math.max(0, lineCount - contentHeight), current + contentHeight));
      else if (input === "f") setFullToml((current) => !current);
      else if (input === "e") void runExternalEditor();
      return;
    }

    if (view === "add") {
      const present = new Set(collectModuleNames(items));
      const candidates = definitions.filter((definition) => !present.has(definition.name) && (!normalizedQuery || definition.name.includes(normalizedQuery)));
      const selection = clampSelection(addSelection, candidates.length);
      if (key.upArrow || input === "k") setAddSelection((current) => clampSelection(current - 1, candidates.length));
      else if (key.downArrow || input === "j") setAddSelection((current) => clampSelection(current + 1, candidates.length));
      else if (input === "/") setSearching(true);
      else if (key.return && candidates[selection]) {
        const item: FormatItem = { kind: "module", name: candidates[selection].name };
        const character = items.findIndex((candidate) => candidate.kind === "module" && candidate.name === "character");
        const index = character < 0 ? items.length : character;
        const next = [...items.slice(0, index), item, ...items.slice(index)];
        commit(withFormatItems(config, next), `Added $${candidates[selection].name}`);
        setFormatSelection(index);
        setView("format");
      }
      return;
    }

    if (view === "save") {
      if (key.return) void doSave();
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
            }
            setMessage(`Save destination: ${next}`);
            setEdit(null);
          },
        });
      }
    }
  });

  const formatWindow = visibleWindow(formatEntries, selectedFormatIndex, contentHeight);
  const optionWindow = visibleWindow(moduleOptions, selectedOptionIndex, contentHeight);
  const selectedSummary = selectedName ? byName.get(selectedName) : undefined;
  const outputLines = serialised.split("\n").slice(outputScroll, outputScroll + contentHeight);
  const presentModules = new Set(collectModuleNames(items));
  const addCandidates = definitions.filter((definition) => !presentModules.has(definition.name) && (!normalizedQuery || definition.name.includes(normalizedQuery)));
  const addWindow = visibleWindow(addCandidates, clampSelection(addSelection, addCandidates.length), contentHeight);

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
        <Text color={view === "format" || view === "settings" || view === "add" ? "cyan" : undefined}>1 Format</Text>
        <Text color={view === "environment" ? "cyan" : undefined}>2 Environment</Text>
        <Text color={view === "output" || view === "save" ? "cyan" : undefined}>3 TOML</Text>
        <Text color={view === "help" ? "cyan" : undefined}>? Help</Text>
      </Box>

      {view === "format" ? (
        <Box flexDirection={narrow ? "column" : "row"}>
          <Panel title="FORMAT" hint={searching ? "typing search" : "/ search · a add · m move"} width={narrow ? "100%" : "62%"}>
            {searching ? (
              <Box paddingX={1}><Text color="yellow">Search: </Text><TextInput defaultValue={query} onChange={(value) => { setQuery(value); setFormatSelection(0); }} onSubmit={() => setSearching(false)} /></Box>
            ) : query ? <Text dimColor> Filter: {query}</Text> : null}
            {formatWindow.items.length === 0 ? <Text dimColor> No format items match.</Text> : formatWindow.items.map(({ item, index }, offset) => {
              const name = formatItemModule(item);
              const definition = name ? byName.get(name) : undefined;
              const disabled = definition ? isModuleDisabled(config, definition) : Boolean(item.kind === "text" && item.disabled);
              return <Row key={`${index}-${itemLabel(item)}`} selected={formatWindow.start + offset === selectedFormatIndex} marker={name ? disabled ? "○" : "●" : "·"} label={itemLabel(item)} value={name ? definition ? disabled ? "disabled" : "enabled" : "unknown" : undefined} muted={!name} />;
            })}
          </Panel>
          {!narrow ? (
            <Panel title={selectedSummary ? `MODULE · ${selectedSummary.name}` : "SELECTION"} hint="Enter settings · Space toggle" width="38%">
              {selectedSummary ? (
                <>
                  <Row selected={false} label="state" value={isModuleDisabled(config, selectedSummary) ? "disabled" : "enabled"} />
                  {optionsForModule(selectedSummary, config).slice(0, Math.max(3, contentHeight - 2)).map((option) => <Row key={option.key} selected={false} label={option.key} value={displayValue(option.value, 24)} muted={!option.overridden} />)}
                </>
              ) : <Text dimColor> Select a module to inspect its settings.</Text>}
            </Panel>
          ) : null}
        </Box>
      ) : null}

      {view === "settings" ? (
        <Panel title={`SETTINGS · ${selectedDefinition?.name ?? "unknown"}`} hint="r reset · Esc back">
          {optionWindow.items.map((option, offset) => <Row key={option.key} selected={optionWindow.start + offset === selectedOptionIndex} marker={option.overridden ? "●" : "○"} label={option.key} value={displayValue(option.value, Math.max(18, Math.floor(columns / 2)))} muted={!option.overridden} />)}
        </Panel>
      ) : null}

      {view === "environment" ? (
        <Panel title="SIMULATED ENVIRONMENT" hint="p reset scenario">
          {visibleWindow(ENVIRONMENT_FIELDS, environmentSelection, contentHeight).items.map((field, offset) => <Row key={field.key} selected={visibleWindow(ENVIRONMENT_FIELDS, environmentSelection, contentHeight).start + offset === environmentSelection} label={field.label} value={displayValue(field.get(scenario), Math.max(18, Math.floor(columns / 2)))} />)}
        </Panel>
      ) : null}

      {view === "output" ? (
        <Panel title={`STARSHIP.TOML · ${fullToml ? "full" : "minimal"}`} hint="f full/minimal · e $EDITOR">
          {outputLines.map((line, index) => <Text key={`${outputScroll + index}-${line}`} wrap="truncate-end">{line || " "}</Text>)}
        </Panel>
      ) : null}

      {view === "add" ? (
        <Panel title="ADD MODULE" hint="/ search · Esc cancel">
          {searching ? <Box paddingX={1}><Text color="yellow">Search: </Text><TextInput defaultValue={query} onChange={(value) => { setQuery(value); setAddSelection(0); }} onSubmit={() => setSearching(false)} /></Box> : query ? <Text dimColor> Filter: {query}</Text> : null}
          {addWindow.items.map((definition, offset) => <Row key={definition.name} selected={addWindow.start + offset === clampSelection(addSelection, addCandidates.length)} label={`$${definition.name}`} />)}
        </Panel>
      ) : null}

      {view === "save" ? (
        <Panel title="REVIEW SAVE" hint="Esc cancel">
          <Text> Write <Text color="cyan">{displayPath}</Text>?</Text>
          <Text color="yellow"> › Enter  Save atomically{expectedHash ? " and replace .bak" : ""}</Text>
          <Text>   a      Save as another path</Text>
          <Text dimColor> Existing files are rejected if they changed after loading.</Text>
        </Panel>
      ) : null}

      {view === "help" ? (
        <Panel title="KEYS" hint="Esc back">
          <Text> ↑↓ / j k   Navigate             Enter       Open or edit</Text>
          <Text> Space       Toggle module/value   /           Search</Text>
          <Text> a           Add module            m           Move format item</Text>
          <Text> x / Delete  Remove format item    r           Restore default</Text>
          <Text> Ctrl+Z/Y    Undo / redo            Ctrl+S      Review save</Text>
          <Text> 1 / 2 / 3   Main workspaces        e           Edit value or TOML</Text>
          <Text> q           Quit                   ?           This help</Text>
        </Panel>
      ) : null}

      {edit ? <InputBar edit={edit} /> : null}
      <Box paddingX={1} justifyContent={narrow ? undefined : "space-between"} flexDirection={narrow ? "column" : "row"}>
        <Box minWidth={0} flexGrow={1}>
          <Text color={message.toLowerCase().includes("error") || message.includes("changed after") ? "red" : "gray"} wrap="truncate-end">{message}</Text>
        </Box>
        <Box flexShrink={0}><Text dimColor>{moving ? "MOVE" : "↑↓ navigate · Ctrl+S save · ? help · q quit"}</Text></Box>
      </Box>
    </Box>
  );
}
