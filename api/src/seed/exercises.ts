// Loads the free exercise database into public.exercises. Safe to run again: rows are
// upserted by id. Pass a local JSON path as the first argument to skip the download.
//   npm run seed -w api
//   npm run seed -w api -- ./exercises.json
import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { sql } from "../db.js";

// Pinned to one commit so an upstream edit cannot break the seed or change the row count silently.
const DATASET_COMMIT = "f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5";
const SOURCE = `https://raw.githubusercontent.com/yuhonas/free-exercise-db/${DATASET_COMMIT}/dist/exercises.json`;

const Exercise = z.object({
  id: z.string().min(1).max(120),
  name: z.string().min(1).max(120),
  force: z.enum(["push", "pull", "static"]).nullable(),
  level: z.enum(["beginner", "intermediate", "expert"]),
  mechanic: z.enum(["compound", "isolation"]).nullable(),
  equipment: z.string().nullable(),
  primaryMuscles: z.array(z.string()),
  secondaryMuscles: z.array(z.string()),
  instructions: z.array(z.string()),
  category: z.string().min(1),
  images: z.array(z.string()),
});

async function load(): Promise<unknown> {
  const arg = process.argv[2];
  if (arg) {
    // npm sets INIT_CWD to the directory the command was typed in, even for workspace scripts
    const file = path.resolve(process.env.INIT_CWD ?? process.cwd(), arg);
    return JSON.parse(await readFile(file, "utf8"));
  }
  const res = await fetch(SOURCE);
  if (!res.ok) throw new Error(`download failed with status ${res.status}`);
  return res.json();
}

const exercises = z.array(Exercise).parse(await load());
const BATCH = 100;
let written = 0;

for (let i = 0; i < exercises.length; i += BATCH) {
  const rows = exercises.slice(i, i + BATCH).map((e) => ({
    id: e.id,
    name: e.name,
    force: e.force,
    level: e.level,
    mechanic: e.mechanic,
    equipment: e.equipment,
    primary_muscles: e.primaryMuscles,
    secondary_muscles: e.secondaryMuscles,
    instructions: e.instructions,
    category: e.category,
    images: e.images,
  }));
  await sql`
    insert into public.exercises ${sql(rows)}
    on conflict (id) do update set
      name = excluded.name,
      force = excluded.force,
      level = excluded.level,
      mechanic = excluded.mechanic,
      equipment = excluded.equipment,
      primary_muscles = excluded.primary_muscles,
      secondary_muscles = excluded.secondary_muscles,
      instructions = excluded.instructions,
      category = excluded.category,
      images = excluded.images
  `;
  written += rows.length;
}

const [{ count }] = await sql<{ count: number }[]>`
  select count(*)::int as count from public.exercises where owner_id is null
`;
console.log(`wrote ${written} exercises, the library now has ${count}`);
await sql.end();
