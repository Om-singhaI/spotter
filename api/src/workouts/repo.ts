import { sql } from "../db.js";
import type { TransactionSql } from "postgres";

export type Workout = { id: string; started_at: Date; finished_at: Date | null };

export type WorkoutSet = {
  id: string;
  exercise_id: string;
  exercise_name: string;
  weight_kg: number;
  reps: number;
  rpe: number | null;
  is_warmup: boolean;
  e1rm_kg: number;
  performed_at: Date;
  // personal record kinds this set earned: max_weight, max_reps_at_weight, max_e1rm
  records: string[];
};

export type Best = {
  best_e1rm_kg: number;
  best_weight_kg: number;
  best_set: { weight_kg: number; reps: number; performed_at: Date };
};

const NIL_UUID = "00000000-0000-0000-0000-000000000000";

type Db = typeof sql | TransactionSql;

// One shape for every set the API returns, with the records it earned attached.
function setRows(db: Db, where: ReturnType<typeof sql>) {
  return db<WorkoutSet[]>`
    select s.id, s.exercise_id, e.name as exercise_name, s.weight_kg::float8 as weight_kg,
           s.reps, s.rpe::float8 as rpe, s.is_warmup, s.e1rm_kg::float8 as e1rm_kg, s.performed_at,
           coalesce(array_agg(r.kind order by r.kind) filter (where r.kind is not null), '{}') as records
    from public.workout_sets s
    join public.exercises e on e.id = s.exercise_id
    left join public.personal_records r on r.set_id = s.id
    where ${where}
    group by s.id, e.name
    order by s.performed_at, s.id
  `;
}

export async function openWorkout(userId: string): Promise<Workout | null> {
  const [row] = await sql<Workout[]>`
    select id, started_at, finished_at
    from public.workouts
    where user_id = ${userId} and finished_at is null
    order by started_at desc
    limit 1
  `;
  return row ?? null;
}

// Null means another request opened a workout first (the partial unique index on open
// workouts refused this one); the caller then returns that workout instead.
export async function startWorkout(userId: string): Promise<Workout | null> {
  const [row] = await sql<Workout[]>`
    insert into public.workouts (user_id) values (${userId})
    on conflict (user_id) where finished_at is null do nothing
    returning id, started_at, finished_at
  `;
  return row ?? null;
}

// Finishing twice is harmless: the second call returns the workout as it already is.
export async function finishWorkout(userId: string, workoutId: string): Promise<Workout | null> {
  const [row] = await sql<Workout[]>`
    update public.workouts
    set finished_at = coalesce(finished_at, now())
    where id = ${workoutId} and user_id = ${userId}
    returning id, started_at, finished_at
  `;
  return row ?? null;
}

// Finishing a workout with nothing in it deletes it instead, so streaks and the
// leaderboard never count an empty session.
export async function discardIfEmpty(userId: string, workoutId: string): Promise<boolean> {
  const rows = await sql`
    delete from public.workouts w
    where w.id = ${workoutId} and w.user_id = ${userId} and w.finished_at is null
      and not exists (select 1 from public.workout_sets s where s.workout_id = w.id)
    returning w.id
  `;
  return rows.length > 0;
}

export function workoutSets(userId: string, workoutId: string): Promise<WorkoutSet[]> {
  return setRows(sql, sql`s.workout_id = ${workoutId} and s.user_id = ${userId}`);
}

// A set may only point at a library exercise or a custom one the same user owns.
export async function canLogExercise(userId: string, exerciseId: string): Promise<boolean> {
  const [row] = await sql<{ ok: boolean }[]>`
    select exists (
      select 1 from public.exercises
      where id = ${exerciseId} and (owner_id is null or owner_id = ${userId})
    ) as ok
  `;
  return row.ok;
}

// The record check from docs/database.md. Inserts a personal_records row for each kind
// the set beat and returns those kinds. A warmup set matches nothing and inserts nothing.
async function recordCheck(
  db: Db,
  userId: string,
  exerciseId: string,
  setId: string,
): Promise<string[]> {
  const rows = await db<{ kind: string }[]>`
    with n as (
      select id, user_id, exercise_id, weight_kg, reps, e1rm_kg, performed_at
      from public.workout_sets
      where id = ${setId} and user_id = ${userId} and exercise_id = ${exerciseId} and not is_warmup
    ),
    b as (
      select
        max(s.weight_kg) as max_weight,
        max(s.e1rm_kg) as max_e1rm,
        max(s.reps) filter (where s.weight_kg = n.weight_kg) as reps_at_weight
      from public.workout_sets s, n
      where s.user_id = n.user_id
        and s.exercise_id = n.exercise_id
        and not s.is_warmup
        and s.performed_at < n.performed_at
    ),
    k as (
      select unnest(array['max_weight', 'max_reps_at_weight', 'max_e1rm']) as kind
    )
    insert into public.personal_records (user_id, exercise_id, set_id, kind, achieved_at)
    select n.user_id, n.exercise_id, n.id, k.kind, n.performed_at
    from n, b, k
    where (k.kind = 'max_weight' and n.weight_kg > 0 and (b.max_weight is null or n.weight_kg > b.max_weight))
       or (k.kind = 'max_e1rm' and n.weight_kg > 0 and (b.max_e1rm is null or n.e1rm_kg > b.max_e1rm))
       or (k.kind = 'max_reps_at_weight' and n.reps > b.reps_at_weight)
    on conflict (set_id, kind) do nothing
    returning kind
  `;
  return rows.map((r) => r.kind);
}

export type NewSet = { exerciseId: string; weightKg: number; reps: number; isWarmup: boolean };

// Saves the set and checks it for records in one transaction, so a crash between the
// two can never leave a set without its record rows.
// Serialises record work for one user and exercise. Transaction scoped, so it is released
// at commit and safe behind Supabase's transaction mode pooler.
function lockRecords(tx: TransactionSql, userId: string, exerciseId: string) {
  return tx`select pg_advisory_xact_lock(hashtext(${userId + ":" + exerciseId}))`;
}

export async function addSet(userId: string, workoutId: string, set: NewSet): Promise<WorkoutSet> {
  return sql.begin(async (tx) => {
    await lockRecords(tx, userId, set.exerciseId);
    const [inserted] = await tx<{ id: string }[]>`
      insert into public.workout_sets (workout_id, user_id, exercise_id, weight_kg, reps, is_warmup)
      values (${workoutId}, ${userId}, ${set.exerciseId}, ${set.weightKg}, ${set.reps}, ${set.isWarmup})
      returning id
    `;
    await recordCheck(tx, userId, set.exerciseId, inserted.id);
    const [row] = await setRows(tx, tx`s.id = ${inserted.id}`);
    return row;
  });
}

// Only sets in the open workout can be removed, so a finished session never ends up
// empty. Records for the exercise are then rebuilt from the deleted set's time onward,
// since only later sets can have been measured against it.
export async function deleteSet(userId: string, setId: string): Promise<boolean> {
  return sql.begin(async (tx) => {
    const rows = await tx<{ exercise_id: string; performed_at: Date; is_warmup: boolean }[]>`
      delete from public.workout_sets s
      using public.workouts w
      where s.id = ${setId} and s.user_id = ${userId}
        and w.id = s.workout_id and w.user_id = s.user_id and w.finished_at is null
      returning s.exercise_id, s.performed_at, s.is_warmup
    `;
    if (rows.length === 0) return false;
    const gone = rows[0];
    if (!gone.is_warmup) {
      await lockRecords(tx, userId, gone.exercise_id);
      await recomputeRecords(tx, userId, gone.exercise_id, gone.performed_at);
    }
    return true;
  });
}

// Delete and replay, as docs/database.md prescribes, scoped to sets from a point in time.
async function recomputeRecords(
  tx: TransactionSql,
  userId: string,
  exerciseId: string,
  since: Date,
) {
  await tx`
    delete from public.personal_records
    where user_id = ${userId} and exercise_id = ${exerciseId} and achieved_at >= ${since}
  `;
  const sets = await tx<{ id: string }[]>`
    select id from public.workout_sets
    where user_id = ${userId} and exercise_id = ${exerciseId} and not is_warmup
      and performed_at >= ${since}
    order by performed_at, id
  `;
  for (const s of sets) await recordCheck(tx, userId, exerciseId, s.id);
}

// The ghost row query from docs/database.md: the sets for this exercise from the most
// recent workout other than the one open right now.
export function ghostRow(
  userId: string,
  exerciseId: string,
  currentWorkoutId: string | null,
): Promise<WorkoutSet[]> {
  return setRows(
    sql,
    sql`s.user_id = ${userId}
      and s.exercise_id = ${exerciseId}
      and s.workout_id = (
        select p.workout_id
        from public.workout_sets p
        where p.user_id = ${userId}
          and p.exercise_id = ${exerciseId}
          and p.workout_id <> ${currentWorkoutId ?? NIL_UUID}
        order by p.performed_at desc
        limit 1
      )`,
  );
}

// All time bests for an exercise from non warmup sets, and the set behind the estimate.
export async function best(userId: string, exerciseId: string): Promise<Best | null> {
  const [row] = await sql<
    {
      best_e1rm_kg: number;
      best_weight_kg: number;
      weight_kg: number;
      reps: number;
      performed_at: Date;
    }[]
  >`
    select
      (select max(e1rm_kg)::float8 from public.workout_sets
        where user_id = ${userId} and exercise_id = ${exerciseId} and not is_warmup and weight_kg > 0) as best_e1rm_kg,
      (select max(weight_kg)::float8 from public.workout_sets
        where user_id = ${userId} and exercise_id = ${exerciseId} and not is_warmup and weight_kg > 0) as best_weight_kg,
      s.weight_kg::float8 as weight_kg, s.reps, s.performed_at
    from public.workout_sets s
    where s.user_id = ${userId} and s.exercise_id = ${exerciseId} and not s.is_warmup and s.weight_kg > 0
    order by s.e1rm_kg desc, s.performed_at
    limit 1
  `;
  if (!row) return null;
  return {
    best_e1rm_kg: row.best_e1rm_kg,
    best_weight_kg: row.best_weight_kg,
    best_set: { weight_kg: row.weight_kg, reps: row.reps, performed_at: row.performed_at },
  };
}

// Full rebuild of one exercise's records, for seeds and admin repair.
export function rebuildRecords(userId: string, exerciseId: string): Promise<void> {
  return sql.begin(async (tx) => {
    await lockRecords(tx, userId, exerciseId);
    await recomputeRecords(tx, userId, exerciseId, new Date(0));
  });
}
