"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import { encodeReviewShare, SHARE_LIMITS } from "@/lib/config/share";
import { serialiseConfig } from "@/lib/config/toml";
import type { StarshipConfig } from "@/lib/engine/prompt";
import type { Scenario } from "@/lib/scenarios/types";
import { MODULE_DEFAULTS } from "@/lib/config/rescue";

interface Props {
  config: StarshipConfig;
  scenario: Scenario;
  themeId: string;
  fontId: string;
  fontSize: number;
}

export function AgentHandoff({ config, scenario, themeId, fontId, fontSize }: Props) {
  const [open, setOpen] = useState(false);
  const [goal, setGoal] = useState("");
  const [status, setStatus] = useState("");
  const [reviewUrl, setReviewUrl] = useState("");
  const [manualInstructions, setManualInstructions] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const goalRef = useRef<HTMLTextAreaElement>(null);
  const toml = serialiseConfig(config, { defaults: MODULE_DEFAULTS });
  const scenarioJson = JSON.stringify({ version: 1, scenario }, null, 2);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      goalRef.current?.focus();
    } else if (!open && dialog.open) dialog.close();
  }, [open]);

  const makeReviewUrl = () => {
    const fragment = encodeReviewShare({ config, scenario, themeId, fontId, fontSize });
    return fragment.length <= SHARE_LIMITS.payloadCharacters
      ? `${window.location.origin}${window.location.pathname}#${fragment}`
      : "";
  };

  async function copyInstructions() {
    const url = makeReviewUrl();
    setReviewUrl(url);
    const request = goal.trim() || "Help me improve this Starship prompt. Ask what I want to change before editing.";
    const instructions = [
      "Help me develop my Starship prompt with Starship Prompt Builder CLI.",
      `Goal: ${request}`,
      "This design is from my browser. It may differ from the starship.toml installed on my machine; ask which file to edit, then inspect it with starship-builder state <path> --json.",
      "Use starship-builder agent-guide and capabilities to discover the workflow and supported options.",
      "Save the TOML below as a starting candidate if needed. Save the scenario JSON below as scenario.json to preview my exact browser context with --scenario-file scenario.json.",
      "Create a separate candidate file. Run compare <path> --from <candidate> --scenario-file scenario.json --json --html <new-review.html> and show me its visual comparison, changed options and warnings.",
      "Run apply <path> --from <candidate> --json to review exact file contents. Ask for approval before writing. Once approved, use --yes --review-hash <reviewHash> --expect-hash <beforeHash|none>. Check the result.",
      `Terminal appearance: theme ${themeId}, font ${fontId}, size ${fontSize}px.${url ? ` Browser review link: ${url}` : " The design is too large for a review link; use the TOML and scenario below."}`,
      "Current browser TOML:",
      "```toml", toml.trimEnd(), "```",
      "Current simulated environment:",
      "```json", scenarioJson, "```",
    ].join("\n\n");
    setManualInstructions(instructions);
    try {
      await navigator.clipboard.writeText(instructions);
      setStatus("Instructions copied. Paste them into your AI assistant.");
    } catch {
      setStatus("Clipboard unavailable. Select and copy the complete instructions below.");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setReviewUrl(makeReviewUrl());
          setStatus("");
          setOpen(true);
        }}
        className="rounded border border-accent-400/60 px-2.5 py-1.5 text-xs font-medium text-accent-200 transition hover:bg-accent-400/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-400"
      >
        Continue with AI
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby="agent-handoff-title"
        onCancel={(event) => { event.preventDefault(); setOpen(false); }}
        className="m-auto max-h-[90vh] w-[min(94vw,46rem)] overflow-y-auto rounded-xl border border-white/15 bg-neutral-900 p-0 text-neutral-100 backdrop:bg-black/70"
      >
        <div className="space-y-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="agent-handoff-title" className="text-lg font-semibold">Continue with an AI assistant</h2>
              <p className="mt-1 text-sm text-neutral-400">Give your assistant the current design and a goal. It can review changes with the CLI before you approve a write.</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="rounded border border-white/20 px-2 py-1 text-sm text-neutral-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-400">Close</button>
          </div>
          <div>
            <label htmlFor="agent-goal" className="block text-sm font-medium text-neutral-200">What would you like to change?</label>
            <textarea
              ref={goalRef}
              id="agent-goal"
              rows={3}
              value={goal}
              onChange={(event) => { setGoal(event.target.value); setStatus(""); }}
              placeholder="Make this a compact two-line prompt with Git branch and a clear error indicator."
              className="mt-2 w-full rounded border border-white/20 bg-neutral-950 p-3 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-accent-400 focus:outline-none"
            />
          </div>
          <p className="text-xs text-neutral-400">The copied message contains this browser design and simulated context. Review it before sharing it with an external assistant, especially if your config contains secrets.</p>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={copyInstructions} className="rounded bg-[#a74400] px-3 py-2 text-sm font-medium text-on-solid transition hover:bg-[#913b00] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-400">Copy agent instructions</button>
            <Link href="/guides/ai-assisted-prompt-design" className="text-sm text-accent-300 underline underline-offset-2">See the walkthrough</Link>
            {reviewUrl ? <a href={reviewUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-accent-300 underline underline-offset-2">Open review link</a> : null}
          </div>
          <p role="status" className="min-h-5 text-sm text-emerald-300">{status}</p>
          {status.startsWith("Clipboard unavailable") ? (
            <textarea
              aria-label="Complete agent instructions"
              readOnly
              value={manualInstructions}
              rows={8}
              onFocus={(event) => event.target.select()}
              className="w-full rounded border border-white/20 bg-neutral-950 p-3 font-mono text-xs text-neutral-100"
            />
          ) : null}
          <details className="rounded border border-white/10 p-3">
            <summary className="cursor-pointer text-sm font-medium">Inspect the TOML and simulated context</summary>
            <h3 className="mt-3 text-sm font-semibold">Current browser TOML</h3>
            <pre className="mt-2 max-h-44 overflow-auto rounded bg-neutral-950 p-3 text-xs text-neutral-200" tabIndex={0}>{toml}</pre>
            <h3 className="mt-3 text-sm font-semibold">Scenario JSON</h3>
            <pre className="mt-2 max-h-44 overflow-auto rounded bg-neutral-950 p-3 text-xs text-neutral-200" tabIndex={0}>{scenarioJson}</pre>
          </details>
        </div>
      </dialog>
    </>
  );
}
