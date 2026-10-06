import postgres from "postgres";
import { env } from "./env.js";

// prepare: false keeps queries compatible with Supabase's transaction mode pooler.
export const sql = postgres(env.DATABASE_URL, { prepare: false, max: 10 });
