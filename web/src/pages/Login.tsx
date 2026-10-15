import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import AuthForm, { inputClass } from "../auth/AuthForm";
import { useAuth } from "../auth/AuthProvider";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/account";
  const { session } = useAuth();

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    navigate(from, { replace: true });
  }

  if (session) return <Navigate to={from} replace />;

  return (
    <AuthForm
      title="Log in"
      busy={busy}
      error={error}
      onSubmit={submit}
      footer={
        <>
          New here?{" "}
          <Link to="/signup" className="underline">
            Create an account
          </Link>
        </>
      }
    >
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
          autoComplete="current-password"
          className={inputClass}
        />
      </label>
    </AuthForm>
  );
}
