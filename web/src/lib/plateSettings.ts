import type { Unit } from "./units";

export type PlateSettings = {
  barWeight: number;
  availablePlates: number[];
};

// Sizes are in the user's display unit, not the kilograms stored by the API.
export const PLATE_OPTIONS: Record<Unit, readonly number[]> = {
  lb: [55, 45, 35, 25, 10, 5, 2.5, 1.25],
  kg: [25, 20, 15, 10, 5, 2.5, 1.25, 0.5],
};

export function defaultPlateSettings(unit: Unit): PlateSettings {
  return {
    barWeight: unit === "lb" ? 45 : 20,
    // 55 lb plates are available to select, but not assumed to exist at every gym.
    availablePlates: unit === "lb" ? [45, 35, 25, 10, 5, 2.5] : [...PLATE_OPTIONS.kg],
  };
}

function storageKey(userId: string, unit: Unit): string {
  return `spotter:plates:v1:${userId}:${unit}`;
}

export function loadPlateSettings(userId: string, unit: Unit): PlateSettings {
  const defaults = defaultPlateSettings(unit);
  try {
    const raw = localStorage.getItem(storageKey(userId, unit));
    if (!raw) return defaults;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return defaults;
    const record = value as Record<string, unknown>;
    const selected = record.availablePlates;
    if (
      typeof record.barWeight !== "number" ||
      !Number.isFinite(record.barWeight) ||
      record.barWeight <= 0 ||
      !Array.isArray(selected) ||
      selected.length === 0 ||
      !selected.every((plate: unknown) => PLATE_OPTIONS[unit].includes(plate as number))
    ) {
      return defaults;
    }
    return {
      barWeight: record.barWeight,
      availablePlates: PLATE_OPTIONS[unit].filter((plate) => selected.includes(plate)),
    };
  } catch {
    // A malformed or inaccessible localStorage value should never break the account page.
    return defaults;
  }
}

export function savePlateSettings(userId: string, unit: Unit, settings: PlateSettings): boolean {
  try {
    localStorage.setItem(storageKey(userId, unit), JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}
