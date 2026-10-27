export type ExerciseHistory = {
  id: string;
  name: string;
  sessions: number;
  last_performed_at: string;
};

export type ProgressPoint = {
  workout_id: string;
  started_at: string;
  best_e1rm_kg: number;
  top_weight_kg: number;
  volume_kg: number;
  sets: number;
  in_progress: boolean;
};
