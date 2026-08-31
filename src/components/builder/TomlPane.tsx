"use client";

/**
 * Two-way TOML view.
 *
 * Editing here re-parses into the builder state, and builder changes
 * re-serialise back — so the text is never a read-only rendering of the truth,
 * it is one of two equal views of it. Local edits are held until they parse, so
 * a half-typed table does not blow away the config.
 */

import { useEffect, useState } from "react";

import { Toggle } from "@/components/ui/Toggle";
import { parseConfig, serialiseConfig } from "@/lib/config/toml";
import type { StarshipConfig } from "@/lib/engine/prompt";

interface TomlPaneProps {
  config: StarshipConfig;
  onConfigChange(next: StarshipConfig): void;
  defaults: Record<string, Record<string, unknown>>;
}

export function TomlPane({ config, onConfigChange, defaults }: TomlPaneProps) {
  const [full, setFull] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const serialised = serialiseConfig(config, { full, defaults });
  const text = draft ?? serialised;

  // Drop a stale draft whenever the config changes from elsewhere (a preset
  // load, an undo), so the pane follows the source of truth again.
  useEffect(() => {
    // External config changes intentionally discard the editor-only draft.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(null);
    setError(null);
  }, [config]);

  const commit = (next: string) => {
    setDraft(next);
    const result = parseConfig(next);
    if (result.ok) {
      setError(null);
      onConfigChange(result.config);
    } else {
      setError(result.line ? `Line ${result.line}: ${result.error}` : result.error);
    }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(serialised);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-xs text-neutral-400">
          <Toggle
            size="sm"
            label="Include default values"
            checked={full}
            onChange={setFull}
          />
          Include default values
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={copy}
            className="rounded border border-white/10 px-2.5 py-1 text-xs text-neutral-300 transition hover:border-accent-400 hover:text-accent-200"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

      <label htmlFor="toml-editor" className="sr-only">
        starship.toml
      </label>
      <textarea
        id="toml-editor"
        value={text}
        onChange={(e) => commit(e.target.value)}
        spellCheck={false}
        aria-invalid={error !== null}
        className={`min-h-64 flex-1 resize-y rounded border bg-neutral-950 p-3 font-mono text-base leading-relaxed text-neutral-200 focus:outline-none ${
          error ? "border-red-500/60" : "border-white/10 focus:border-accent-400"
        }`}
      />

      {error ? (
        <p role="alert" className="text-xs text-red-400">
          {error}
        </p>
      ) : (
        <p className="text-xs text-neutral-500">
          Paste an existing <code>starship.toml</code> here to load it. Options
          this builder does not recognise are preserved untouched.
        </p>
      )}
    </div>
  );
}
