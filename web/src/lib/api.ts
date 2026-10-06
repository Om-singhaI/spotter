// Every API call goes to /api on the same origin. In development Vite proxies that to the
// Express app; in production a Vercel rewrite forwards it to the deployed API, so the
// browser never makes a cross origin request and the API needs no CORS setup.
export const apiBase = "/api";

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(apiBase + path);
  if (!res.ok) throw new Error(`${res.status} from ${path}`);
  return (await res.json()) as T;
}
