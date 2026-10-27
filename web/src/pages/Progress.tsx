import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { apiGet } from "../lib/api";
import { formatWeight, type Unit } from "../lib/units";
import ProgressChart from "../progress/ProgressChart";
import type { ExerciseHistory, ProgressPoint } from "../progress/types";

type Me = { weight_unit: Unit };

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const longDate = (iso: string) =>
  new Date(iso).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });

export default function ProgressPage() {
  const [unit, setUnit] = useState<Unit | null>(null);
  const [exercises, setExercises] = useState<ExerciseHistory[] | null>(null);
  const [points, setPoints] = useState<ProgressPoint[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [params, setParams] = useSearchParams();
  const selectedId = params.get("exercise");
  const selectedTab = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    apiGet<Me>("/me")
      .then((me) => setUnit(me.weight_unit))
      .catch(() => setError("Could not load your settings."));
    apiGet<{ exercises: ExerciseHistory[] }>("/progress")
      .then((data) => setExercises(data.exercises))
      .catch(() => setError("Could not load your history."));
  }, []);

  // Fall back to the most recently trained exercise when none is chosen, or when the
  // link names one with no loaded sets yet.
  useEffect(() => {
    if (!exercises || exercises.length === 0) return;
    if (!exercises.some((e) => e.id === selectedId)) {
      setParams({ exercise: exercises[0].id }, { replace: true });
    }
  }, [exercises, selectedId, setParams]);

  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    setPoints(null);
    setError(null);
    apiGet<{ points: ProgressPoint[] }>(`/exercises/${encodeURIComponent(selectedId)}/progress`)
      .then((data) => active && setPoints(data.points))
      .catch(() => active && setError("Could not load that exercise."));
    return () => {
      active = false;
    };
  }, [selectedId]);

  useEffect(() => {
    // optional call: jsdom has no scrollIntoView
    selectedTab.current?.scrollIntoView?.({ inline: "nearest", block: "nearest" });
  }, [selectedId]);

  function choose(id: string) {
    setParams({ exercise: id }, { replace: true });
  }

  // Left and right arrows move between exercises, as a tab list should.
  function onTabKey(e: KeyboardEvent<HTMLDivElement>) {
    if (!exercises || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
    const i = exercises.findIndex((x) => x.id === selectedId);
    const next =
      exercises[(i + (e.key === "ArrowRight" ? 1 : -1) + exercises.length) % exercises.length];
    choose(next.id);
    e.preventDefault();
  }

  const selected = exercises?.find((e) => e.id === selectedId) ?? null;
  // The headline compares finished sessions; the open workout still shows on the chart.
  const finished = points?.filter((p) => !p.in_progress) ?? [];
  const first = finished[0];
  const last = finished.at(-1);
  const change =
    first && last && finished.length > 1 && first.best_e1rm_kg > 0
      ? Math.round(((last.best_e1rm_kg - first.best_e1rm_kg) / first.best_e1rm_kg) * 100)
      : null;

  return (
    <main className="mx-auto min-h-screen max-w-2xl bg-zinc-950 p-4 text-zinc-100">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-black tracking-tight">Progress</h1>
        <Link to="/" className="text-sm text-zinc-400">
          Home
        </Link>
      </header>

      {error && (
        <p role="alert" className="mb-3 text-red-400">
          {error}
        </p>
      )}

      {exercises && exercises.length === 0 && (
        <p className="text-zinc-400">
          Nothing here yet.{" "}
          <Link to="/workout" className="underline">
            Log a workout
          </Link>{" "}
          and come back.
        </p>
      )}

      {exercises && exercises.length > 0 && (
        <div
          className="mb-4 flex gap-2 overflow-x-auto pb-1"
          role="tablist"
          aria-label="Exercises"
          onKeyDown={onTabKey}
        >
          {exercises.map((e) => (
            <button
              key={e.id}
              ref={e.id === selectedId ? selectedTab : null}
              type="button"
              role="tab"
              id={`tab-${e.id}`}
              aria-selected={e.id === selectedId}
              aria-controls="progress-panel"
              tabIndex={e.id === selectedId ? 0 : -1}
              onClick={() => choose(e.id)}
              className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-semibold ${
                e.id === selectedId ? "bg-red-600 text-white" : "bg-zinc-900 text-zinc-300"
              }`}
            >
              {e.name}
            </button>
          ))}
        </div>
      )}

      {selected && unit && points && (
        <section id="progress-panel" role="tabpanel" aria-labelledby={`tab-${selected.id}`}>
          <p className="mb-2 text-sm text-zinc-400">
            {plural(points.length, "session")}
            {change !== null && (
              <span
                className={`ml-2 font-semibold ${change >= 0 ? "text-green-400" : "text-red-400"}`}
              >
                {change >= 0 ? "+" : ""}
                {change}% since the first
              </span>
            )}
          </p>
          {points.length > 1 ? (
            <ProgressChart points={points} unit={unit} />
          ) : (
            <p className="mb-3 text-sm text-zinc-500">
              One session so far. The chart starts with the second.
            </p>
          )}
          <table className="mt-4 w-full text-sm">
            <thead className="text-left text-xs tracking-widest text-zinc-500 uppercase">
              <tr>
                <th className="py-1 font-semibold">Session</th>
                <th className="py-1 font-semibold">Top set</th>
                <th className="py-1 font-semibold">Est. 1RM</th>
                <th className="py-1 text-right font-semibold">Volume</th>
              </tr>
            </thead>
            <tbody>
              {[...points].reverse().map((p) => (
                <tr key={p.workout_id} className="border-t border-zinc-900">
                  <td className="py-2">
                    {longDate(p.started_at)}
                    {p.in_progress && (
                      <span className="ml-2 text-xs text-zinc-500">in progress</span>
                    )}
                  </td>
                  <td className="py-2">{formatWeight(p.top_weight_kg, unit)}</td>
                  <td className="py-2">{formatWeight(p.best_e1rm_kg, unit)}</td>
                  <td className="py-2 text-right text-zinc-400">
                    {plural(p.sets, "set")} · {formatWeight(p.volume_kg, unit)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}
