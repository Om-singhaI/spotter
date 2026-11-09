import type { PlateSettings } from "./plateSettings";

export type LoadedPlate = { weight: number; count: number };
export type PlateLoad = {
  platesPerSide: LoadedPlate[];
  loadedWeight: number;
  shortfall: number;
};

// A preview only: never change the weight the user actually records.
// All selectable plates are multiples of 0.25, so integer quarter-units
// avoid rounding errors and make exact combinations possible.
const QUARTERS = 4;
const MAX_PREVIEW_WEIGHT = 5000;
const UNREACHABLE = 1_000_000;

export function calculatePlateLoad(target: number, settings: PlateSettings): PlateLoad | null {
  const { barWeight } = settings;
  if (
    !Number.isFinite(target) ||
    !Number.isFinite(barWeight) ||
    barWeight <= 0 ||
    target < barWeight ||
    target > MAX_PREVIEW_WEIGHT ||
    !settings.availablePlates.length
  ) {
    return null;
  }

  const denominations = [...new Set(settings.availablePlates)]
    .filter((weight) => Number.isFinite(weight) && weight > 0)
    .sort((a, b) => b - a)
    .map((weight) => ({ weight, ticks: Math.round(weight * QUARTERS) }))
    .filter(({ weight, ticks }) => Math.abs(weight * QUARTERS - ticks) < 1e-8);

  if (denominations.length === 0) return null;

  // Symmetric loading: the target minus the bar is divided across BOTH sleeves.
  const targetSideTicks = Math.max(0, Math.floor(((target - barWeight) / 2) * QUARTERS + 1e-8));
  const fewest = new Int32Array(targetSideTicks + 1).fill(UNREACHABLE);
  const lastPlate = new Int16Array(targetSideTicks + 1).fill(-1);
  fewest[0] = 0;

  for (let total = 1; total <= targetSideTicks; total++) {
    denominations.forEach(({ ticks }, index) => {
      if (ticks > total || fewest[total - ticks] === UNREACHABLE) return;
      const count = fewest[total - ticks] + 1;
      if (count < fewest[total]) {
        fewest[total] = count;
        lastPlate[total] = index;
      }
    });
  }

  // If the target cannot be loaded, use the greatest weight below the target.
  let loadedSideTicks = targetSideTicks;
  while (loadedSideTicks > 0 && fewest[loadedSideTicks] === UNREACHABLE) loadedSideTicks--;

  const counts = new Map<number, number>();
  for (let remaining = loadedSideTicks; remaining > 0;) {
    const denomination = denominations[lastPlate[remaining]];
    counts.set(denomination.weight, (counts.get(denomination.weight) ?? 0) + 1);
    remaining -= denomination.ticks;
  }

  const loadedWeight = barWeight + (2 * loadedSideTicks) / QUARTERS;
  return {
    platesPerSide: denominations
      .filter(({ weight }) => counts.has(weight))
      .map(({ weight }) => ({ weight, count: counts.get(weight)! })),
    loadedWeight,
    shortfall: Math.max(0, Math.round((target - loadedWeight) * 1000) / 1000),
  };
}
