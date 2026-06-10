import type { Express } from "express";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import { requireAuth } from "../auth";
import { now } from "../clock";
import { getProvider, isMock } from "../ai-providers";
import { buildRedaction, redact, reinsert } from "../phi-redaction";
import { PREAUTH_SYSTEM, APPEAL_SYSTEM } from "../prompts";
import {
  visits, soapNotes, patients, claims, payments, referringDentists, appointments,
  appointmentTypes, staffProfiles, users, clinics, reportDeliveryLog, referralReports,
  configCategories, configOptions, aiPrompts, aiPredictionWeights, aiAuditLogs,
  insuranceNarratives, carrierPatterns,
} from "../../shared/schema";

// Analytics, Performance, Operations, and Admin, plus insurance narratives and
// the restorative follow-up tracker. The tracker flags completed RCTs that lack
// a permanent restoration after 30 days, since the coronal seal is the survival
// variable in endodontics.
export function registerInsightRoutes(app: Express) {
  app.get("/api/analytics", requireAuth, async (req, res) => {
    const scope = req.user!.clinicIds;
    const allVisits = await db.select().from(visits).where(inArray(visits.clinicId, scope));
    const signed = allVisits.filter((v) => v.status === "signed");
    const planned = allVisits.filter((v) => v.status !== "signed");

    // Revenue by month for the last six months, with a three month projection.
    const pays = await db.select().from(payments);
    const months: { label: string; key: string }[] = [];
    const ref = now();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(ref.getFullYear(), ref.getMonth() - i, 1);
      months.push({ label: d.toLocaleDateString("en-US", { month: "short" }), key: `${d.getFullYear()}-${d.getMonth()}` });
    }
    const byMonth = new Map(months.map((m) => [m.key, 0]));
    for (const p of pays) {
      const d = new Date(p.createdAt);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (byMonth.has(key)) byMonth.set(key, byMonth.get(key)! + p.amountCents);
    }
    const revenue = months.map((m) => ({ month: m.label, actualCents: byMonth.get(m.key) ?? 0 }));
    const avg = revenue.reduce((s, r) => s + r.actualCents, 0) / (revenue.filter((r) => r.actualCents > 0).length || 1);
    const projection = [1, 2, 3].map((i) => {
      const d = new Date(ref.getFullYear(), ref.getMonth() + i, 1);
      return { month: d.toLocaleDateString("en-US", { month: "short" }), projectedCents: Math.round(avg * (1 + i * 0.04)) };
    });

    // Referrer performance.
    const counts = await db.select({ id: patients.referringDentistId, n: sql<number>`count(*)::int` }).from(patients).groupBy(patients.referringDentistId);
    const dentists = await db.select().from(referringDentists);
    const dName = new Map(dentists.map((d) => [d.id, d.fullName]));
    const referrerPerformance = counts.filter((c) => c.id != null).map((c) => ({ name: dName.get(c.id!) ?? "", count: c.n })).sort((a, b) => b.count - a.count).slice(0, 8);

    res.json({
      caseCompletion: { completed: signed.length, planned: planned.length },
      revenue, projection,
      referrerPerformance,
      restorative: await restorativeTracker(scope),
    });
  });

  app.get("/api/performance", requireAuth, async (req, res) => {
    const scope = req.user!.clinicIds;
    const providers = await db.select().from(staffProfiles).where(eq(staffProfiles.isProvider, true));
    const allVisits = await db.select().from(visits).where(inArray(visits.clinicId, scope));
    const reports = await db.select().from(referralReports);
    const emergencyTypeIds = new Set((await db.select().from(appointmentTypes).where(eq(appointmentTypes.isEmergency, true))).map((t) => t.id));
    const appts = await db.select().from(appointments).where(inArray(appointments.clinicId, scope));

    const rows = providers.map((p) => {
      const pv = allVisits.filter((v) => v.providerId === p.userId);
      const completed = pv.filter((v) => v.status === "signed").length;
      const reportTurnaround = 18 + (p.userId % 12); // synthetic hours
      const emergencyAppts = appts.filter((a) => a.providerId === p.userId && a.appointmentTypeId && emergencyTypeIds.has(a.appointmentTypeId));
      const emergencyAccepted = emergencyAppts.filter((a) => a.patientId).length;
      return {
        name: p.displayName, color: p.color,
        cases: pv.length, completed,
        productionCents: completed * 110000,
        reportTurnaroundHours: reportTurnaround,
        emergencyAcceptanceRate: emergencyAppts.length ? Math.round((emergencyAccepted / emergencyAppts.length) * 100) : 100,
        chairUtilization: Math.min(96, 60 + (p.userId % 5) * 7),
      };
    });
    res.json({ providers: rows, reportsTotal: reports.length });
  });

  app.get("/api/operations", requireAuth, async (req, res) => {
    const scope = req.user!.clinicIds;
    const staff = await db.select({ name: staffProfiles.displayName, color: staffProfiles.color, isProvider: staffProfiles.isProvider, role: users.role, email: users.email })
      .from(staffProfiles).innerJoin(users, eq(staffProfiles.userId, users.id));
    const cls = await db.select().from(clinics);
    const deliveries = await db.select().from(reportDeliveryLog).orderBy(desc(reportDeliveryLog.createdAt)).limit(20);
    const dentists = await db.select().from(referringDentists);
    const dName = new Map(dentists.map((d) => [d.id, d.fullName]));
    res.json({
      staff, clinics: cls,
      deliveries: deliveries.map((d) => ({ ...d, dentistName: d.referringDentistId ? dName.get(d.referringDentistId) : null })),
      ruleSettings: { releaseHour: 14, managerOverride: true },
    });
  });

  app.get("/api/admin/config", requireAuth, async (_req, res) => {
    const cats = await db.select().from(configCategories);
    const opts = await db.select().from(configOptions);
    const prompts = await db.select().from(aiPrompts);
    const weights = await db.select().from(aiPredictionWeights);
    res.json({
      categories: cats.map((c) => ({ ...c, options: opts.filter((o) => o.categoryId === c.id) })),
      prompts, weights,
    });
  });

  app.get("/api/admin/ai-audit", requireAuth, async (_req, res) => {
    const rows = await db.select().from(aiAuditLogs).orderBy(desc(aiAuditLogs.createdAt)).limit(40);
    res.json({ logs: rows });
  });

  // Insurance narratives: a 7 section pre-authorization or denial appeal, using
  // the mined prompts and carrier intelligence, PHI redacted before any AI call.
  app.post("/api/narratives", requireAuth, async (req, res) => {
    const { patientId, kind, toothNumber, procedure, denialReason } = req.body ?? {};
    const patient = await db.query.patients.findFirst({ where: eq(patients.id, Number(patientId)) });
    if (!patient || !req.user!.clinicIds.includes(patient.clinicId)) return res.status(404).json({ error: "Not found" });
    const map = buildRedaction(patient);
    const provider = getProvider();

    // Carrier intelligence: known denial patterns and the documentation a carrier
    // wants, addressed proactively in the narrative.
    const carrierRow = patient.insuranceCarrier
      ? await db.query.carrierPatterns.findFirst({ where: eq(carrierPatterns.carrierName, patient.insuranceCarrier) })
      : null;
    const carrierTips = carrierRow
      ? `${carrierRow.tips ?? ""} Common denial reasons: ${(carrierRow.commonDenialReasons ?? []).join(", ")}. Required documentation: ${(carrierRow.requiredDocumentation ?? []).join(", ")}.`
      : "";

    const userPrompt = redact([
      `Patient ${patient.firstName} ${patient.lastName}, tooth ${toothNumber}.`,
      patient.insuranceCarrier ? `Insurance carrier: ${patient.insuranceCarrier}.` : "",
      procedure ? `Procedure: ${procedure}.` : "",
      kind === "appeal" ? `Stated denial reason: ${denialReason ?? "not specified"}.` : "",
      carrierTips ? `Carrier intelligence: ${carrierTips}` : "",
    ].filter(Boolean).join("\n"), map);

    let body: string;
    if (isMock()) {
      body = narrativeSections(kind, { tooth: toothNumber, procedure, denialReason, carrier: patient.insuranceCarrier });
    } else {
      const system = kind === "appeal" ? APPEAL_SYSTEM : PREAUTH_SYSTEM;
      body = reinsert(await provider.chat(system, userPrompt), map) || narrativeSections(kind, { tooth: toothNumber, procedure, denialReason, carrier: patient.insuranceCarrier });
    }

    const [row] = await db.insert(insuranceNarratives).values({ patientId: patient.id, kind, carrierName: patient.insuranceCarrier, procedureCode: procedure ?? null, body, createdBy: req.user!.id }).returning();
    await db.insert(aiAuditLogs).values({ userId: req.user!.id, patientId: patient.id, feature: "narrative", provider: provider.name, redactedInput: { prompt: userPrompt, kind }, output: { length: body.length }, approved: null });
    res.json({ narrative: row });
  });
}

async function restorativeTracker(scope: number[]) {
  const signed = await db.select().from(visits).where(and(inArray(visits.clinicId, scope), eq(visits.status, "signed")));
  const notes = signed.length ? await db.select().from(soapNotes).where(inArray(soapNotes.visitId, signed.map((v) => v.id))) : [];
  const noteByVisit = new Map(notes.map((n) => [n.visitId, n]));
  const pts = await db.select().from(patients).where(inArray(patients.clinicId, scope));
  const pName = new Map(pts.map((p) => [p.id, `${p.firstName} ${p.lastName}`]));
  const ref = now();
  const flagged = [];
  for (const v of signed) {
    const note = noteByVisit.get(v.id);
    const codes = (note?.cdtCodes as string[]) ?? [];
    const hasRestoration = codes.includes("D2954") || codes.includes("D2950");
    const days = Math.floor((ref.getTime() - new Date(v.visitDate).getTime()) / 86400000);
    if (!hasRestoration && days >= 30) {
      flagged.push({ patientId: v.patientId, patientName: pName.get(v.patientId) ?? "", toothNumber: v.toothNumber, daysSince: days });
    }
  }
  return flagged.sort((a, b) => b.daysSince - a.daysSince).slice(0, 30);
}

// The 7 section narrative, deterministic and clinically phrased.
function narrativeSections(kind: string, ctx: { tooth: number; procedure: string; denialReason?: string; carrier: string | null }): string {
  const isAppeal = kind === "appeal";
  const sections = [
    ["Patient and tooth", `This narrative concerns tooth ${ctx.tooth}. The patient is a synthetic record under United Endodontics.`],
    ["Chief complaint and history", `The patient presented with symptoms consistent with endodontic pathology localized to tooth ${ctx.tooth}.`],
    ["Clinical findings", `Pulp testing and periapical evaluation support the diagnosis. Radiographs were obtained and reviewed.`],
    ["Diagnosis", `The pulpal and apical diagnoses establish medical necessity for ${ctx.procedure ?? "endodontic therapy"}.`],
    ["Treatment and rationale", `${ctx.procedure ?? "Root canal therapy"} on tooth ${ctx.tooth} is the appropriate, tooth conserving treatment. The alternative is extraction, which carries greater long term cost and morbidity.`],
    ["Codes and supporting documentation", `Procedure documented with the corresponding CDT code, with periapical radiographs attached. ${ctx.carrier ?? "The carrier"} guidelines are met.`],
    isAppeal
      ? ["Appeal", `The prior denial cited ${ctx.denialReason ?? "insufficient documentation"}. The attached records resolve that concern and support coverage. We respectfully request reconsideration.`]
      : ["Request", `We request pre-authorization for the planned treatment. The documentation supports medical necessity and meets the carrier policy.`],
  ];
  return sections.map(([h, b], i) => `${i + 1}. ${h}\n${b}`).join("\n\n");
}
