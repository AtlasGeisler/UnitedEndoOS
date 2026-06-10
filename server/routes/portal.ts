import type { Express } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db";
import { parsePortalToken } from "../portal-token";
import {
  referringDentists, referrals, referralStatusHistory, patients,
  referringDentistClinics, referralReports, visits,
} from "../../shared/schema";

// The tokenized referring doctor portal. A GP reaches it with a per-dentist token
// and no session login. They submit a referral, watch its status, and download
// the finished report. This is the growth loop, closed end to end.
export function registerPortalRoutes(app: Express) {
  async function dentistFromToken(req: any) {
    const token = String(req.query.token ?? req.body?.token ?? "");
    const id = parsePortalToken(token);
    if (id == null) return null;
    return db.query.referringDentists.findFirst({ where: eq(referringDentists.id, id) });
  }

  app.get("/api/portal/me", async (req, res) => {
    const d = await dentistFromToken(req);
    if (!d) return res.status(401).json({ error: "Invalid portal link" });
    res.json({ dentist: { id: d.id, fullName: d.fullName, practiceName: d.practiceName } });
  });

  // Submit a referral through the portal. It creates a pending patient and a
  // referral in the received stage, ready for staff to schedule.
  app.post("/api/portal/referrals", async (req, res) => {
    const d = await dentistFromToken(req);
    if (!d) return res.status(401).json({ error: "Invalid portal link" });
    const { firstName, lastName, dateOfBirth, toothNumbers, reason, urgency } = req.body ?? {};
    if (!firstName || !lastName) return res.status(400).json({ error: "Patient name is required" });

    const mapped = await db.select().from(referringDentistClinics).where(eq(referringDentistClinics.referringDentistId, d.id));
    const clinicId = mapped[0]?.clinicId ?? 1;

    const [patient] = await db.insert(patients).values({
      clinicId, firstName, lastName,
      dateOfBirth: dateOfBirth || "1990-01-01",
      referringDentistId: d.id, status: "pending_review",
    }).returning();

    const [referral] = await db.insert(referrals).values({
      clinicId, patientId: patient.id, referringDentistId: d.id,
      toothNumbers: Array.isArray(toothNumbers) ? toothNumbers.map(Number) : null,
      reason: reason ?? null, urgency: urgency ?? "routine",
      status: "received", submittedVia: "portal",
    }).returning();
    await db.insert(referralStatusHistory).values({ referralId: referral.id, toStatus: "received", note: "Submitted via portal" });

    res.json({ referralId: referral.id, status: "received" });
  });

  // The GP's referrals with status and whether a finished report is available.
  app.get("/api/portal/referrals", async (req, res) => {
    const d = await dentistFromToken(req);
    if (!d) return res.status(401).json({ error: "Invalid portal link" });
    const rows = await db.select().from(referrals).where(eq(referrals.referringDentistId, d.id)).orderBy(desc(referrals.createdAt));
    const reports = await db.select().from(referralReports).where(eq(referralReports.referringDentistId, d.id));
    const reportByPatient = new Map<number, typeof reports[number]>();
    for (const r of reports) if (r.status === "delivered" && r.patientId) reportByPatient.set(r.patientId, r);

    const ptIds = rows.map((r) => r.patientId).filter((x): x is number => x != null);
    const pts = ptIds.length ? await db.select().from(patients).where(eq(patients.referringDentistId, d.id)) : [];
    const pById = new Map(pts.map((p) => [p.id, p]));

    res.json({
      referrals: rows.map((r) => ({
        id: r.id, status: r.status, reason: r.reason, urgency: r.urgency, toothNumbers: r.toothNumbers,
        patientName: r.patientId ? `${pById.get(r.patientId)?.firstName ?? ""} ${pById.get(r.patientId)?.lastName ?? ""}`.trim() : "Pending",
        reportId: r.patientId && reportByPatient.has(r.patientId) ? reportByPatient.get(r.patientId)!.id : null,
      })),
    });
  });

  // Download a delivered report. Authorized only for the report's referring GP.
  app.get("/api/portal/reports/:id", async (req, res) => {
    const d = await dentistFromToken(req);
    if (!d) return res.status(401).json({ error: "Invalid portal link" });
    const report = await db.query.referralReports.findFirst({ where: eq(referralReports.id, Number(req.params.id)) });
    if (!report || report.referringDentistId !== d.id || report.status !== "delivered") {
      return res.status(404).json({ error: "Report not available" });
    }
    if (req.query.format === "txt") {
      res.setHeader("Content-Type", "text/plain");
      res.setHeader("Content-Disposition", `attachment; filename="referral-report-${report.id}.txt"`);
      return res.send(report.body ?? "");
    }
    res.json({ report: { id: report.id, body: report.body, deliveredAt: report.deliveredAt } });
  });
}
