"use client";

import { useEffect, useState } from "react";

import { isValidNamedModuleInstance } from "@/lib/config/namedModules";
import type { NamedModuleKind } from "@/lib/engine/modules";

const BUTTON =
  "rounded border border-white/15 px-2 py-1 text-xs text-neutral-200 transition hover:border-accent-400 hover:text-accent-200 disabled:cursor-not-allowed disabled:opacity-40";

export function NamedModuleActions({
  kind,
  instance,
  existing,
  onRename,
}: {
  kind: NamedModuleKind;
  instance: string;
  existing: string[];
  onRename(nextInstance: string): void;
}) {
  const [nextInstance, setNextInstance] = useState(instance);

  useEffect(() => setNextInstance(instance), [instance]);

  const trimmed = nextInstance.trim();
  const duplicate = trimmed !== instance && existing.includes(trimmed);
  const valid = isValidNamedModuleInstance(trimmed) && !duplicate;
  const label = kind === "env_var" ? "Environment variable instance" : "Custom command instance";

  return (
    <div className="mb-3 flex flex-col gap-2 rounded border border-white/10 bg-neutral-950/40 p-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-neutral-400">
          {label} name
          <input
            value={nextInstance}
            onChange={(event) => setNextInstance(event.target.value)}
            spellCheck={false}
            className="min-w-40 rounded border border-white/10 bg-neutral-950 px-2 py-1.5 font-mono text-base text-neutral-100 focus:border-accent-400 focus:outline-none"
          />
        </label>
        <button
          type="button"
          disabled={!valid || trimmed === instance}
          onClick={() => onRename(trimmed)}
          className={BUTTON}
        >
          Rename
        </button>
      </div>
      {!isValidNamedModuleInstance(trimmed) ? (
        <p className="text-xs text-amber-300">
          Start with a letter or underscore; then use letters, numbers, underscores, or hyphens.
        </p>
      ) : duplicate ? (
        <p className="text-xs text-amber-300">That instance already exists.</p>
      ) : (
        <p className="text-xs text-neutral-500">
          Renaming updates its table and every prompt-format reference.
        </p>
      )}

    </div>
  );
}
