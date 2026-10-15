import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";

type Me = {
  id: string;
  display_name: string;
  weight_unit: "kg" | "lb";
  share_numbers: boolean;
  email: string | null;
};

export default function Account() {
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState(false);
  const { signOut } = useAuth();

  useEffect(() => {
    apiGet<Me>("/me")
      .then(setMe)
      .catch(() => setError(true));
  }, []);

  async function logOut() {
    // The route guard sends us home once the session is gone.
    await signOut();
  }

  return (
    <main className="mx-auto min-h-screen max-w-2xl bg-zinc-950 p-4 text-zinc-100">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-black tracking-tight">Your account</h1>
        <Link to="/" className="text-sm text-zinc-400">
          Home
        </Link>
      </header>
      {error && <p className="text-red-400">Could not load your profile.</p>}
      {me && (
        <dl className="mb-6 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="text-zinc-500">Name</dt>
          <dd className="font-semibold">{me.display_name}</dd>
          <dt className="text-zinc-500">Email</dt>
          <dd>{me.email}</dd>
          <dt className="text-zinc-500">Units</dt>
          <dd>{me.weight_unit}</dd>
        </dl>
      )}
      <button
        type="button"
        onClick={logOut}
        className="rounded-full border border-zinc-700 px-5 py-2 text-sm font-semibold"
      >
        Log out
      </button>
    </main>
  );
}
