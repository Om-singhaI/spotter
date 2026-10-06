import { describe, expect, it } from "vitest";
import { likePattern } from "./repo.js";

describe("likePattern", () => {
  it("wraps the term in wildcards", () => {
    expect(likePattern("bench")).toBe("%bench%");
  });
  it("anchors to the start when asked", () => {
    expect(likePattern("bench", true)).toBe("bench%");
  });
  it("escapes the characters LIKE treats as wildcards", () => {
    expect(likePattern("100%_\\")).toBe("%100\\%\\_\\\\%");
  });
});
