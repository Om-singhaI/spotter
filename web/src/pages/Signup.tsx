import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import AuthForm, { inputClass } from "../auth/AuthForm";
import { useAuth } from "../auth/AuthProvider";

export default function Signup() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);
  const navigate = useNavigate();
  const { session } = useAuth();

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = displayName.trim();
    if (!name) {
      setError("Pick a name first.");
      return;
    }
    setBusy(true);
    setError(null);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: name },
        // where the confirmation link lands when a hosted project requires it
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    // Hosted projects can require email confirmation; then there is no session yet.
    if (!data.session) {
      setCheckEmail(true);
      return;
    }
    navigate("/account", { replace: true });
  }

  if (session) return <Navigate to="/account" replace />;

  if (checkEmail) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-3 bg-zinc-950 p-6 text-zinc-100">
        <h1 className="text-3xl font-black">Check your email</h1>
        <p className="text-zinc-400">
          We sent a confirmation link to {email}. Open it, then{" "}
          <Link to="/login" className="underline">
            log in
          </Link>
          .
        </p>
      </main>
    );
  }

  return (
    <AuthForm
      title="Create an account"
      busy={busy}
      error={error}
      onSubmit={submit}
      footer={
        <>
          Already have one?{" "}
          <Link to="/login" className="underline">
            Log in
          </Link>
        </>
      }
    >
      <label className="text-sm text-zinc-400">
        What should we call you?
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
          maxLength={40}
          autoComplete="nickname"
          className={inputClass}
        />
      </label>
      <label className="text-sm text-zinc-400">
        Email
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          className={inputClass}
        />
      </label>
      <label className="text-sm text-zinc-400">
        Password
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
          className={inputClass}
        />
      </label>
    </AuthForm>
  );
}
