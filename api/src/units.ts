export type Unit = "kg" | "lb";

const KG_PER_LB = 0.45359237;

// Weights are stored in kilograms with three decimals, which keeps any pound value a
// person types within a few thousandths of a pound.
export function toKg(weight: number, unit: Unit): number {
  const kg = unit === "lb" ? weight * KG_PER_LB : weight;
  return Math.round(kg * 1000) / 1000;
}

export function fromKg(kg: number, unit: Unit): number {
  const w = unit === "lb" ? kg / KG_PER_LB : kg;
  return Math.round(w * 100) / 100;
}

// Epley estimate, rounded the same way as the database's generated e1rm_kg column so the
// number the app shows for a set never disagrees with what the record check used.
export function estimateOneRepMaxKg(weightKg: number, reps: number): number {
  // Work in whole grams so a tie like 91.8525 is exact, then round half away from zero
  // like Postgres does; plain float math lands just under the tie and rounds down.
  const grams = Math.round(weightKg * 1000);
  return Math.round((grams * (30 + reps)) / 30) / 1000;
}
