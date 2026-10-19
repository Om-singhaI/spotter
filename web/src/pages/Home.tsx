import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";

type ApiStatus = "checking" | "ok" | "down";

export default function Home() {
  const [api, setApi] = useState<ApiStatus>("checking");
  const { session } = useAuth();

  useEffect(() => {
    apiGet<{ ok?: boolean }>("/health")
      .then((data) => setApi(data.ok ? "ok" : "down"))
      .catch(() => setApi("down"));
  }, []);

  const color = api === "ok" ? "text-green-400" : api === "down" ? "text-red-400" : "text-zinc-500";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-950 p-6 text-zinc-100">
      <h1 className="text-6xl font-black tracking-tight">Spotter</h1>
      <p className="text-center text-zinc-400">
        The gym log that remembers your last set and brings your friends.
      </p>
      <p className="text-sm">
        API: <span className={color}>{api}</span>
      </p>
      <div className="mt-4 flex gap-3">
        <Link to="/exercises" className="rounded-full bg-red-600 px-5 py-2 font-semibold">
          Browse the exercise library
        </Link>
        <Link
          to={session ? "/account" : "/login"}
          className="rounded-full border border-zinc-700 px-5 py-2 font-semibold"
        >
          {session ? "Your account" : "Log in"}
        </Link>
      </div>
    </main>
  );
}
