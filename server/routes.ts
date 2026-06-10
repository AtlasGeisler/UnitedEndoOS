import type { Express } from "express";
import { db } from "./db";
import { clinics } from "../shared/schema";
import { registerAuthRoutes, requireAuth } from "./auth";

// The API surface. Phase 0 covers auth and the clinic list that powers the
// location switcher. Each later phase mounts its own router here.
export function registerRoutes(app: Express) {
  registerAuthRoutes(app);

  app.get("/api/clinics", requireAuth, async (_req, res) => {
    const rows = await db.select().from(clinics);
    res.json({ clinics: rows });
  });

  app.get("/api/health", (_req, res) => res.json({ ok: true }));
}
