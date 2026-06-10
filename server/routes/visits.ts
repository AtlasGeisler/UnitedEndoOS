import type { Express } from "express";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { requireAuth, requireRole } from "../auth";
import { audit } from "../audit";
import {
  visits, soapNotes, patients, imageStudies, imageAssets, referralReports,
  reportDeliveryLog, referringDentists, users, imageAnnotations,
} from "../../shared/schema";
import { generateSoapDraft, analyzeImage, generateReferralReport, type SoapInput } from "../ai";

// The clinical cockpit API. A note is authored and signed by a clinician, never
// by the model. Once signed a note is locked and accepts only addenda. AI drafts
// are advisory and require the provider to accept and sign.
export function registerVisitRoutes(app: Express) {
  async function loadVisitScoped(req: any, id: number) {
    const visit = await db.query.visits.findFirst({ where: eq(visits.id, id) });
    if (!visit || !req.user.clinicIds.includes(visit.clinicId)) return null;
    return visit;
  }

  // Open clinical work: visits that are not yet signed, for the Clinical module.
  app.get("/api/visits", requireAuth, async (req, res) => {
    const scope = req.user!.clinicIds;
    if (!scope.length) return res.json({ visits: [] });
    const status = req.query.status ? String(req.query.status) : null;
    const rows = await db
      .select()
      .from(visits)
      .where(and(inArray(visits.clinicId, scope), status ? eq(visits.status, status) : undefined))
      .orderBy(desc(visits.visitDate))
      .limit(100);
    const pts = rows.length
      ? await db.select().from(patients).where(inArray(patients.id, rows.map((v) => v.patientId)))
      : [];
    const pById = new Map(pts.map((p) => [p.id, p]));
    res.json({
      visits: rows.map((v) => ({
        ...v,
        patientName: pById.get(v.patientId) ? `${pById.get(v.patientId)!.firstName} ${pById.get(v.patientId)!.lastName}` : "",
      })),
    });
  });

  // Full visit detail for the workspace.
  app.get("/api/visits/:id", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const visit = await loadVisitScoped(req, id);
    if (!visit) return res.status(404).json({ error: "Visit not found" });
    const patient = await db.query.patients.findFirst({ where: eq(patients.id, visit.patientId) });
    let note = await db.query.soapNotes.findFirst({ where: eq(soapNotes.visitId, id) });
    if (!note) {
      [note] = await db.insert(soapNotes).values({ visitId: id, patientId: visit.patientId, authorId: req.user!.id }).returning();
    }
    const studies = await db.select().from(imageStudies).where(eq(imageStudies.visitId, id)).orderBy(imageStudies.capturedAt);
    const assets = studies.length
      ? await db.select().from(imageAssets).where(inArray(imageAssets.studyId, studies.map((s) => s.id)))
      : [];
    const byStudy = new Map<number, { original?: number; thumb?: number }>();
    for (const a of assets) {
      const e = byStudy.get(a.studyId) ?? {};
      if (a.kind === "original") e.original = a.id;
      if (a.kind === "thumbnail") e.thumb = a.id;
      byStudy.set(a.studyId, e);
    }
    const report = await db.query.referralReports.findFirst({ where: eq(referralReports.visitId, id) });
    const referrer = patient?.referringDentistId
      ? await db.query.referringDentists.findFirst({ where: eq(referringDentists.id, patient.referringDentistId) })
      : null;
    await audit(req, { action: "open_visit", entityType: "visit", entityId: id, clinicId: visit.clinicId });
    res.json({
      visit, patient, note, referrer, report,
      studies: studies.map((s) => ({ ...s, originalAssetId: byStudy.get(s.id)?.original ?? null, thumbAssetId: byStudy.get(s.id)?.thumb ?? null })),
    });
  });

  // Create a new visit for a patient, opening the cockpit.
  app.post("/api/visits", requireAuth, requireRole("clinical_provider", "practice_owner"), async (req, res) => {
    const { patientId, toothNumber, chiefComplaint, type } = req.body ?? {};
    const patient = await db.query.patients.findFirst({ where: eq(patients.id, Number(patientId)) });
    if (!patient || !req.user!.clinicIds.includes(patient.clinicId)) return res.status(404).json({ error: "Patient not found" });
    const [visit] = await db.insert(visits).values({
      clinicId: patient.clinicId, patientId: patient.id, providerId: req.user!.id,
      visitDate: new Date(), type: type ?? "treatment", toothNumber: toothNumber ? Number(toothNumber) : null,
      chiefComplaint: chiefComplaint ?? null, status: "open",
    }).returning();
    await db.insert(soapNotes).values({ visitId: visit.id, patientId: patient.id, authorId: req.user!.id });
    await audit(req, { action: "create_visit", entityType: "visit", entityId: visit.id, clinicId: patient.clinicId });
    res.json({ visit });
  });

  // Update the structured note. A signed note is locked.
  app.patch("/api/visits/:id/note", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const visit = await loadVisitScoped(req, id);
    if (!visit) return res.status(404).json({ error: "Visit not found" });
    const note = await db.query.soapNotes.findFirst({ where: eq(soapNotes.visitId, id) });
    if (!note) return res.status(404).json({ error: "Note not found" });
    if (note.signedAt) return res.status(409).json({ error: "Note is signed and locked. Add an addendum instead." });
    const f = req.body ?? {};
    const [updated] = await db.update(soapNotes).set({
      subjective: f.subjective ?? note.subjective,
      objective: f.objective ?? note.objective,
      assessment: f.assessment ?? note.assessment,
      plan: f.plan ?? note.plan,
      pulpalDiagnosis: f.pulpalDiagnosis ?? note.pulpalDiagnosis,
      apicalDiagnosis: f.apicalDiagnosis ?? note.apicalDiagnosis,
      diagnosticTests: f.diagnosticTests ?? note.diagnosticTests,
      canals: f.canals ?? note.canals,
      cdtCodes: f.cdtCodes ?? note.cdtCodes,
      aiDraft: f.aiDraft ?? note.aiDraft,
    }).where(eq(soapNotes.id, note.id)).returning();
    res.json({ note: updated });
  });

  // Sign and lock the note, marking the visit signed.
  app.post("/api/visits/:id/sign", requireAuth, requireRole("clinical_provider", "practice_owner"), async (req, res) => {
    const id = Number(req.params.id);
    const visit = await loadVisitScoped(req, id);
    if (!visit) return res.status(404).json({ error: "Visit not found" });
    const note = await db.query.soapNotes.findFirst({ where: eq(soapNotes.visitId, id) });
    if (!note) return res.status(404).json({ error: "Note not found" });
    if (note.signedAt) return res.status(409).json({ error: "Already signed" });
    const now = new Date();
    await db.update(soapNotes).set({ signedAt: now, signedBy: req.user!.id, aiDraft: false }).where(eq(soapNotes.id, note.id));
    await db.update(visits).set({ status: "signed" }).where(eq(visits.id, id));
    await audit(req, { action: "sign_note", entityType: "soap_note", entityId: note.id, clinicId: visit.clinicId });
    res.json({ ok: true, signedAt: now });
  });

  // Generate an AI SOAP draft from the structured findings. Advisory, the
  // provider edits and signs.
  app.post("/api/visits/:id/ai-soap", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const visit = await loadVisitScoped(req, id);
    if (!visit) return res.status(404).json({ error: "Visit not found" });
    const patient = await db.query.patients.findFirst({ where: eq(patients.id, visit.patientId) });
    const note = await db.query.soapNotes.findFirst({ where: eq(soapNotes.visitId, id) });
    if (!patient || !note) return res.status(404).json({ error: "Not found" });
    const input: SoapInput = {
      toothNumber: visit.toothNumber,
      chiefComplaint: visit.chiefComplaint,
      pulpalDiagnosis: note.pulpalDiagnosis,
      apicalDiagnosis: note.apicalDiagnosis,
      diagnosticTests: (note.diagnosticTests as Record<string, string>) ?? null,
      canals: (note.canals as SoapInput["canals"]) ?? null,
      procedure: req.body?.procedure,
    };
    const draft = await generateSoapDraft(patient, input, req.user!.id);
    res.json({ draft });
  });

  // AI image analysis: advisory overlay-pin findings, persisted to the study.
  app.post("/api/studies/:id/analyze", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const study = await db.query.imageStudies.findFirst({ where: eq(imageStudies.id, id) });
    if (!study || !req.user!.clinicIds.includes(study.clinicId)) return res.status(404).json({ error: "Study not found" });
    const patient = await db.query.patients.findFirst({ where: eq(patients.id, study.patientId) });
    if (!patient) return res.status(404).json({ error: "Patient not found" });
    const findings = await analyzeImage(patient, id, study.sequenceRole, study.toothNumbers?.[0] ?? null, req.user!.id);
    await db.update(imageStudies).set({ aiFindingsJson: findings, status: "flagged" }).where(eq(imageStudies.id, id));
    res.json({ findings });
  });

  // Generate a referral report draft for the visit.
  app.post("/api/visits/:id/report", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const visit = await loadVisitScoped(req, id);
    if (!visit) return res.status(404).json({ error: "Visit not found" });
    const patient = await db.query.patients.findFirst({ where: eq(patients.id, visit.patientId) });
    const note = await db.query.soapNotes.findFirst({ where: eq(soapNotes.visitId, id) });
    if (!patient || !note) return res.status(404).json({ error: "Not found" });
    const referrer = patient.referringDentistId
      ? await db.query.referringDentists.findFirst({ where: eq(referringDentists.id, patient.referringDentistId) })
      : null;
    const { body, provider } = await generateReferralReport(patient, {
      toothNumber: visit.toothNumber, chiefComplaint: visit.chiefComplaint,
      pulpalDiagnosis: note.pulpalDiagnosis, apicalDiagnosis: note.apicalDiagnosis,
      diagnosticTests: (note.diagnosticTests as Record<string, string>) ?? null,
      canals: (note.canals as SoapInput["canals"]) ?? null,
      referrerName: referrer?.fullName, visitDate: String(visit.visitDate),
    }, req.user!.id);
    const existing = await db.query.referralReports.findFirst({ where: eq(referralReports.visitId, id) });
    let report;
    if (existing) {
      [report] = await db.update(referralReports).set({ body, status: "draft", aiDraft: provider !== "mock" }).where(eq(referralReports.id, existing.id)).returning();
    } else {
      [report] = await db.insert(referralReports).values({
        visitId: id, patientId: patient.id, referringDentistId: patient.referringDentistId,
        body, status: "draft", aiDraft: true,
      }).returning();
    }
    res.json({ report });
  });

  // Approve and deliver the report to the referring dentist, with a delivery log.
  app.post("/api/reports/:id/deliver", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const report = await db.query.referralReports.findFirst({ where: eq(referralReports.id, id) });
    if (!report) return res.status(404).json({ error: "Report not found" });
    const patient = await db.query.patients.findFirst({ where: eq(patients.id, report.patientId) });
    if (!patient || !req.user!.clinicIds.includes(patient.clinicId)) return res.status(404).json({ error: "Not found" });
    const channel = req.body?.channel ?? "portal";
    const now = new Date();
    await db.update(referralReports).set({ status: "delivered", approvedBy: req.user!.id, deliveredAt: now }).where(eq(referralReports.id, id));
    await db.insert(reportDeliveryLog).values({ referralReportId: id, referringDentistId: report.referringDentistId, channel, status: "sent" });
    await audit(req, { action: "deliver_report", entityType: "referral_report", entityId: id, clinicId: patient.clinicId, detail: { channel } });
    res.json({ ok: true, deliveredAt: now, channel });
  });

  // Annotations are overlay geometry on an asset. Originals are never mutated.
  app.post("/api/assets/:id/annotations", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const asset = await db.query.imageAssets.findFirst({ where: eq(imageAssets.id, id) });
    if (!asset) return res.status(404).json({ error: "Asset not found" });
    const study = await db.query.imageStudies.findFirst({ where: eq(imageStudies.id, asset.studyId) });
    if (!study || !req.user!.clinicIds.includes(study.clinicId)) return res.status(404).json({ error: "Not found" });
    const { type, geometryJson, label, calibrationMmPerPx } = req.body ?? {};
    const [row] = await db.insert(imageAnnotations).values({
      assetId: id, authorId: req.user!.id, type, geometryJson, label: label ?? null, calibrationMmPerPx: calibrationMmPerPx ?? null,
    }).returning();
    res.json({ annotation: row });
  });

  app.get("/api/assets/:id/annotations", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const rows = await db.select().from(imageAnnotations).where(eq(imageAnnotations.assetId, id));
    res.json({ annotations: rows });
  });
}
