import { describe, expect, it } from "vitest";
import { calculatePlateLoad } from "./plates";

describe("calculatePlateLoad", () => {
  const standard = { barWeight: 45, availablePlates: [45, 35, 25, 10, 5, 2.5] };

  it("loads 225 lb with two 45 lb plates per side", () => {
    expect(calculatePlateLoad(225, standard)).toEqual({
      platesPerSide: [{ weight: 45, count: 2 }],
      loadedWeight: 225,
      shortfall: 0,
    });
  });

  it("uses optional 55 lb plates when they result in fewer plates", () => {
    expect(calculatePlateLoad(245, { barWeight: 45, availablePlates: [55, 45, 10] })).toEqual({
      platesPerSide: [
        { weight: 55, count: 1 },
        { weight: 45, count: 1 },
      ],
      loadedWeight: 245,
      shortfall: 0,
    });
  });

  it("finds an exact combination that a greedy algorithm would miss", () => {
    expect(calculatePlateLoad(145, { barWeight: 45, availablePlates: [35, 25, 10] })).toEqual({
      platesPerSide: [{ weight: 25, count: 2 }],
      loadedWeight: 145,
      shortfall: 0,
    });
  });

  it("shows the closest achievable load without exceeding the target", () => {
    expect(calculatePlateLoad(137, { barWeight: 45, availablePlates: [45, 10] })).toEqual({
      platesPerSide: [{ weight: 45, count: 1 }],
      loadedWeight: 135,
      shortfall: 2,
    });
  });

  it("handles an empty bar and decimal kilogram plates", () => {
    expect(calculatePlateLoad(20, { barWeight: 20, availablePlates: [0.5] })).toEqual({
      platesPerSide: [],
      loadedWeight: 20,
      shortfall: 0,
    });
    expect(calculatePlateLoad(21, { barWeight: 20, availablePlates: [0.5] })).toEqual({
      platesPerSide: [{ weight: 0.5, count: 1 }],
      loadedWeight: 21,
      shortfall: 0,
    });
  });

  it("rejects invalid targets but does not modify the recorded weight", () => {
    expect(calculatePlateLoad(40, standard)).toBeNull();
    expect(calculatePlateLoad(Number.NaN, standard)).toBeNull();
    expect(calculatePlateLoad(1000000, standard)).toBeNull();
  });
});
