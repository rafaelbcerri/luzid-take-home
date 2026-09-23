import { existsSync } from "node:fs";

import { defineConfig } from "drizzle-kit";

// Drizzle CLI runs outside Next.js, which is what loads .env.local normally.
if (existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema.ts",
  out: "./supabase/migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  casing: "snake_case",
});
