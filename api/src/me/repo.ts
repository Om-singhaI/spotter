import { sql } from "../db.js";

export type Profile = {
  id: string;
  display_name: string;
  weight_unit: "kg" | "lb";
  share_numbers: boolean;
};

// The profile row is created on the first authenticated request, so there is no auth trigger.
export async function ensureProfile(id: string, fallbackName: string): Promise<Profile> {
  await sql`
    insert into public.profiles (id, display_name)
    values (${id}, ${fallbackName})
    on conflict (id) do nothing
  `;
  const [row] = await sql<Profile[]>`
    select id, display_name, weight_unit, share_numbers
    from public.profiles
    where id = ${id}
  `;
  return row;
}

// Only the authenticated user's display preference is updated; workout data remains in kg.
export async function updateWeightUnit(id: string, unit: "kg" | "lb"): Promise<Profile> {
  const [row] = await sql<Profile[]>`
    update public.profiles
    set weight_unit = ${unit}
    where id = ${id}
    returning id, display_name, weight_unit, share_numbers
  `;
  return row;
}
