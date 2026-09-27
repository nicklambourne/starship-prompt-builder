import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getScenario } from "@/lib/scenarios";
import { loadDraft, removeDraft, saveDraft } from "./draftFile";

describe("recovery drafts", () => {
  it("keeps drafts separate and keyed by target path", async () => {
    const directory = await mkdtemp(join(tmpdir(), "starship-draft-test-"));
    try {
      const targetPath = "/dotfiles/starship.toml";
      await saveDraft({ targetPath, baselineHash: "old", config: { format: "$directory" }, scenario: getScenario("cloud") }, directory);
      expect((await loadDraft(targetPath, directory))?.scenario.aws?.profile).toBe("production");
      expect(await loadDraft("/another/starship.toml", directory)).toBeNull();
      await removeDraft(targetPath, directory);
      expect(await loadDraft(targetPath, directory)).toBeNull();
    } finally { await rm(directory, { recursive: true, force: true }); }
  });
});
