import type { Express } from "express";
import { and, desc, eq, inArray, ilike, or, sql } from "drizzle-orm";
import { db } from "../db";
import { requireAuth } from "../auth";
import { audit } from "../audit";
import {
  patients,
  visits,
  imageStudies,
  imageAssets,
  soapNotes,
  referringDentists,
  users,
} from "../../shared/schema";

// Patient directory and chart data. Every query is scoped to the clinics the
// authenticated user may reach, never the whole network. A chart open is
// audited as a PHI read.
export function registerPatientRoutes(app: Express) {
  // Directory with instant search and a latest-thumbnail preview per patient.
  app.get("/api/patients", requireAuth, async (req, res) => {
    const scope = req.user!.clinicIds;
    if (!scope.length) return res.json({ patients: [] });
    const q = String(req.query.q ?? "").trim();

    const where = and(
      inArray(patients.clinicId, scope),
      q
        ? or(
            ilike(patients.firstName, `%${q}%`),
            ilike(patients.lastName, `%${q}%`),
          )
        : undefined,
    );
    const rows = await db
      .select()
      .from(patients)
      .where(where)
      .orderBy(patients.lastName, patients.firstName)
      .limit(200);

    // Latest thumbnail per patient, one query, mapped in memory.
    const ids = rows.map((r) => r.id);
    const thumbs = ids.length
      ? await db
          .select({
            patientId: imageStudies.patientId,
            assetId: imageAssets.id,
            capturedAt: imageStudies.capturedAt,
          })
          .from(imageStudies)
          .innerJoin(imageAssets, eq(imageAssets.studyId, imageStudies.id))
          .where(
            and(
              inArray(imageStudies.patientId, ids),
              eq(imageAssets.kind, "thumbnail"),
            ),
          )
          .orderBy(desc(imageStudies.capturedAt))
      : [];
    const latest = new Map<number, number>();
    for (const t of thumbs) if (!latest.has(t.patientId)) latest.set(t.patientId, t.assetId);

    res.json({
      patients: rows.map((p) => ({ ...p, latestThumbAssetId: latest.get(p.id) ?? null })),
    });
  });

  // One patient with the chart context: referring dentist, provider, counts.
  app.get("/api/patients/:id", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const patient = await db.query.patients.findFirst({ where: eq(patients.id, id) });
    if (!patient || !req.user!.clinicIds.includes(patient.clinicId)) {
      return res.status(404).json({ error: "Patient not found" });
    }
    await audit(req, {
      action: "view_chart",
      entityType: "patient",
      entityId: id,
      clinicId: patient.clinicId,
    });
    const referrer = patient.referringDentistId
      ? await db.query.referringDentists.findFirst({
          where: eq(referringDentists.id, patient.referringDentistId),
        })
      : null;
    const provider = patient.primaryProviderId
      ? await db.query.users.findFirst({ where: eq(users.id, patient.primaryProviderId) })
      : null;
    const [{ count: imageCount }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(imageStudies)
      .where(eq(imageStudies.patientId, id));
    res.json({
      patient,
      referrer: referrer ? { id: referrer.id, fullName: referrer.fullName, practiceName: referrer.practiceName } : null,
      provider: provider ? { id: provider.id, fullName: provider.fullName } : null,
      imageCount,
    });
  });

  // The imaging grid data: studies with their original and thumbnail asset ids,
  // and the visit each belongs to, so the client can group by visit and tooth.
  app.get("/api/patients/:id/studies", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const patient = await db.query.patients.findFirst({ where: eq(patients.id, id) });
    if (!patient || !req.user!.clinicIds.includes(patient.clinicId)) {
      return res.status(404).json({ error: "Patient not found" });
    }
    const studies = await db
      .select()
      .from(imageStudies)
      .where(eq(imageStudies.patientId, id))
      .orderBy(desc(imageStudies.capturedAt));
    const assets = await db
      .select()
      .from(imageAssets)
      .where(
        inArray(
          imageAssets.studyId,
          studies.map((s) => s.id),
        ),
      );
    const byStudy = new Map<number, { original?: number; thumb?: number }>();
    for (const a of assets) {
      const e = byStudy.get(a.studyId) ?? {};
      if (a.kind === "original") e.original = a.id;
      if (a.kind === "thumbnail") e.thumb = a.id;
      byStudy.set(a.studyId, e);
    }
    res.json({
      studies: studies.map((st) => ({
        ...st,
        originalAssetId: byStudy.get(st.id)?.original ?? null,
        thumbAssetId: byStudy.get(st.id)?.thumb ?? null,
      })),
    });
  });

  // Visits for the chart timeline and the visits tab.
  app.get("/api/patients/:id/visits", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const patient = await db.query.patients.findFirst({ where: eq(patients.id, id) });
    if (!patient || !req.user!.clinicIds.includes(patient.clinicId)) {
      return res.status(404).json({ error: "Patient not found" });
    }
    const rows = await db
      .select()
      .from(visits)
      .where(eq(visits.patientId, id))
      .orderBy(desc(visits.visitDate));
    const notes = await db
      .select()
      .from(soapNotes)
      .where(eq(soapNotes.patientId, id));
    const noteByVisit = new Map(notes.map((n) => [n.visitId, n]));
    res.json({ visits: rows.map((v) => ({ ...v, note: noteByVisit.get(v.id) ?? null })) });
  });
}
