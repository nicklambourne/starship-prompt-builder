import { describe, expect, it } from "vitest";
import { shellCompletion } from "./completions";

describe("shell completions", () => {
  it.each(["bash", "zsh", "fish"])("lists supported commands for %s", (shell) => {
    expect(shellCompletion(shell)).toContain("preview validate state apply export share");
    expect(shellCompletion(shell)).toContain("--from-share");
    expect(shellCompletion(shell)).toContain("--expect-hash");
  });
  it("rejects unsupported shells", () => expect(() => shellCompletion("powershell")).toThrow(/Unsupported/));
});
