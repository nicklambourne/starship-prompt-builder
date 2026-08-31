"use client";

import { useCallback, useEffect, useState } from "react";

import {
  CheckIcon,
  GitHubIcon,
  MoonIcon,
  ShareIcon,
  SunIcon,
} from "@/components/ui/icons";
import { useBuilderStore } from "@/state/builderStore";

export const HEADER_ICON_BUTTON =
  "grid size-9 place-items-center rounded border border-white/10 text-neutral-300 transition enabled:hover:border-accent-400 enabled:hover:text-accent-200 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-400";

const REPOSITORY_URL =
  "https://github.com/nicklambourne/starship-prompt-builder";

export function HeaderActions({
  getShareUrl,
}: {
  getShareUrl?: () => string | Promise<string>;
}) {
  const appTheme = useBuilderStore((state) => state.appTheme);
  const setAppTheme = useBuilderStore((state) => state.setAppTheme);
  const adoptSystemTheme = useBuilderStore((state) => state.adoptSystemTheme);
  const [shareCopied, setShareCopied] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: light)");
    const sync = () => adoptSystemTheme(query.matches ? "light" : "dark");
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, [adoptSystemTheme]);

  const share = useCallback(async () => {
    const url = await (getShareUrl ? getShareUrl() : window.location.href);
    await navigator.clipboard.writeText(url);
    setShareCopied(true);
    window.setTimeout(() => setShareCopied(false), 1500);
  }, [getShareUrl]);

  return (
    <div className="ml-auto flex items-center gap-2">
      <button
        type="button"
        onClick={() => setAppTheme(appTheme === "dark" ? "light" : "dark")}
        aria-label={`Switch to ${appTheme === "dark" ? "light" : "dark"} theme`}
        title={`Switch to ${appTheme === "dark" ? "light" : "dark"} theme`}
        className={HEADER_ICON_BUTTON}
      >
        {appTheme === "dark" ? <SunIcon /> : <MoonIcon />}
      </button>
      <a
        href={REPOSITORY_URL}
        aria-label="View this project on GitHub"
        title="View this project on GitHub"
        className={HEADER_ICON_BUTTON}
      >
        <GitHubIcon />
      </a>
      <button
        type="button"
        onClick={share}
        aria-label={shareCopied ? "Share link copied" : "Copy a share link"}
        title={shareCopied ? "Link copied" : "Copy a share link"}
        className={`${HEADER_ICON_BUTTON} ${
          shareCopied ? "border-emerald-400 text-emerald-300" : ""
        }`}
      >
        {shareCopied ? <CheckIcon /> : <ShareIcon />}
      </button>
    </div>
  );
}
