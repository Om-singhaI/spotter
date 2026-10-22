import { describe, expect, it } from "vitest";
import { estimateOneRepMaxKg, formatWeight, fromKg } from "./units";

describe("units", () => {
  it("shows stored kilograms back as the pounds that were typed", () => {
    expect(fromKg(61.235, "lb")).toBe(135);
    expect(fromKg(102.058, "lb")).toBe(225);
  });
  it("rounds kilograms to the nearest quarter", () => {
    expect(fromKg(62.4, "kg")).toBe(62.5);
    expect(formatWeight(100, "kg")).toBe("100 kg");
  });
  it("estimates a one rep max the way the database does", () => {
    expect(estimateOneRepMaxKg(61.235, 8)).toBe(77.564);
    expect(estimateOneRepMaxKg(61.235, 15)).toBe(91.853);
  });
});
