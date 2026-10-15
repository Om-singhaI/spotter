import { z } from "zod";

// Load api/.env when it exists. Production sets real environment variables instead.
try {
  process.loadEnvFile();
} catch {
  // no .env file, which is fine
}

// The Supabase CLI's well known local secret. Fine against the local stack, never anywhere else.
const LOCAL_DEFAULT_SECRET = "super-secret-jwt-token-with-at-least-32-characters-long";
const isLocal = (url: string) => /^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(url);

const schema = z
  .object({
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z.url(),
    SUPABASE_URL: z.url(),
    // Only for a hosted project that still signs tokens with the legacy shared secret.
    // Projects on signing keys (and the local stack) are verified through the JWKS endpoint.
    SUPABASE_JWT_SECRET: z.string().min(32).optional(),
  })
  .refine((e) => e.SUPABASE_JWT_SECRET !== LOCAL_DEFAULT_SECRET || isLocal(e.SUPABASE_URL), {
    path: ["SUPABASE_JWT_SECRET"],
    message: "this is the public local default; set the project's own secret or leave it unset",
  });

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Bad environment:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
