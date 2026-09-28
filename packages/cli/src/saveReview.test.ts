import { describe, expect, it, vi } from "vitest";
import { saveConfig } from "./configFile";
import { removeDraft } from "./draftFile";
import { saveReviewDecision, saveReviewedDocument } from "./saveReview";
vi.mock("./configFile", () => ({ saveConfig: vi.fn() }));
vi.mock("./draftFile", () => ({ removeDraft: vi.fn() }));

describe("save review boundary", () => {
  it("distinguishes cancel, busy, conflict, invalid and approved writes", () => {
    const state = { busy: false, diskChanged: false, hasErrors: false };
    expect(saveReviewDecision("cancel", state)).toBe("cancel");
    expect(saveReviewDecision("confirm", { ...state, busy: true })).toBe("wait");
    expect(saveReviewDecision("confirm", { ...state, diskChanged: true })).toBe("conflict");
    expect(saveReviewDecision("confirm", { ...state, hasErrors: true })).toBe("invalid");
    expect(saveReviewDecision("confirm", state)).toBe("save");
  });
  it("reports success with cleanup warnings after publication", async () => {
    vi.mocked(saveConfig).mockResolvedValue({ hash: "new", backupPath: "private-backup", warnings: [] });
    vi.mocked(removeDraft).mockRejectedValue(new Error("synthetic cleanup failure"));
    const saved = await saveReviewedDocument({ path: "target", draftPath: "draft", content: "candidate", expectedHash: "old" });
    expect(saved.hash).toBe("new");
    expect(saved.warnings).toEqual(["Recovery draft cleanup failed: synthetic cleanup failure"]);
  });
  it("keeps the draft when publication fails", async () => {
    vi.mocked(removeDraft).mockClear();
    vi.mocked(saveConfig).mockRejectedValue(new Error("conflict"));
    await expect(saveReviewedDocument({ path: "target", draftPath: "draft", content: "candidate", expectedHash: "old" })).rejects.toThrow("conflict");
    expect(removeDraft).not.toHaveBeenCalled();
  });
});
