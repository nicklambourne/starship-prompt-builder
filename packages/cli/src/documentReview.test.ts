import { describe, expect, it } from "vitest";
import { changedPaths, reviewLines } from "./documentReview";

describe("save review", () => {
  it("shows changed known and unknown paths", () => {
    expect(changedPaths({ directory: { truncation_length: 3 }, future: { x: true } },
      { directory: { truncation_length: 4 }, future: { x: false } }))
      .toEqual(["directory.truncation_length", "future.x"]);
  });

  it("discloses the complete regenerated document and no-op saves", () => {
    expect(reviewLines("# comment\r\nformat = \"$directory\"\r\n", "format = \"$directory\"\n"))
      .toEqual(["--- current file", "+++ proposed file (regenerated TOML)", "- # comment␍", "- format = \"$directory\"␍", "+ format = \"$directory\""]);
    expect(reviewLines("same", "same")[0]).toContain("original bytes");
  });
});
