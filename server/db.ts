import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import path from "node:path";
import * as schema from "../shared/schema";

// PGlite runs Postgres in process, persisted to data/pgdata, so the app needs
// no external database service. Swapping to a hosted Postgres later is a driver
// and connection-string change, the schema and queries stay the same.
const dataDir = path.resolve(import.meta.dirname, "..", "data", "pgdata");

export const client = new PGlite(dataDir);
export const db = drizzle(client, { schema });
export type Db = typeof db;
