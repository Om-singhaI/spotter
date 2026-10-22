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
