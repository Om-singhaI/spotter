import { sql } from "../db.js";

export type ExerciseSummary = {
  id: string;
  name: string;
  category: string;
  equipment: string | null;
  primary_muscles: string[];
  secondary_muscles: string[];
  images: string[];
};

// Escape the characters that mean something to LIKE, so a search for "100%" is literal.
export function likePattern(q: string, anchored = false): string {
  const escaped = q.replace(/[\\%_]/g, (c) => "\\" + c);
  return anchored ? escaped + "%" : "%" + escaped + "%";
}

// Library exercises only (owner_id is null). Names that start with the search term come
// first, then everything that contains it in the name or a primary muscle.
export async function searchExercises(q: string, limit: number): Promise<ExerciseSummary[]> {
  const term = q.trim();
  const contains = likePattern(term);
  const starts = likePattern(term, true);
  return sql<ExerciseSummary[]>`
    select id, name, category, equipment, primary_muscles, secondary_muscles, images
    from public.exercises
    where owner_id is null
      and (
        ${term === ""}
        or name ilike ${contains}
        or array_to_string(primary_muscles, ' ') ilike ${contains}
      )
    order by (name ilike ${starts}) desc, name
    limit ${limit}
  `;
}
