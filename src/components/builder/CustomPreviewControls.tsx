"use client";

import { Toggle } from "@/components/ui/Toggle";

interface Props {
  instance: string;
  when: unknown;
  value?: { output: string; when: boolean };
  onChange(value: { output: string; when: boolean }): void;
}

/** Scenario-only controls for the command execution a static browser cannot perform. */
export function CustomPreviewControls({ instance, when, value, onChange }: Props) {
  const preview = value ?? { output: "", when: true };
  return (
    <fieldset className="mb-3 rounded border border-accent-400/25 bg-accent-400/5 p-3">
      <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-accent-200">Browser preview</legend>
      <p className="mb-2 text-xs leading-relaxed text-neutral-400">
        This static app never runs your shell command. Simulate its result here; these values stay in the preview scenario and are not exported to starship.toml.
      </p>
      <label className="flex flex-col gap-1 text-xs text-neutral-400">
        Simulated command output
        <input
          aria-label={`Simulated output for custom.${instance}`}
          value={preview.output}
          onChange={(event) => onChange({ ...preview, output: event.target.value })}
          className="w-full rounded border border-white/10 bg-neutral-950 px-2 py-1.5 text-base text-neutral-100 focus:border-accent-400 focus:outline-none"
          placeholder="text printed by the command"
        />
      </label>
      {typeof when === "string" ? (
        <div className="mt-2">
          <Toggle
            label="Condition command succeeds"
            checked={preview.when}
            onChange={(next) => onChange({ ...preview, when: next })}
          />
        </div>
      ) : null}
    </fieldset>
  );
}
