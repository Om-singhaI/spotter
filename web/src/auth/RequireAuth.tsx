import { useEffect, useRef } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthProvider";

// Wrap routes that need a signed in user. Arriving logged out sends you to the login page
// and brings you back afterwards. Logging out while on a protected page sends you home.
export default function RequireAuth() {
  const { session, loading } = useAuth();
  const location = useLocation();
  const hadSession = useRef(false);

  useEffect(() => {
    if (session) hadSession.current = true;
  }, [session]);

  if (loading) return <p className="p-6 text-zinc-500">Loading…</p>;
  if (!session) {
    return hadSession.current ? (
      <Navigate to="/" replace />
    ) : (
      <Navigate to="/login" replace state={{ from: location.pathname }} />
    );
  }
  return <Outlet />;
}
