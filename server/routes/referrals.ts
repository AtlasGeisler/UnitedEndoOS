import type { Express } from "express";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import { requireAuth } from "../auth";
import { audit } from "../audit";
import { makePortalToken } from "../portal-token";
import { recomputeAlerts, referralSparkline, dentistReferralHistory } from "../crm";
import {
  referrals, referralStatusHistory, referringDentists, patients, crmAlerts,
  touchpoints, reportDeliveryLog,
} from "../../shared/schema";

export const REFERRAL_STAGES = ["received", "scheduled", "in_treatment", "report_due", "closed"] as const;

// The Referrals pipeline and the Referring Doctor CRM. The pipeline is a kanban
// of referral stages, and the CRM tracks each referrer's history, preferences,
// touchpoints, and alerts. Referrals are the growth engine for an endo practice.
export function registerReferralRoutes(app: Express) {
  app.get("/api/referrals", requireAuth, async (req, res) => {
    const scope = req.user!.clinicIds;
    if (!scope.length) return res.json({ referrals: [] });
    const rows = await db.select().from(referrals).where(inArray(referrals.clinicId, scope)).orderBy(desc(referrals.createdAt));
    const dentists = await db.select().from(referringDentists);
    const dById = new Map(dentists.map((d) => [d.id, d]));
    res.json({
      referrals: rows.map((r) => ({
        ...r,
        dentistName: r.referringDentistId ? dById.get(r.referringDentistId)?.fullName : null,
        practiceName: r.referringDentistId ? dById.get(r.referringDentistId)?.practiceName : null,
      })),
    });
  });

  app.post("/api/referrals", requireAuth, async (req, res) => {
    const { clinicId, referringDentistId, toothNumbers, reason, urgency } = req.body ?? {};
    if (!req.user!.clinicIds.includes(Number(clinicId))) return res.status(403).json({ error: "Clinic out of scope" });
    const [row] = await db.insert(referrals).values({
      clinicId: Number(clinicId), referringDentistId: referringDentistId ? Number(referringDentistId) : null,
      toothNumbers: Array.isArray(toothNumbers) ? toothNumbers.map(Number) : null,
      reason: reason ?? null, urgency: urgency ?? "routine", status: "received", submittedVia: "staff",
    }).returning();
    await db.insert(referralStatusHistory).values({ referralId: row.id, toStatus: "received", changedBy: req.user!.id, note: "Created by staff" });
    await audit(req, { action: "create_referral", entityType: "referral", entityId: row.id, clinicId: Number(clinicId) });
    res.json({ referral: row });
  });

  app.patch("/api/referrals/:id", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const ref = await db.query.referrals.findFirst({ where: eq(referrals.id, id) });
    if (!ref || !req.user!.clinicIds.includes(ref.clinicId)) return res.status(404).json({ error: "Not found" });
    const toStatus = String(req.body?.status ?? ref.status);
    if (toStatus !== ref.status) {
      await db.insert(referralStatusHistory).values({ referralId: id, fromStatus: ref.status, toStatus, changedBy: req.user!.id });
    }
    const [row] = await db.update(referrals).set({ status: toStatus }).where(eq(referrals.id, id)).returning();
    res.json({ referral: row });
  });

  // CRM list with lifetime counts.
  app.get("/api/referring-doctors", requireAuth, async (_req, res) => {
    const dentists = await db.select().from(referringDentists).orderBy(referringDentists.fullName);
    const counts = await db
      .select({ id: patients.referringDentistId, n: sql<number>`count(*)::int` })
      .from(patients)
      .groupBy(patients.referringDentistId);
    const cById = new Map(counts.map((c) => [c.id, c.n]));
    res.json({
      dentists: dentists.map((d) => ({
        id: d.id, fullName: d.fullName, practiceName: d.practiceName,
        preferredDelivery: d.preferredDelivery, status: d.status,
        lifetimeReferrals: cById.get(d.id) ?? 0,
        portalToken: makePortalToken(d.id),
      })),
    });
  });

  app.get("/api/referring-doctors/:id", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const d = await db.query.referringDentists.findFirst({ where: eq(referringDentists.id, id) });
    if (!d) return res.status(404).json({ error: "Not found" });
    const [sparkline, history, tps, alerts, deliveries] = await Promise.all([
      referralSparkline(id),
      dentistReferralHistory(id, req.user!.clinicIds),
      db.select().from(touchpoints).where(eq(touchpoints.referringDentistId, id)).orderBy(desc(touchpoints.createdAt)).limit(10),
      db.select().from(crmAlerts).where(and(eq(crmAlerts.referringDentistId, id), eq(crmAlerts.resolved, false))),
      db.select().from(reportDeliveryLog).where(eq(reportDeliveryLog.referringDentistId, id)).orderBy(desc(reportDeliveryLog.createdAt)).limit(10),
    ]);
    res.json({ dentist: { ...d, portalToken: makePortalToken(d.id) }, sparkline, history, touchpoints: tps, alerts, deliveries });
  });

  app.post("/api/referring-doctors/:id/touchpoints", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const [row] = await db.insert(touchpoints).values({
      referringDentistId: id, userId: req.user!.id, kind: req.body?.kind ?? "note", note: req.body?.note ?? null,
    }).returning();
    res.json({ touchpoint: row });
  });

  app.post("/api/crm/run-alerts", requireAuth, async (req, res) => {
    const n = await recomputeAlerts();
    await audit(req, { action: "run_crm_alerts", entityType: "crm", detail: { generated: n } });
    res.json({ generated: n });
  });
}
