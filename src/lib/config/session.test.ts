import { beforeEach, describe, expect, it, vi } from "vitest";

import { clearSession, loadSession, saveSession } from "./session";
import { getScenario } from "@/lib/scenarios";

const store = new Map<string, string>();

beforeEach(() => {
  store.clear();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
  });
});

const session = {
  config: { add_newline: false },
  scenario: getScenario("simple"),
  themeId: "tokyo-night",
  fontId: "hack",
};

describe("session storage", () => {
  it("clears only our session and suppresses lifecycle writes during reset", async () => {
    vi.resetModules();
    const resettingSession = await import("./session");
    store.set("unrelated-app", "keep");
    resettingSession.saveSession(session);
    expect(resettingSession.resetSessionForReload()).toBe(true);
    resettingSession.saveSession(session);
    expect(resettingSession.loadSession()).toBeNull();
    expect(store.get("unrelated-app")).toBe("keep");
    vi.resetModules();
    expect((await import("./session")).loadSession()).toBeNull();
  });
  it("does not suppress future saves when storage refuses a reset", async () => {
    vi.resetModules();
    const resettingSession = await import("./session");
    window.localStorage.removeItem = () => { throw new Error("blocked"); };
    expect(resettingSession.resetSessionForReload()).toBe(false);
    resettingSession.saveSession(session);
    expect(resettingSession.loadSession()).not.toBeNull();
  });
  it("rejects an incomplete scenario that would crash the builder", () => {
    saveSession({ ...session, scenario: { path: "/tmp", shell: "zsh" } as never });
    expect(loadSession()).toBeNull();
  });
  it("round-trips what was saved", () => {
    saveSession(session);
    expect(loadSession()).toMatchObject({ themeId: "tokyo-night", fontId: "hack" });
  });

  it("ignores a payload from an older version", () => {
    saveSession(session);
    const raw = JSON.parse([...store.values()][0]);
    store.set([...store.keys()][0], JSON.stringify({ ...raw, version: 0 }));
    expect(loadSession()).toBeNull();
  });

  it("ignores anything that is not a session", () => {
    for (const junk of ["not json", "null", "[]", '{"version":1}', '{"version":1,"config":{},"scenario":{},"themeId":"a","fontId":"b"}']) {
      store.set("starship-prompt-builder.session", junk);
      expect(loadSession()).toBeNull();
    }
  });

  it("survives storage that throws", () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem() { throw new Error("disabled"); },
        setItem() { throw new Error("quota"); },
        removeItem() { throw new Error("nope"); },
      },
    });
    // Private browsing must not take the app down with it.
    expect(() => saveSession(session)).not.toThrow();
    expect(loadSession()).toBeNull();
    expect(() => clearSession()).not.toThrow();
  });
});
