import express from "express";
import session from "express-session";
import createMemoryStore from "memorystore";
import { registerRoutes } from "./routes";
import { attachClient } from "./vite";

// Load .env if present, so ANTHROPIC_API_KEY (or OPENAI_API_KEY) is picked up by
// the AI provider abstraction. Node's built-in loader, no dependency. The app
// still runs with no .env, falling back to the offline mock provider.
try {
  process.loadEnvFile(new URL("../.env", import.meta.url));
} catch {
  // No .env file, that is fine, the mock provider is used.
}

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
    const aiProvider = process.env.ANTHROPIC_API_KEY
      ? "anthropic (claude-opus-4-8)"
      : process.env.OPENAI_API_KEY
        ? "openai"
        : "mock (offline)";
    console.log(`UnitedEndoOS listening on http://localhost:${PORT}`);
    console.log(`AI provider: ${aiProvider}`);
  });
}

main().catch((err) => {
  console.error("Failed to start UnitedEndoOS", err);
  process.exit(1);
});
