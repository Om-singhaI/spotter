export type Workout = { id: string; started_at: string; finished_at: string | null };

export type WorkoutSet = {
  id: string;
  exercise_id: string;
  exercise_name: string;
  weight_kg: number;
  reps: number;
  rpe: number | null;
  is_warmup: boolean;
  e1rm_kg: number;
  performed_at: string;
  records: string[];
};

export type CurrentWorkout = { workout: Workout | null; sets: WorkoutSet[] };

export type ExercisePick = { id: string; name: string };

// Sets grouped by exercise in the order the exercises first appeared in the workout.
export function groupByExercise(
  sets: WorkoutSet[],
): { exercise: ExercisePick; sets: WorkoutSet[] }[] {
  const groups = new Map<string, { exercise: ExercisePick; sets: WorkoutSet[] }>();
  for (const s of sets) {
    const g = groups.get(s.exercise_id);
    if (g) g.sets.push(s);
    else
      groups.set(s.exercise_id, {
        exercise: { id: s.exercise_id, name: s.exercise_name },
        sets: [s],
      });
  }
  return [...groups.values()];
}

export type Best = {
  best_e1rm_kg: number;
  best_weight_kg: number;
  best_set: { weight_kg: number; reps: number; performed_at: string };
};

export const RECORD_LABELS: Record<string, string> = {
  max_weight: "heaviest weight",
  max_reps_at_weight: "most reps at this weight",
  max_e1rm: "best estimated one rep max",
};

export function recordLabels(kinds: string[]): string {
  return kinds.map((k) => RECORD_LABELS[k] ?? k).join(", ");
}
