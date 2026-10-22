import { supabase } from "./supabase";

// Every API call goes to /api on the same origin. In development Vite proxies that to the
// Express app; in production a Vercel rewrite forwards it to the deployed API, so the
// browser never makes a cross origin request and the API needs no CORS setup.
export const apiBase = "/api";

async function headers(extra: Record<string, string> = {}): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const auth: Record<string, string> = data.session
    ? { Authorization: `Bearer ${data.session.access_token}` }
    : {};
  return { ...auth, ...extra };
}

async function parse<T>(res: Response, path: string): Promise<T> {
  if (!res.ok) throw new Error(`${res.status} from ${path}`);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(apiBase + path, { headers: await headers() });
  return parse<T>(res, path);
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(apiBase + path, {
    method: "POST",
    headers: await headers(body === undefined ? {} : { "Content-Type": "application/json" }),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return parse<T>(res, path);
}

export async function apiDelete(path: string): Promise<void> {
  const res = await fetch(apiBase + path, { method: "DELETE", headers: await headers() });
  await parse<void>(res, path);
}
