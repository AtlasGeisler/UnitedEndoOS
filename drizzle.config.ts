import { defineConfig } from "drizzle-kit";

// The local datastore is PGlite (Postgres in process), so no external service
// is needed. The same schema pushes to a real Postgres later by changing the
// driver and connection string, no code edits to the schema itself.
export default defineConfig({
  schema: "./shared/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  driver: "pglite",
  dbCredentials: {
    url: "./data/pgdata",
  },
});
