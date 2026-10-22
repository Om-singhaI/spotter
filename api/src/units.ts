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
