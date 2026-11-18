import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet } from "../lib/api";
import { formatWeight, type Unit } from "../lib/units";
import { groupByExercise, recordLabels, type Workout, type WorkoutSet } from "../workout/types";

type HistoryEntry = Workout & {
  exercise_count: number;
  set_count: number;
  record_count: number;
};
type HistoryPage = { workouts: HistoryEntry[]; has_more: boolean };
type WorkoutDetail = { workout: Workout; sets: WorkoutSet[] };

const PAGE_SIZE = 20;
const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`;

function dateLabel(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function HistoryPage() {
  const [unit, setUnit] = useState<Unit | null>(null);
  const [workouts, setWorkouts] = useState<HistoryEntry[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, WorkoutDetail>>({});
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      apiGet<{ weight_unit: Unit }>("/me"),
      apiGet<HistoryPage>(`/workouts/history?limit=${PAGE_SIZE}&offset=0`),
    ])
      .then(([me, page]) => {
        if (!active) return;
        setUnit(me.weight_unit);
        setWorkouts(page.workouts);
        setHasMore(page.has_more);
      })
      .catch(() => {
        if (active) setError("Could not load workout history.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function loadMore() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      const page = await apiGet<HistoryPage>(
        `/workouts/history?limit=${PAGE_SIZE}&offset=${workouts.length}`,
      );
      setWorkouts((previous) => [...previous, ...page.workouts]);
      setHasMore(page.has_more);
    } catch {
      setError("Could not load more workouts.");
    } finally {
      setLoadingMore(false);
    }
  }

  async function fetchDetail(id: string) {
    setDetailError(null);
    setLoadingDetail(id);
    try {
      const detail = await apiGet<WorkoutDetail>(`/workouts/${id}`);
      setDetails((previous) => ({ ...previous, [id]: detail }));
    } catch {
      setDetailError(id);
    } finally {
      setLoadingDetail((current) => (current === id ? null : current));
    }
  }

  async function toggleDetail(id: string) {
    if (openId === id) {
      setOpenId(null);
      return;
    }
    setOpenId(id);
    if (!details[id]) await fetchDetail(id);
  }

  return (
    <main className="mx-auto min-h-screen max-w-2xl bg-zinc-950 p-4 text-zinc-100">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-black tracking-tight">Workout history</h1>
        <Link to="/" className="text-sm text-zinc-400">
          Home
        </Link>
      </header>

      {loading && (
        <p role="status" className="text-zinc-400">
          Loading workout history…
        </p>
      )}
      {error && (
        <p role="alert" className="mb-3 text-red-400">
          {error}
        </p>
      )}

      {!loading && !error && workouts.length === 0 && (
        <section className="rounded-2xl bg-zinc-900 p-4">
          <p className="mb-3 text-zinc-300">No completed workouts yet.</p>
          <Link to="/workout" className="text-sm font-semibold text-red-400">
            Log a workout
          </Link>
        </section>
      )}

      {!loading && workouts.length > 0 && (
        <>
          <ul aria-label="Completed workouts" className="flex flex-col gap-3">
            {workouts.map((entry) => {
              const expanded = openId === entry.id;
              const detail = details[entry.id];
              return (
                <li key={entry.id} className="rounded-2xl bg-zinc-900 p-4">
                  <button
                    type="button"
                    aria-expanded={expanded}
                    aria-controls={`history-${entry.id}`}
                    onClick={() => void toggleDetail(entry.id)}
                    className="flex min-h-11 w-full items-center justify-between gap-3 text-left"
                  >
                    <span>
                      <span className="block font-semibold">{dateLabel(entry.started_at)}</span>
                      <span className="mt-1 block text-sm text-zinc-400">
                        {plural(entry.exercise_count, "exercise")} ·{" "}
                        {plural(entry.set_count, "set")}
                        {entry.record_count > 0 ? ` · ${plural(entry.record_count, "record")}` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm text-zinc-400">
                      {expanded ? "Hide" : "View"}
                    </span>
                  </button>

                  {expanded && (
                    <div id={`history-${entry.id}`} className="mt-4 border-t border-zinc-800 pt-4">
                      {loadingDetail === entry.id && <p role="status">Loading sets…</p>}
                      {detailError === entry.id && (
                        <div>
                          <p role="alert" className="mb-2 text-red-400">
                            Could not load workout details.
                          </p>
                          <button
                            type="button"
                            className="text-sm text-red-400 underline"
                            onClick={() => void fetchDetail(entry.id)}
                          >
                            Retry
                          </button>
                        </div>
                      )}
                      {detail && unit && (
                        <div className="flex flex-col gap-4">
                          {groupByExercise(detail.sets).map(({ exercise, sets }) => (
                            <section key={exercise.id}>
                              <h2 className="mb-2 font-semibold">{exercise.name}</h2>
                              <ol className="flex flex-col gap-2 text-sm">
                                {sets.map((set, index) => (
                                  <li key={set.id} className="rounded-lg bg-zinc-950 p-3">
                                    <span className="text-zinc-300">
                                      {index + 1}. {formatWeight(set.weight_kg, unit)} × {set.reps}{" "}
                                      reps
                                      {set.is_warmup ? " · Warmup" : ""}
                                    </span>
                                    {set.records.length > 0 && (
                                      <p className="mt-1 text-amber-400">
                                        Record: {recordLabels(set.records)}
                                      </p>
                                    )}
                                  </li>
                                ))}
                              </ol>
                            </section>
                          ))}
                          {detail.sets.length === 0 && (
                            <p className="text-sm text-zinc-400">No sets recorded.</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          {hasMore && (
            <button
              type="button"
              onClick={() => void loadMore()}
              disabled={loadingMore}
              className="mt-4 min-h-11 w-full rounded-full border border-zinc-700 px-5 py-2 font-semibold disabled:opacity-60"
            >
              {loadingMore ? "Loading…" : "Load more"}
            </button>
          )}
        </>
      )}
    </main>
  );
}
