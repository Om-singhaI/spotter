import { vi } from "vitest";
import type { Session } from "@supabase/supabase-js";

// A stand in for the Supabase client. Tests flip `state.session` or call the auth methods;
// listeners registered through onAuthStateChange are notified like the real client does.
type Listener = (event: string, session: Session | null) => void;

export const state: { session: Session | null } = { session: null };
const listeners = new Set<Listener>();

export function fakeSession(email = "ana@example.com", displayName = "Ana"): Session {
  return {
    access_token: "fake-access-token",
    refresh_token: "fake-refresh-token",
    expires_in: 3600,
    token_type: "bearer",
    user: {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      email,
      aud: "authenticated",
      app_metadata: {},
      user_metadata: { display_name: displayName },
      created_at: "2026-01-01T00:00:00Z",
    },
  } as unknown as Session;
}

function setSession(session: Session | null, event: string) {
  state.session = session;
  listeners.forEach((l) => l(event, session));
}

export const fake = {
  auth: {
    getSession: vi.fn(async () => ({ data: { session: state.session }, error: null })),
    onAuthStateChange: vi.fn((cb: Listener) => {
      listeners.add(cb);
      return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } };
    }),
    signInWithPassword: vi.fn(async ({ email }: { email: string; password: string }) => {
      setSession(fakeSession(email), "SIGNED_IN");
      return { data: { session: state.session, user: state.session?.user }, error: null };
    }),
    signUp: vi.fn(async ({ email }: { email: string; password: string }) => {
      setSession(fakeSession(email), "SIGNED_IN");
      return { data: { session: state.session, user: state.session?.user }, error: null };
    }),
    signOut: vi.fn(async () => {
      setSession(null, "SIGNED_OUT");
      return { error: null };
    }),
  },
};

export function resetFake() {
  state.session = null;
  listeners.clear();
  Object.values(fake.auth).forEach((fn) => fn.mockClear());
}
