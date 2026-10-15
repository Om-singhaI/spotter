import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) {
  throw new Error("Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in web/.env");
}

// The anon key is public by design; row level security and the API decide what it can do.
export const supabase = createClient(url, key);
