"use client";

/**
 * What the page shows when a render throws.
 *
 * Without this the whole app white-screens, taking an unsaved config with it —
 * and this app evaluates user-supplied format strings and pasted TOML, so a
 * crash is not a hypothetical. The store survives the boundary, so the config
 * is offered back as a file before anything else is suggested.
 */

import { useEffect, useState } from "react";

import { Logo } from "@/components/ui/Logo";
import { DownloadIcon, CheckIcon } from "@/components/ui/icons";
import { rescueToml } from "@/lib/config/rescue";
import { resetSessionForReload } from "@/lib/config/session";
import { useBuilderStore } from "@/state/builderStore";

export default function BuilderError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [resetError, setResetError] = useState(false);
  // Read once, not as a subscription: this component must not re-render off
  // the same state that just brought the page down.
  const [toml] = useState(() => rescueToml(useBuilderStore.getState().config));

  useEffect(() => {
    // The digest is all a static site gets; the message is the useful half.
    console.error("Starship Prompt Builder crashed:", error);
  }, [error]);

  const download = () => {
    if (!toml) return;
    const url = URL.createObjectURL(new Blob([toml], { type: "text/plain" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "starship.toml";
    link.click();
    URL.revokeObjectURL(url);
  };

  const copy = async () => {
    if (!toml) return;
    await navigator.clipboard.writeText(toml);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-5 p-6">
      <div className="flex items-center gap-3">
        <Logo className="size-9" />
        <h1 className="text-lg font-semibold text-neutral-100">
          Something in the builder broke
        </h1>
      </div>

      <p className="text-sm leading-relaxed text-neutral-400">
        The editor stopped rendering. Nothing was sent anywhere, and your config
        is still here — take a copy before doing anything else.
      </p>

      {toml ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={download}
            className="inline-flex items-center gap-1.5 rounded bg-emerald-700 px-3 py-2 text-sm font-medium text-on-solid transition hover:bg-emerald-600"
          >
            <DownloadIcon />
            Download your config
          </button>
          <button
            type="button"
            onClick={copy}
            className="inline-flex items-center gap-1.5 rounded border border-white/15 px-3 py-2 text-sm text-neutral-200 transition hover:border-accent-400 hover:text-accent-200"
          >
            {copied ? <CheckIcon /> : null}
            {copied ? "Copied" : "Copy as TOML"}
          </button>
        </div>
      ) : (
        <p className="text-sm text-neutral-500">
          There was no config in memory to recover — the crash happened before
          anything was loaded.
        </p>
      )}

      <div className="flex flex-wrap gap-2 border-t border-white/10 pt-4">
        <button
          type="button"
          onClick={retry}
          className="rounded border border-white/15 px-3 py-2 text-sm text-neutral-200 transition hover:border-accent-400 hover:text-accent-200"
        >
          Try again
        </button>
        <button
          type="button"
          onClick={() => {
            if (!resetSessionForReload()) {
              setResetError(true);
              return;
            }
            window.location.replace(window.location.pathname);
          }}
          className="rounded border border-white/15 px-3 py-2 text-sm text-neutral-200 transition hover:border-accent-400 hover:text-accent-200"
        >
          Start over with the default prompt
        </button>
      </div>

      {resetError ? <p role="alert" className="text-sm text-neutral-300">Browser storage could not be cleared. Save your config, then clear this site’s storage in your browser settings before reloading.</p> : null}

      <p className="text-xs leading-relaxed text-neutral-500">
        If it keeps happening,{" "}
        <a
          href="https://github.com/nicklambourne/starship-prompt-builder/issues/new"
          target="_blank"
          rel="noreferrer noopener"
          className="text-accent-300 underline underline-offset-2"
        >
          open an issue
        </a>{" "}
        with what you were editing.
        {error.digest ? (
          <>
            {" "}
            Reference: <code className="text-neutral-400">{error.digest}</code>
          </>
        ) : null}
      </p>
    </main>
  );
}
