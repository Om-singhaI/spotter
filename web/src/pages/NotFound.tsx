import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-zinc-950 p-6 text-zinc-100">
      <h1 className="text-3xl font-black">Nothing here</h1>
      <Link to="/" className="text-zinc-400 underline">
        Back to Spotter
      </Link>
    </main>
  );
}
