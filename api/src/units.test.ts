import { describe, expect, it } from "vitest";
import { estimateOneRepMaxKg, fromKg, toKg } from "./units.js";

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
  it("estimates a one rep max the way the database does", () => {
    // 135 lb for 8 is stored as 61.235 kg; Postgres computed 77.564 for that row
    expect(estimateOneRepMaxKg(61.235, 8)).toBe(77.564);
    // a tie: 61.235 * 1.5 = 91.8525, which Postgres rounds up
    expect(estimateOneRepMaxKg(61.235, 15)).toBe(91.853);
    expect(estimateOneRepMaxKg(100, 1)).toBe(103.333);
    expect(estimateOneRepMaxKg(0, 10)).toBe(0);
  });
});
