import { describe, expect, it } from "vitest";
import { calculatePlateLoad } from "./plates";

describe("calculatePlateLoad", () => {
  const standard = { barWeight: 45, availablePlates: [45, 35, 25, 10, 5, 2.5] };

  it("loads 225 lb with two 45 lb plates per side", () => {
    expect(calculatePlateLoad(225, standard)).toEqual({
      platesPerSide: [{ weight: 45, count: 2 }],
      loadedWeight: 225,
      difference: 0,
    });
  });

  it("uses optional 55 lb plates when they result in fewer plates", () => {
    expect(calculatePlateLoad(245, { barWeight: 45, availablePlates: [55, 45, 10] })).toEqual({
      platesPerSide: [
        { weight: 55, count: 1 },
        { weight: 45, count: 1 },
      ],
      loadedWeight: 245,
      difference: 0,
    });
  });

  it("finds an exact combination that a greedy algorithm would miss", () => {
    expect(calculatePlateLoad(145, { barWeight: 45, availablePlates: [35, 25, 10] })).toEqual({
      platesPerSide: [{ weight: 25, count: 2 }],
      loadedWeight: 145,
      difference: 0,
    });
  });

  it("shows a closest load below the target", () => {
    expect(calculatePlateLoad(137, { barWeight: 45, availablePlates: [45, 10] })).toEqual({
      platesPerSide: [{ weight: 45, count: 1 }],
      loadedWeight: 135,
      difference: -2,
    });
  });

  it("chooses a closer load above the target", () => {
    expect(calculatePlateLoad(139, standard)).toEqual({
      platesPerSide: [
        { weight: 45, count: 1 },
        { weight: 2.5, count: 1 },
      ],
      loadedWeight: 140,
      difference: 1,
    });
  });

  it("uses the fewest plates even with unsorted denominations", () => {
    expect(calculatePlateLoad(225, { barWeight: 45, availablePlates: [5, 10, 45, 25] })).toEqual({
      platesPerSide: [{ weight: 45, count: 2 }],
      loadedWeight: 225,
      difference: 0,
    });
  });

  it("prefers fewer plates when two suggestions are equally close", () => {
    expect(calculatePlateLoad(140, { barWeight: 45, availablePlates: [45, 10, 5] })).toEqual({
      platesPerSide: [{ weight: 45, count: 1 }],
      loadedWeight: 135,
      difference: -5,
    });
  });

  it("rounds fractional bar weights instead of displaying floating point noise", () => {
    const result = calculatePlateLoad(315, { barWeight: 44.09, availablePlates: [45, 10] });
    expect(result?.loadedWeight).toBe(314.09);
    expect(result?.difference).toBe(-0.91);
  });

  it("handles an empty bar and decimal kilogram plates", () => {
    expect(calculatePlateLoad(20, { barWeight: 20, availablePlates: [0.5] })).toEqual({
      platesPerSide: [],
      loadedWeight: 20,
      difference: 0,
    });
    expect(calculatePlateLoad(21, { barWeight: 20, availablePlates: [0.5] })).toEqual({
      platesPerSide: [{ weight: 0.5, count: 1 }],
      loadedWeight: 21,
      difference: 0,
    });
  });

  it("rejects invalid targets but does not modify the recorded weight", () => {
    expect(calculatePlateLoad(40, standard)).toBeNull();
    expect(calculatePlateLoad(Number.NaN, standard)).toBeNull();
    expect(calculatePlateLoad(1000000, standard)).toBeNull();
  });
});
