import type { PlateSettings } from "./plateSettings";

export type LoadedPlate = { weight: number; count: number };
export type PlateLoad = {
  platesPerSide: LoadedPlate[];
  loadedWeight: number;
  // Signed difference between the suggested and requested weight.
  // Positive means over, negative means under, zero means exact.
  difference: number;
};

// All selectable plates are multiples of 0.25. Integer quarter-units avoid
// floating-point errors in the combination search.
const QUARTERS = 4;
const MAX_PREVIEW_WEIGHT = 5000;
const UNREACHABLE = 1_000_000;

// Bar weight and entered targets can have other decimal precision.
function roundWeight(value: number): number {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

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

  // Every load is symmetric: (total - bar) / 2 goes on each sleeve.
  const requestedSideTicks = ((target - barWeight) / 2) * QUARTERS;
  const smallestPlateTicks = Math.min(...denominations.map((plate) => plate.ticks));
  // A multiple of the smallest plate always supplies an achievable load above
  // the target. Search through it so "closest" considers BOTH directions.
  const searchLimit = Math.ceil(requestedSideTicks) + smallestPlateTicks;
  const fewest = new Int32Array(searchLimit + 1).fill(UNREACHABLE);
  const lastPlate = new Int16Array(searchLimit + 1).fill(-1);
  fewest[0] = 0;

  for (let total = 1; total <= searchLimit; total++) {
    denominations.forEach(({ ticks }, index) => {
      if (ticks > total || fewest[total - ticks] === UNREACHABLE) return;
      const count = fewest[total - ticks] + 1;
      if (count < fewest[total]) {
        fewest[total] = count;
        lastPlate[total] = index;
      }
    });
  }

  // Pick the nearest achievable load. Prefer fewer plates for an equally
  // close result; on a remaining tie, prefer not exceeding the target.
  let loadedSideTicks = 0;
  for (let ticks = 1; ticks <= searchLimit; ticks++) {
    if (fewest[ticks] === UNREACHABLE) continue;
    const distance = Math.abs(ticks - requestedSideTicks);
    const bestDistance = Math.abs(loadedSideTicks - requestedSideTicks);
    if (
      distance < bestDistance - 1e-8 ||
      (Math.abs(distance - bestDistance) <= 1e-8 &&
        (fewest[ticks] < fewest[loadedSideTicks] ||
          (fewest[ticks] === fewest[loadedSideTicks] && ticks < loadedSideTicks)))
    ) {
      loadedSideTicks = ticks;
    }
  }

  const counts = new Map<number, number>();
  for (let remaining = loadedSideTicks; remaining > 0;) {
    const denomination = denominations[lastPlate[remaining]];
    counts.set(denomination.weight, (counts.get(denomination.weight) ?? 0) + 1);
    remaining -= denomination.ticks;
  }

  const loadedWeight = roundWeight(barWeight + (2 * loadedSideTicks) / QUARTERS);
  return {
    platesPerSide: denominations
      .filter(({ weight }) => counts.has(weight))
      .map(({ weight }) => ({ weight, count: counts.get(weight)! })),
    loadedWeight,
    difference: roundWeight(loadedWeight - target),
  };
}
