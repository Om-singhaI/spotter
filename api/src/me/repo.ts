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
