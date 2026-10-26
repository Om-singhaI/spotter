export type Unit = "kg" | "lb";

const KG_PER_LB = 0.45359237;

// The API stores kilograms. The app shows the user's unit and rounds the way a plate
// loaded bar reads: pounds to the nearest 0.5, kilograms to the nearest 0.25.
export function fromKg(kg: number, unit: Unit): number {
  if (unit === "lb") return Math.round((kg / KG_PER_LB) * 2) / 2;
  return Math.round(kg * 4) / 4;
}

export function formatWeight(kg: number, unit: Unit): string {
  return `${fromKg(kg, unit)} ${unit}`;
}

// Epley estimate, rounded like the API and the database.
export function estimateOneRepMaxKg(weightKg: number, reps: number): number {
  // Work in whole grams so a tie like 91.8525 is exact, then round half away from zero
  // like Postgres does; plain float math lands just under the tie and rounds down.
  const grams = Math.round(weightKg * 1000);
  return Math.round((grams * (30 + reps)) / 30) / 1000;
}
