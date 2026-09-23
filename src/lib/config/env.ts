/**
 * Single place where process.env is read. Everything else imports `env`, so a
 * missing variable fails loudly at boot instead of deep inside the pipeline.
 */
import { z } from "zod";

const environmentSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  GEMINI_API_KEY: z.string().min(1, "GEMINI_API_KEY is required"),
  GEMINI_MODEL: z.string().default("gemini-2.5-flash"),
  SUPABASE_URL: z.string().url("SUPABASE_URL must be a valid URL"),
  SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .min(1, "SUPABASE_PUBLISHABLE_KEY is required"),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),
  APP_ORIGIN: z.string().url("APP_ORIGIN must be a valid URL"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

function readEnvironment() {
  const parsed = environmentSchema.safeParse(process.env);

  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `  - ${issue.message}`)
      .join("\n");
    throw new Error(
      `Invalid environment configuration. Copy .env.example to .env.local and fill in:\n${problems}`,
    );
  }

  return parsed.data;
}

export const env = readEnvironment();

export const STORAGE_BUCKETS = {
  recordings: "recordings",
  screenshots: "screenshots",
} as const;
