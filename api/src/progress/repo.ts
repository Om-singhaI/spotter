import { sql } from "../db.js";

export type ExerciseHistory = {
  id: string;
  name: string;
  sessions: number;
  last_performed_at: Date;
};

export type ProgressPoint = {
  workout_id: string;
  started_at: Date;
  best_e1rm_kg: number;
  top_weight_kg: number;
  volume_kg: number;
  sets: number;
  in_progress: boolean;
};

// Every exercise the user has logged a loaded working set for, most recent first.
// Bodyweight sets (weight 0) have no estimate to chart, so they are left out here.
export function exercisesWithHistory(userId: string): Promise<ExerciseHistory[]> {
  return sql<ExerciseHistory[]>`
    select e.id, e.name, count(distinct s.workout_id)::int as sessions, max(s.performed_at) as last_performed_at
    from public.workout_sets s
    join public.exercises e on e.id = s.exercise_id
    where s.user_id = ${userId} and not s.is_warmup and s.weight_kg > 0
    group by e.id, e.name
    order by max(s.performed_at) desc
  `;
}

// One point per workout, oldest first: the best estimate, the top weight, and the volume
// of that session's working sets. The open workout is included so today shows up live.
export async function exerciseProgress(
  userId: string,
  exerciseId: string,
  limit = 52,
): Promise<ProgressPoint[]> {
  const rows = await sql<ProgressPoint[]>`
    select w.id as workout_id, w.started_at,
           max(s.e1rm_kg)::float8 as best_e1rm_kg,
           max(s.weight_kg)::float8 as top_weight_kg,
           sum(s.weight_kg * s.reps)::float8 as volume_kg,
           count(*)::int as sets,
           (w.finished_at is null) as in_progress
    from public.workout_sets s
    join public.workouts w on w.id = s.workout_id
    where s.user_id = ${userId} and s.exercise_id = ${exerciseId} and not s.is_warmup and s.weight_kg > 0
    group by w.id, w.started_at, w.finished_at
    order by w.started_at desc
    limit ${limit}
  `;
  return rows.reverse();
}
