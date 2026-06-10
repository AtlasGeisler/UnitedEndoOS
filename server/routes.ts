import type { Express } from "express";
import { db } from "./db";
import { clinics } from "../shared/schema";
import { registerAuthRoutes, requireAuth } from "./auth";
import { registerPatientRoutes } from "./routes/patients";
import { registerImageRoutes } from "./routes/images";
import { registerVisitRoutes } from "./routes/visits";
import { registerScheduleRoutes } from "./routes/schedule";
import { registerTodayRoutes } from "./routes/today";
import { registerReferralRoutes } from "./routes/referrals";
import { registerPortalRoutes } from "./routes/portal";
import { registerPlanRoutes } from "./routes/plans";

// The API surface. Each phase mounts its own router here. Phase 0 covers auth
// and clinics, Phase 1 adds patients and the imaging layer, Phase 2 adds the
// clinical cockpit and the AI features, Phase 3 adds the schedule, the
// Thanksgiving Rule, the huddle, and the worklists.
export function registerRoutes(app: Express) {
  registerAuthRoutes(app);
  registerPatientRoutes(app);
  registerImageRoutes(app);
  registerVisitRoutes(app);
  registerScheduleRoutes(app);
  registerTodayRoutes(app);
  registerReferralRoutes(app);
  registerPortalRoutes(app);
  registerPlanRoutes(app);

  app.get("/api/clinics", requireAuth, async (_req, res) => {
    const rows = await db.select().from(clinics);
    res.json({ clinics: rows });
  });

  app.get("/api/health", (_req, res) => res.json({ ok: true }));
}
