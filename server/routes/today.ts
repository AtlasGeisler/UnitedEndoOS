import type { Express } from "express";
import { and, eq, gte, lte, inArray, isNull, isNotNull, sql, desc } from "drizzle-orm";
import { db } from "../db";
import { requireAuth } from "../auth";
import { now } from "../clock";
import {
  appointments, visits, soapNotes, referralReports, crmAlerts, claims, patients, referringDentists,
} from "../../shared/schema";

// The Today huddle and the Worklists. The huddle is the morning dashboard:
// production against goal, emergency slot status, unconfirmed patients,
// yesterday's unsigned notes, and referral SLA flags, with an AI written brief.
export function registerTodayRoutes(app: Express) {
  app.get("/api/today", requireAuth, async (req, res) => {
    const scope = req.user!.clinicIds;
    if (!scope.length) return res.json({ empty: true });
    const today = now();
    const dayStart = new Date(today); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(today); dayEnd.setHours(23, 59, 59, 999);

    const appts = await db.select().from(appointments).where(and(
      inArray(appointments.clinicId, scope), gte(appointments.startsAt, dayStart), lte(appointments.startsAt, dayEnd),
    ));
    const booked = appts.filter((a) => a.patientId);
    const emergencyOpen = appts.filter((a) => a.isProtected && !a.patientId).length;
    const unconfirmed = booked.filter((a) => !a.confirmed).length;

    // A simple production model: 130000 cents per booked hour, against a goal.
    const bookedMinutes = booked.reduce((m, a) => m + (new Date(a.endsAt).getTime() - new Date(a.startsAt).getTime()) / 60000, 0);
    const productionCents = Math.round((bookedMinutes / 60) * 130000);
    const goalCents = 1200000;

    const [{ count: unsignedNotes }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(soapNotes)
      .innerJoin(visits, eq(soapNotes.visitId, visits.id))
      .where(and(inArray(visits.clinicId, scope), isNull(soapNotes.signedAt)));

    const [{ count: reportsDue }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(referralReports)
      .where(eq(referralReports.status, "draft"));

    const alerts = await db.select().from(crmAlerts).where(eq(crmAlerts.resolved, false)).orderBy(desc(crmAlerts.createdAt)).limit(4);

    const brief = `Good morning. ${booked.length} patients are on the schedule for ${today.toLocaleDateString("en-US", { weekday: "long" })}, ${unconfirmed} still unconfirmed. ${emergencyOpen} emergency ${emergencyOpen === 1 ? "slot is" : "slots are"} held open per the Thanksgiving Rule. There ${unsignedNotes === 1 ? "is" : "are"} ${unsignedNotes} unsigned ${unsignedNotes === 1 ? "note" : "notes"} to close and ${reportsDue} referral ${reportsDue === 1 ? "report" : "reports"} to send. Lead with the emergencies, protect the coronal seal.`;

    res.json({
      date: dayStart.toISOString(),
      scheduled: booked.length,
      unconfirmed,
      emergencyOpen,
      productionCents,
      goalCents,
      unsignedNotes,
      reportsDue,
      alerts,
      brief,
    });
  });

  app.get("/api/worklists", requireAuth, async (req, res) => {
    const scope = req.user!.clinicIds;
    if (!scope.length) return res.json({ worklists: [] });

    // Unsigned notes.
    const unsigned = await db
      .select({ visitId: visits.id, patientId: visits.patientId, toothNumber: visits.toothNumber, visitDate: visits.visitDate })
      .from(soapNotes)
      .innerJoin(visits, eq(soapNotes.visitId, visits.id))
      .where(and(inArray(visits.clinicId, scope), isNull(soapNotes.signedAt)))
      .orderBy(desc(visits.visitDate)).limit(50);

    // Unsent referral reports (draft).
    const unsent = await db.select().from(referralReports).where(eq(referralReports.status, "draft")).limit(50);

    // Claims to submit (draft).
    const draftClaims = await db.select().from(claims).where(eq(claims.status, "draft")).limit(50);

    // Recall due: signed visits older than 180 days with no newer visit. Simplified
    // to signed visits in a recall window.
    const cutoff = new Date(now().getTime() - 180 * 86400000);
    const recall = await db.select({ patientId: visits.patientId, toothNumber: visits.toothNumber, visitDate: visits.visitDate })
      .from(visits).where(and(inArray(visits.clinicId, scope), eq(visits.status, "signed"), lte(visits.visitDate, cutoff)))
      .orderBy(desc(visits.visitDate)).limit(50);

    // Decorate with patient names.
    const ids = [...new Set([...unsigned.map((u) => u.patientId), ...unsent.map((u) => u.patientId), ...recall.map((r) => r.patientId)])];
    const pts = ids.length ? await db.select().from(patients).where(inArray(patients.id, ids)) : [];
    const pName = new Map(pts.map((p) => [p.id, `${p.firstName} ${p.lastName}`]));

    res.json({
      worklists: [
        { key: "unsigned_notes", label: "Unsigned notes", count: unsigned.length, items: unsigned.map((u) => ({ id: u.visitId, label: `${pName.get(u.patientId) ?? "Patient"}, tooth ${u.toothNumber}`, sub: new Date(u.visitDate).toLocaleDateString(), href: `/visits/${u.visitId}` })) },
        { key: "unsent_reports", label: "Unsent referral reports", count: unsent.length, items: unsent.map((u) => ({ id: u.id, label: pName.get(u.patientId) ?? "Patient", sub: "Draft, ready to send", href: u.visitId ? `/visits/${u.visitId}` : "/referrals" })) },
        { key: "claims_to_submit", label: "Claims to submit", count: draftClaims.length, items: draftClaims.map((c) => ({ id: c.id, label: pName.get(c.patientId) ?? `Claim ${c.id}`, sub: `$${(c.totalCents / 100).toFixed(2)}`, href: "/billing" })) },
        { key: "recall_due", label: "Recall due", count: recall.length, items: recall.map((r) => ({ id: r.patientId, label: `${pName.get(r.patientId) ?? "Patient"}, tooth ${r.toothNumber}`, sub: "Recall window", href: `/patients/${r.patientId}` })) },
      ],
    });
  });
}
