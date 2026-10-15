import type { FormEvent, ReactNode } from "react";

type Props = {
  title: string;
  busy: boolean;
  error: string | null;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  children: ReactNode;
  footer: ReactNode;
};

export const inputClass =
  "w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-base outline-none focus:border-zinc-600";

export default function AuthForm({ title, busy, error, onSubmit, children, footer }: Props) {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 bg-zinc-950 p-6 text-zinc-100">
      <h1 className="text-3xl font-black tracking-tight">{title}</h1>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        {children}
        {error && (
          <p role="alert" className="text-sm text-red-400">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-red-600 px-5 py-3 font-semibold disabled:opacity-60"
        >
          {busy ? "One moment…" : title}
        </button>
      </form>
      <p className="text-sm text-zinc-400">{footer}</p>
    </main>
  );
}
