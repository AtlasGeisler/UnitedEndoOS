import express from "express";
import session from "express-session";
import createMemoryStore from "memorystore";
import { registerRoutes } from "./routes";
import { attachClient } from "./vite";

const isProd = process.env.NODE_ENV === "production";
const PORT = Number(process.env.PORT ?? 5173);

async function main() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json({ limit: "25mb" }));
  app.use(express.urlencoded({ extended: true }));

  // Sessions in a memory store for local dev. The structure swaps to a Postgres
  // session store for a real deployment without touching the auth code.
  const MemoryStore = createMemoryStore(session);
  app.use(
    session({
      secret: process.env.SESSION_SECRET ?? "unitedendoos-dev-secret",
      resave: false,
      saveUninitialized: false,
      store: new MemoryStore({ checkPeriod: 1000 * 60 * 60 * 24 }),
      cookie: { httpOnly: true, sameSite: "lax", maxAge: 1000 * 60 * 60 * 8 },
    }),
  );

  registerRoutes(app);
  await attachClient(app, isProd);

  app.listen(PORT, () => {
    console.log(`UnitedEndoOS listening on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error("Failed to start UnitedEndoOS", err);
  process.exit(1);
});
