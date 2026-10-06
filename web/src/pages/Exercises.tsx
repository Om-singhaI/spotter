import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet } from "../lib/api";

export type Exercise = {
  id: string;
  name: string;
  category: string;
  equipment: string | null;
  primary_muscles: string[];
  images: string[];
};

// Pinned to one commit of the dataset so a change upstream never alters the app silently.
const IMAGE_BASE =
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5/exercises/";
// Matches the API's limit on the q parameter.
const MAX_QUERY = 60;

function Thumb({ path }: { path: string | undefined }) {
  const [failed, setFailed] = useState(false);
  if (!path || failed) return <div className="h-14 w-14 shrink-0 rounded-lg bg-zinc-800" />;
  return (
    <img
      src={IMAGE_BASE + path}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className="h-14 w-14 shrink-0 rounded-lg object-cover"
    />
  );
}

export default function ExercisesPage() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Exercise[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let active = true;
    const handle = setTimeout(() => {
      setState("loading");
      apiGet<{ exercises: Exercise[] }>(`/exercises?q=${encodeURIComponent(q)}`)
        .then((data) => {
          if (!active) return;
          setResults(data.exercises);
          setState("ready");
        })
        .catch(() => {
          if (active) setState("error");
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(handle);
    };
  }, [q]);

  const status =
    state === "error"
      ? "Could not reach the API."
      : state === "loading"
        ? "Loading\u2026"
        : results.length === 0
          ? "Nothing matches that."
          : `${results.length} exercises`;

  return (
    <main className="mx-auto min-h-screen max-w-2xl bg-zinc-950 p-4 text-zinc-100">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-black tracking-tight">Exercises</h1>
        <Link to="/" className="text-sm text-zinc-400">
          Home
        </Link>
      </header>
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        maxLength={MAX_QUERY}
        placeholder="Search by name or muscle"
        aria-label="Search exercises"
        autoFocus
        className="mb-3 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-base outline-none focus:border-zinc-600"
      />
      <p
        role="status"
        aria-live="polite"
        className={`mb-3 text-sm ${state === "error" ? "text-red-400" : "text-zinc-500"}`}
      >
        {status}
      </p>
      <ul aria-label="Exercises" aria-busy={state === "loading"} className="flex flex-col gap-2">
        {results.map((ex) => (
          <li key={ex.id} className="flex items-center gap-3 rounded-xl bg-zinc-900 p-3">
            <Thumb path={ex.images[0]} />
            <div className="min-w-0">
              <p className="truncate font-semibold">{ex.name}</p>
              <p className="truncate text-sm text-zinc-400">
                {[ex.primary_muscles.join(", "), ex.equipment].filter(Boolean).join(" \u00b7 ")}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
