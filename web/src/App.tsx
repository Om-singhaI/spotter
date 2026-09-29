import { useEffect, useState } from "react";

type ApiStatus = "checking" | "ok" | "down";

export default function App() {
  const [api, setApi] = useState<ApiStatus>("checking");

  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json())
      .then((data: { ok?: boolean }) => setApi(data.ok ? "ok" : "down"))
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
    </main>
  );
}
