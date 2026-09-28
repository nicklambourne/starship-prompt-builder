import { describe, expect, it } from "vitest";
import { checkRuleCount, compileRegex, replaceRegex } from "./safeRegex";
describe("bounded Rust-style regex replacement", () => {
  it("handles numeric, named, missing and literal dollar replacements", () => {
    expect(replaceRegex("(?P<team>prod)-(.*)", "prod-west", "${team}:$2:$$:$missing:$")).toBe("prod:west:$::$");
    expect(replaceRegex("(a)", "aa", "$1-X")).toBe("a-Xa");
    expect(replaceRegex("nomatch", "aa", "X")).toBeUndefined();
  });
  it("rejects unsupported syntax and excessive work without native fallback", () => {
    expect(() => compileRegex("(?=a)a")).toThrow();
    expect(() => compileRegex("(a)\\1")).toThrow();
    expect(() => compileRegex("a".repeat(1025))).toThrow(/1024/);
    expect(() => compileRegex("(a{1000}){1000}")).toThrow(/compilation budget/);
    expect(() => replaceRegex("a", "a".repeat(65537), "b")).toThrow(/bounded/);
    expect(() => checkRuleCount(129)).toThrow(/128/);
  });
  it("finishes the nested-quantifier regression fixture", () => {
    expect(replaceRegex("^(a+)+$", "a".repeat(50000) + "!", "x")).toBeUndefined();
  });
  it("bounds capture expansion before allocating the replacement result", () => {
    expect(() => replaceRegex("a+", "a".repeat(5000), "$0".repeat(1000))).toThrow(/output/);
    expect(() => replaceRegex("a", "b".repeat(40000) + "a", "c".repeat(40000))).toThrow(/output/);
  });
});
