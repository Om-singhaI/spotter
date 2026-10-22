import { useEffect, useState } from "react";
import { apiGet } from "../lib/api";
import type { ExercisePick } from "./types";

type Props = { onPick: (exercise: ExercisePick) => void; onClose: () => void };

export default function ExercisePicker({ onPick, onClose }: Props) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ExercisePick[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let active = true;
    const handle = setTimeout(() => {
      setState("loading");
      apiGet<{ exercises: ExercisePick[] }>(`/exercises?q=${encodeURIComponent(q)}&limit=12`)
        .then((data) => {
          if (!active) return;
          setResults(data.exercises);
          setState("ready");
        })
        .catch(() => active && setState("error"));
    }, 200);
    return () => {
      active = false;
      clearTimeout(handle);
    };
  }, [q]);

  const status =
    state === "error"
      ? "Could not reach the API."
      : state === "loading"
        ? "Loading…"
        : results.length === 0
          ? "Nothing matches that."
          : "";

  return (
    <section className="rounded-2xl bg-zinc-900 p-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-semibold">Add an exercise</h2>
        <button type="button" onClick={onClose} className="min-h-11 px-3 text-sm text-zinc-400">
          Cancel
        </button>
      </div>
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search the library"
        aria-label="Search the library"
        autoFocus
        className="mb-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-base outline-none focus:border-zinc-600"
      />
      <p role="status" aria-live="polite" className="mb-1 min-h-5 text-sm text-zinc-500">
        {status}
      </p>
      <ul className="flex flex-col gap-1" aria-busy={state === "loading"}>
        {results.map((ex) => (
          <li key={ex.id}>
            <button
              type="button"
              onClick={() => onPick(ex)}
              className="min-h-11 w-full rounded-lg px-3 py-2 text-left hover:bg-zinc-800"
            >
              {ex.name}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
