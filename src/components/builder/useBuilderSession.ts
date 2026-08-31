"use client";

/**
 * Browser persistence for the builder.
 *
 * The store owns the state; this hook owns the browser boundaries around it:
 * URL fragments, local storage, same-document navigation, and lifecycle
 * flushes. Keeping those effects out of Builder leaves the page component to
 * compose the editor rather than also acting as a persistence service.
 */

import { useEffect, useRef } from "react";

import { decodeShare, encodeShare } from "@/lib/config/share";
import {
  loadSession,
  saveSession,
  type PersistedSession,
} from "@/lib/config/session";
import type { StarshipConfig } from "@/lib/engine/prompt";
import type { Scenario } from "@/lib/scenarios/types";

interface BuilderSessionOptions {
  config: StarshipConfig;
  scenario: Scenario;
  themeId: string;
  fontId: string;
  fontSize: number;
  appTheme: "dark" | "light";
  appThemeIsExplicit: boolean;
  loadShared(config: StarshipConfig): void;
  restoreSession(
    session: PersistedSession,
    options: { config: boolean },
  ): void;
}

export function useBuilderSession({
  config,
  scenario,
  themeId,
  fontId,
  fontSize,
  appTheme,
  appThemeIsExplicit,
  loadShared,
  restoreSession,
}: BuilderSessionOptions) {
  // Guards the save effect until the restore has run.
  const sessionReady = useRef(false);

  /*
   * Read after mount: the fragment is not part of the prerendered HTML, and
   * reading it during render would disagree with that HTML during hydration.
   */
  useEffect(() => {
    const shared = decodeShare(window.location.hash);
    if (shared) loadShared(shared);

    // A shared config outranks the stored config. The simulated environment,
    // font, and colour scheme are still this visitor’s own settings.
    const session = loadSession();
    if (session) restoreSession(session, { config: !shared });
    sessionReady.current = true;

    // A fragment pasted into an already-open tab is same-document navigation,
    // so mount does not run again. replaceState from this app emits no event.
    const onHashChange = () => {
      const next = decodeShare(window.location.hash);
      if (next) loadShared(next);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
    // Mount semantics are deliberate: store actions are stable and a later
    // render must not reinterpret the current fragment as a new incoming link.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /*
   * Keep a synchronous snapshot for pagehide. A tab can disappear inside the
   * debounce window, especially on mobile where tabs are discarded.
   */
  const sessionSnapshot = useRef({
    config,
    scenario,
    themeId,
    fontId,
    fontSize,
    appTheme: appThemeIsExplicit ? appTheme : undefined,
  });
  useEffect(() => {
    sessionSnapshot.current = {
      config,
      scenario,
      themeId,
      fontId,
      fontSize,
      appTheme: appThemeIsExplicit ? appTheme : undefined,
    };
  }, [config, scenario, themeId, fontId, fontSize, appTheme, appThemeIsExplicit]);

  useEffect(() => {
    if (!sessionReady.current) return;
    const timer = window.setTimeout(() => {
      saveSession(sessionSnapshot.current);
      // This is the same document, so edits replace rather than grow history.
      window.history.replaceState(null, "", `#${encodeShare(config)}`);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [
    config,
    scenario,
    themeId,
    fontId,
    fontSize,
    appTheme,
    appThemeIsExplicit,
  ]);

  useEffect(() => {
    if (!sessionReady.current) return;
    const flush = () => saveSession(sessionSnapshot.current);
    const onHidden = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onHidden);
    };
  }, []);
}
