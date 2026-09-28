"use client";

import { useMemo, useState } from "react";
import { Toggle } from "@/components/ui/Toggle";
import { parseConfig, serialiseConfig } from "@/lib/config/toml";
import { validateConfig } from "@/lib/config/diagnostics";
import type { StarshipConfig } from "@/lib/engine/prompt";

interface TomlPaneProps {
  config: StarshipConfig;
  onConfigChange(next: StarshipConfig): StarshipConfig;
  onPreviewChange(next: StarshipConfig | null, dirty: boolean): void;
  defaults: Record<string, Record<string, unknown>>;
}

// Textarea selection offsets count CRLF as one character; the draft need not.
function sourceOffset(text: string, offset: number): number {
  let index = 0;
  while (offset-- > 0 && index < text.length) {
    if (text[index] === "\r" && text[index + 1] === "\n") index++;
    index++;
  }
  return index;
}

export function TomlPane({ config, onConfigChange, onPreviewChange, defaults }: TomlPaneProps) {
  const [full, setFull] = useState(false);
  const [draft, setDraft] = useState<{ text: string; base: string; dirty: boolean } | null>(null);
  const [copyMessage, setCopyMessage] = useState("");
  const signature = JSON.stringify(config);
  const serialised = serialiseConfig(config, { full, defaults });
  const text = draft && (draft.dirty || draft.base === signature) ? draft.text : serialised;
  const parsed = useMemo(() => parseConfig(text), [text]);
  const error = useMemo(() => {
    if (!parsed.ok) return parsed.line ? `Line ${parsed.line}: ${parsed.error}` : parsed.error;
    const first = validateConfig(parsed.config).find((item) => item.severity === "error");
    return first ? `${first.path}: ${first.message}` : null;
  }, [parsed]);
  const dirty = draft?.dirty === true;
  const conflict = dirty && draft.base !== signature;

  const edit = (next: string) => {
    setDraft({ text: next, base: dirty ? draft.base : signature, dirty: true });
    setCopyMessage("");
    const result = parseConfig(next);
    const valid = result.ok && !validateConfig(result.config).some((item) => item.severity === "error");
    onPreviewChange(result.ok && valid ? result.config : null, true);
  };
  const discard = () => {
    setDraft(null);
    setCopyMessage("");
    onPreviewChange(null, false);
  };
  const apply = () => {
    if (!parsed.ok || error) return;
    const applied = onConfigChange(parsed.config);
    setDraft({ text, base: JSON.stringify(applied), dirty: false });
    onPreviewChange(null, false);
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyMessage("Copied");
    } catch {
      setCopyMessage("Clipboard unavailable. Select the draft and copy it with your keyboard.");
    }
  };
  const button = "rounded border border-white/15 px-2.5 py-1 text-xs text-neutral-200 hover:border-accent-400 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-xs text-neutral-400">
          <Toggle size="sm" label="Include default values" checked={full} disabled={dirty}
            onChange={(next) => { setFull(next); setDraft(null); }} />
          Include default values
        </span>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={button} onClick={copy}>Copy draft</button>
          <button type="button" className={button} onClick={apply} disabled={!dirty || error !== null}>
            {conflict ? "Apply draft over changed config" : "Apply draft"}
          </button>
          <button type="button" className={button} onClick={discard} disabled={!dirty}>Discard draft</button>
          <button type="button" className={button} onClick={discard} disabled={dirty}>Regenerate from applied config</button>
        </div>
      </div>
      {conflict ? <p role="alert" className="text-xs text-amber-300">The applied config changed while this draft was open. Apply explicitly to replace it, or discard your draft.</p> : null}
      <label htmlFor="toml-editor" className="sr-only">starship.toml</label>
      <textarea id="toml-editor" value={text}
        onChange={(e) => edit(text.includes("\r\n") ? e.target.value.replace(/\n/g, "\r\n") : e.target.value)}
        onPaste={(e) => {
          const pasted = e.clipboardData.getData("text/plain");
          if (!pasted) return;
          e.preventDefault();
          const editor = e.currentTarget;
          const start = editor.selectionStart;
          edit(text.slice(0, sourceOffset(text, start)) + pasted + text.slice(sourceOffset(text, editor.selectionEnd)));
          const cursor = start + pasted.replace(/\r\n/g, "\n").length;
          requestAnimationFrame(() => editor.setSelectionRange(cursor, cursor));
        }}
        spellCheck={false}
        aria-invalid={error !== null} aria-describedby="toml-status"
        className={`min-h-64 flex-1 resize-y rounded border bg-neutral-950 p-3 font-mono text-base leading-relaxed text-neutral-200 focus:outline-none ${error ? "border-red-500/60" : "border-white/10 focus:border-accent-400"}`} />
      <p id="toml-status" role={error ? "alert" : "status"} className={`text-xs ${error ? "text-red-400" : "text-neutral-400"}`}>
        {error ?? (dirty ? "Previewing draft. Apply to update the builder, share link and downloads." : "Applied configuration. Copy draft preserves this text; visual edits and generated downloads regenerate TOML.")}
      </p>
      {copyMessage ? <p role="status" className="text-xs text-neutral-300">{copyMessage}</p> : null}
    </div>
  );
}
