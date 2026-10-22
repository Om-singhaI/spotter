import { useCallback, useEffect, useState, type FormEvent } from "react";
import { apiDelete, apiGet, apiPost } from "../lib/api";
import { formatWeight, fromKg, type Unit } from "../lib/units";
import type { ExercisePick, WorkoutSet } from "./types";

type Props = {
  workoutId: string;
  exercise: ExercisePick;
  unit: Unit;
  sets: WorkoutSet[];
  onLogged: (set: WorkoutSet) => void;
  onDeleted: (setId: string) => void;
  onBack: () => void;
};

function SetLine({ set, unit, faded }: { set: WorkoutSet; unit: Unit; faded?: boolean }) {
  return (
    <span className={faded ? "text-zinc-500" : ""}>
      {formatWeight(set.weight_kg, unit)} × {set.reps}
      {set.is_warmup && <span className="ml-2 text-xs text-zinc-500">warmup</span>}
    </span>
  );
}

export default function ExercisePanel({
  workoutId,
  exercise,
  unit,
  sets,
  onLogged,
  onDeleted,
  onBack,
}: Props) {
  const [ghost, setGhost] = useState<WorkoutSet[] | "error" | null>(null);
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [warmup, setWarmup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadGhost = useCallback(() => {
    let active = true;
    setGhost(null);
    apiGet<{ sets: WorkoutSet[] }>(
      `/exercises/${encodeURIComponent(exercise.id)}/ghost?workout=${workoutId}`,
    )
      .then((data) => active && setGhost(data.sets))
      .catch(() => active && setGhost("error"));
    return () => {
      active = false;
    };
  }, [exercise.id, workoutId]);

  useEffect(loadGhost, [loadGhost]);

  // Prefill from the last set logged today, otherwise from last session's first set.
  // Only fills empty inputs, so it never replaces something the user typed.
  useEffect(() => {
    const source = sets.at(-1) ?? (Array.isArray(ghost) ? ghost[0] : undefined);
    if (source && weight === "" && reps === "") {
      setWeight(String(fromKg(source.weight_kg, unit)));
      setReps(String(source.reps));
    }
    // only when a new source appears
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sets.length, ghost]);

  async function logSet(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const { set } = await apiPost<{ set: WorkoutSet }>(`/workouts/${workoutId}/sets`, {
        exercise_id: exercise.id,
        weight: Number(weight),
        unit,
        reps: Number(reps),
        is_warmup: warmup,
      });
      onLogged(set);
      setWarmup(false);
    } catch {
      setError("Could not save that set.");
    } finally {
      setBusy(false);
    }
  }

  // Removing takes two taps so a mis-tap on the gym floor does not lose a set.
  async function remove(set: WorkoutSet) {
    if (removing) return;
    if (confirming !== set.id) {
      setConfirming(set.id);
      setTimeout(() => setConfirming((c) => (c === set.id ? null : c)), 4000);
      return;
    }
    setRemoving(set.id);
    setError(null);
    try {
      await apiDelete(`/sets/${set.id}`);
      onDeleted(set.id);
    } catch {
      setError("Could not remove that set.");
    } finally {
      setRemoving(null);
      setConfirming(null);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-3 text-center text-lg outline-none focus:border-zinc-600";

  return (
    <section className="rounded-2xl bg-zinc-900 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold">{exercise.name}</h2>
        <button type="button" onClick={onBack} className="min-h-11 px-3 text-sm text-zinc-400">
          Done
        </button>
      </div>

      <h3 className="text-xs font-semibold tracking-widest text-zinc-500 uppercase">Last time</h3>
      {ghost === null ? (
        <p role="status" className="mb-3 text-sm text-zinc-500">
          Loading…
        </p>
      ) : ghost === "error" ? (
        <p role="status" className="mb-3 text-sm text-zinc-500">
          Could not load last session.{" "}
          <button type="button" onClick={loadGhost} className="underline">
            Retry
          </button>
        </p>
      ) : ghost.length === 0 ? (
        <p role="status" className="mb-3 text-sm text-zinc-500">
          First time doing this. Set the bar.
        </p>
      ) : (
        <ol className="mb-3 flex flex-col gap-1 text-sm" aria-label="Last session">
          {ghost.map((s, i) => (
            <li key={s.id} className="flex gap-3">
              <span className="w-5 text-zinc-600">{i + 1}</span>
              <SetLine set={s} unit={unit} faded />
            </li>
          ))}
        </ol>
      )}

      <h3 className="text-xs font-semibold tracking-widest text-zinc-500 uppercase">Today</h3>
      <ol className="mb-3 flex flex-col gap-1 text-sm" aria-label="Today">
        {sets.map((s, i) => (
          <li key={s.id} className="flex items-center gap-3">
            <span className="w-5 text-zinc-600">{i + 1}</span>
            <SetLine set={s} unit={unit} />
            <button
              type="button"
              onClick={() => remove(s)}
              disabled={removing === s.id}
              aria-label={
                confirming === s.id ? `Confirm removing set ${i + 1}` : `Remove set ${i + 1}`
              }
              className={`ml-auto min-h-11 min-w-11 px-3 text-sm ${confirming === s.id ? "text-red-400" : "text-zinc-400"}`}
            >
              {confirming === s.id ? "sure?" : "remove"}
            </button>
          </li>
        ))}
      </ol>

      <form onSubmit={logSet} className="flex items-end gap-2">
        <label className="flex-1 text-xs text-zinc-400">
          Weight ({unit})
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            required
            className={inputClass}
          />
        </label>
        <label className="flex-1 text-xs text-zinc-400">
          Reps
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={1000}
            value={reps}
            onChange={(e) => setReps(e.target.value)}
            required
            className={inputClass}
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="min-h-11 rounded-xl bg-red-600 px-4 py-3 font-semibold disabled:opacity-60"
        >
          Log set
        </button>
      </form>
      <label className="mt-2 flex min-h-11 items-center gap-2 text-xs text-zinc-400">
        <input type="checkbox" checked={warmup} onChange={(e) => setWarmup(e.target.checked)} />
        warmup set
      </label>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-400">
          {error}
        </p>
      )}
    </section>
  );
}
