import { z } from "zod";

// Load api/.env when it exists. Production sets real environment variables instead.
try {
  process.loadEnvFile();
} catch {
  // no .env file, which is fine
}

const schema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.url(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Bad environment:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
