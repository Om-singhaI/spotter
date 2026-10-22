export type Workout = { id: string; started_at: string; finished_at: string | null };

export type WorkoutSet = {
  id: string;
  exercise_id: string;
  exercise_name: string;
  weight_kg: number;
  reps: number;
  rpe: number | null;
  is_warmup: boolean;
  performed_at: string;
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
