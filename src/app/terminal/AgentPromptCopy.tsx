"use client";

import { useState } from "react";
import { AGENT_STARTER_PROMPT } from "@/lib/agentGuide";

export function AgentPromptCopy({ className }: { className: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-neutral-200">Starter prompt</span>
        <button
          type="button"
          aria-label="Copy starter prompt"
          onClick={async () => {
            await navigator.clipboard.writeText(AGENT_STARTER_PROMPT);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          }}
          className="shrink-0 rounded border border-white/10 px-3 py-1.5 text-sm text-neutral-200 transition hover:border-accent-400 hover:text-accent-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent-400"
        >
          {copied ? "Copied" : "Copy starter prompt"}
        </button>
      </div>
      <pre className={`${className} whitespace-pre-wrap break-words`} tabIndex={0} aria-label="Agent starter prompt">{AGENT_STARTER_PROMPT}</pre>
    </div>
  );
}
