import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet, apiPost } from "../lib/api";
import type { Unit } from "../lib/units";
import { formatWeight } from "../lib/units";
import ExercisePanel from "../workout/ExercisePanel";
import ExercisePicker from "../workout/ExercisePicker";
import {
  groupByExercise,
  type CurrentWorkout,
  type ExercisePick,
  type WorkoutSet,
} from "../workout/types";

type Me = { weight_unit: Unit };
type Summary = { exercises: number; sets: number; records: number; discarded: boolean };

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export default function WorkoutPage() {
  // null until the profile answers, so a kg lifter never sees or logs in pounds
  const [unit, setUnit] = useState<Unit | null>(null);
  const [current, setCurrent] = useState<CurrentWorkout | null>(null);
  const [picking, setPicking] = useState(false);
  const [selected, setSelected] = useState<ExercisePick | null>(null);
  const [finished, setFinished] = useState<Summary | null>(null);
  const [starting, setStarting] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<Me>("/me")
      .then((me) => setUnit(me.weight_unit))
      .catch(() => setError("Could not load your settings."));
    apiGet<CurrentWorkout>("/workouts/current")
      .then(setCurrent)
      .catch(() => setError("Could not load your workout."));
  }, []);

  async function start() {
    if (starting) return;
    setStarting(true);
    setError(null);
    try {
      setCurrent(await apiPost<CurrentWorkout>("/workouts"));
      setFinished(null);
    } catch {
      setError("Could not start a workout.");
    } finally {
      setStarting(false);
    }
  }

  // Finishing is a two step tap when sets exist, since there is no way to reopen a workout.
  async function finish() {
    if (!current?.workout || finishing) return;
    if (current.sets.length > 0 && !confirmFinish) {
      setConfirmFinish(true);
      setTimeout(() => setConfirmFinish(false), 5000);
      return;
    }
    setFinishing(true);
    setError(null);
    try {
      const result = await apiPost<{ discarded: boolean }>(
        `/workouts/${current.workout.id}/finish`,
      );
      const groups = groupByExercise(current.sets);
      setFinished({
        exercises: groups.length,
        sets: current.sets.length,
        records: current.sets.filter((s) => s.records.length > 0).length,
        discarded: result.discarded,
      });
      setCurrent({ workout: null, sets: [] });
      setSelected(null);
    } catch {
      setError("Could not finish the workout.");
    } finally {
      setFinishing(false);
      setConfirmFinish(false);
    }
  }

  function logged(set: WorkoutSet) {
    setCurrent((c) => (c ? { ...c, sets: [...c.sets, set] } : c));
  }

  // Drop the set at once, then reload from the server: deleting can hand a record to a
  // later set, and only the server knows which.
  function deleted(setId: string) {
    setCurrent((c) => (c ? { ...c, sets: c.sets.filter((s) => s.id !== setId) } : c));
    apiGet<CurrentWorkout>("/workouts/current")
      .then(setCurrent)
      .catch(() => {});
  }

  const workout = current?.workout ?? null;
  const groups = groupByExercise(current?.sets ?? []);
  const ready = unit !== null;

  return (
    <main className="mx-auto min-h-screen max-w-2xl bg-zinc-950 p-4 text-zinc-100">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-black tracking-tight">Workout</h1>
        <Link to="/" className="text-sm text-zinc-400">
          Home
        </Link>
      </header>

      {error && (
        <p role="alert" className="mb-3 text-red-400">
          {error}
        </p>
      )}

      {current && !workout && (
        <section className="flex flex-col items-start gap-3">
          {finished && (
            <p role="status" className="text-zinc-300">
              {finished.discarded
                ? "Nothing was logged, so nothing was saved."
                : `Nice work. ${plural(finished.sets, "set")} across ${plural(finished.exercises, "exercise")}${
                    finished.records > 0 ? `, ${plural(finished.records, "new record")}` : ""
                  }, saved.`}
            </p>
          )}
          <button
            type="button"
            onClick={start}
            disabled={starting}
            className="min-h-11 rounded-full bg-red-600 px-6 py-3 font-semibold disabled:opacity-60"
          >
            Start a workout
          </button>
        </section>
      )}

      {workout && !ready && !error && <p className="text-zinc-500">Loading your settings…</p>}

      {workout && ready && selected && (
        <ExercisePanel
          workoutId={workout.id}
          exercise={selected}
          unit={unit}
          sets={(current?.sets ?? []).filter((s) => s.exercise_id === selected.id)}
          onLogged={logged}
          onDeleted={deleted}
          onBack={() => setSelected(null)}
        />
      )}

      {workout && ready && !selected && picking && (
        <ExercisePicker
          onPick={(ex) => {
            setPicking(false);
            setSelected(ex);
          }}
          onClose={() => setPicking(false)}
        />
      )}

      {workout && ready && !selected && !picking && (
        <section className="flex flex-col gap-3">
          <p className="text-sm text-zinc-500">
            Started{" "}
            {new Date(workout.started_at).toLocaleTimeString([], {
              hour: "numeric",
              minute: "2-digit",
            })}
          </p>
          <ul className="flex flex-col gap-2" aria-label="Exercises in this workout">
            {groups.map((g) => (
              <li key={g.exercise.id}>
                <button
                  type="button"
                  onClick={() => setSelected(g.exercise)}
                  className="flex min-h-11 w-full items-center justify-between rounded-xl bg-zinc-900 p-3 text-left"
                >
                  <span className="font-semibold">{g.exercise.name}</span>
                  <span className="text-sm text-zinc-400">
                    {plural(g.sets.length, "set")}
                    {` · best ${formatWeight(Math.max(...g.sets.map((s) => s.weight_kg)), unit)}`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setPicking(true)}
            className="min-h-11 rounded-full bg-red-600 px-6 py-3 font-semibold"
          >
            Add exercise
          </button>
          <button
            type="button"
            onClick={finish}
            disabled={finishing}
            className={`mt-4 min-h-11 rounded-full border px-6 py-3 font-semibold disabled:opacity-60 ${
              confirmFinish ? "border-red-500 text-red-400" : "border-zinc-700"
            }`}
          >
            {confirmFinish ? "Tap again to finish" : "Finish workout"}
          </button>
        </section>
      )}
    </main>
  );
}
