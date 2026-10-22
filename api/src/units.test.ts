import { describe, expect, it } from "vitest";
import { fromKg, toKg } from "./units.js";

describe("units", () => {
  it("stores pounds as kilograms with three decimals", () => {
    expect(toKg(135, "lb")).toBe(61.235);
    expect(toKg(0, "lb")).toBe(0);
  });
  it("keeps kilograms as they are", () => {
    expect(toKg(100, "kg")).toBe(100);
    expect(toKg(62.5, "kg")).toBe(62.5);
  });
  it("round trips the pound values people actually type", () => {
    for (const lb of [45, 95, 135, 185, 225, 2.5, 12.5]) {
      expect(fromKg(toKg(lb, "lb"), "lb")).toBe(lb);
    }
  });
  it("shows kilograms with two decimals at most", () => {
    expect(fromKg(61.235, "kg")).toBe(61.24);
  });
});
