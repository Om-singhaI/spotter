import { sql } from "../db.js";

export type Workout = { id: string; started_at: Date; finished_at: Date | null };

export type WorkoutSet = {
  id: string;
  exercise_id: string;
  exercise_name: string;
  weight_kg: number;
  reps: number;
  rpe: number | null;
  is_warmup: boolean;
  performed_at: Date;
};

const NIL_UUID = "00000000-0000-0000-0000-000000000000";

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

export async function workoutSets(userId: string, workoutId: string): Promise<WorkoutSet[]> {
  return sql<WorkoutSet[]>`
    select s.id, s.exercise_id, e.name as exercise_name, s.weight_kg::float8 as weight_kg,
           s.reps, s.rpe::float8 as rpe, s.is_warmup, s.performed_at
    from public.workout_sets s
    join public.exercises e on e.id = s.exercise_id
    where s.workout_id = ${workoutId} and s.user_id = ${userId}
    order by s.performed_at, s.id
  `;
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

export type NewSet = { exerciseId: string; weightKg: number; reps: number; isWarmup: boolean };

export async function addSet(userId: string, workoutId: string, set: NewSet): Promise<WorkoutSet> {
  const [row] = await sql<WorkoutSet[]>`
    with inserted as (
      insert into public.workout_sets (workout_id, user_id, exercise_id, weight_kg, reps, is_warmup)
      values (${workoutId}, ${userId}, ${set.exerciseId}, ${set.weightKg}, ${set.reps}, ${set.isWarmup})
      returning id, exercise_id, weight_kg, reps, rpe, is_warmup, performed_at
    )
    select i.id, i.exercise_id, e.name as exercise_name, i.weight_kg::float8 as weight_kg,
           i.reps, i.rpe::float8 as rpe, i.is_warmup, i.performed_at
    from inserted i
    join public.exercises e on e.id = i.exercise_id
  `;
  return row;
}

// Only sets in the open workout can be removed, so a finished session never ends up empty.
export async function deleteSet(userId: string, setId: string): Promise<boolean> {
  const rows = await sql`
    delete from public.workout_sets s
    using public.workouts w
    where s.id = ${setId} and s.user_id = ${userId}
      and w.id = s.workout_id and w.user_id = s.user_id and w.finished_at is null
    returning s.id
  `;
  return rows.length > 0;
}

// The ghost row query from docs/database.md: the sets for this exercise from the most
// recent workout other than the one open right now.
export async function ghostRow(
  userId: string,
  exerciseId: string,
  currentWorkoutId: string | null,
): Promise<WorkoutSet[]> {
  return sql<WorkoutSet[]>`
    select s.id, s.exercise_id, e.name as exercise_name, s.weight_kg::float8 as weight_kg,
           s.reps, s.rpe::float8 as rpe, s.is_warmup, s.performed_at
    from public.workout_sets s
    join public.exercises e on e.id = s.exercise_id
    where s.user_id = ${userId}
      and s.exercise_id = ${exerciseId}
      and s.workout_id = (
        select p.workout_id
        from public.workout_sets p
        where p.user_id = ${userId}
          and p.exercise_id = ${exerciseId}
          and p.workout_id <> ${currentWorkoutId ?? NIL_UUID}
        order by p.performed_at desc
        limit 1
      )
    order by s.performed_at, s.id
  `;
}
