import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "@/lib/config/env";
import * as schema from "@/lib/db/schema";

/**
 * Next.js reloads modules in development, so the connection pool is cached on
 * globalThis to avoid exhausting Postgres connections between hot reloads.
 */
const globalForDatabase = globalThis as unknown as {
  postgresClient?: ReturnType<typeof postgres>;
};

const postgresClient =
  globalForDatabase.postgresClient ??
  postgres(env.DATABASE_URL, { max: 10, prepare: false });

if (env.NODE_ENV !== "production") {
  globalForDatabase.postgresClient = postgresClient;
}

export const db = drizzle(postgresClient, { schema });
