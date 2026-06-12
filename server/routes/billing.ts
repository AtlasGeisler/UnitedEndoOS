import type { Express } from "express";
import crypto from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { requireAuth } from "../auth";
import { audit } from "../audit";
import { now } from "../clock";
import { claims, invoices, invoiceItems, payments, patients, visits } from "../../shared/schema";

// RCM lite. Eligibility, claims from draft to paid with auto posted ERAs,
// statements, patient payments, and pay by text, all on a mock gateway and a
// simulated clearinghouse so the cycle runs offline. No real money moves.

// A simulated clearinghouse eligibility response, varied by carrier.
function eligibilityFor(carrier: string | null) {
  const seed = crypto.createHash("md5").update(carrier ?? "self").digest()[0];
  const coverage = carrier === "Self pay" ? 0 : 50 + (seed % 4) * 10; // 50 to 80 percent
  return {
    carrier: carrier ?? "Self pay",
    active: carrier !== "Self pay",
    coveragePercent: coverage,
    deductibleCents: (seed % 5) * 5000,
    annualMaximumCents: 150000,
    remainingMaximumCents: 150000 - (seed % 6) * 15000,
    note: carrier && carrier !== "Self pay" ? `${carrier} covers endodontics at ${coverage} percent after deductible.` : "Self pay, no coverage on file.",
  };
}

export function registerBillingRoutes(app: Express) {
  // Claims list, scoped, with patient names.
  app.get("/api/claims", requireAuth, async (req, res) => {
    const scope = req.user!.clinicIds;
    const rows = await db.select().from(claims).orderBy(desc(claims.createdAt)).limit(200);
    const pts = await db.select().from(patients).where(inArray(patients.clinicId, scope));
    const pIn = new Set(pts.map((p) => p.id));
    const pName = new Map(pts.map((p) => [p.id, `${p.firstName} ${p.lastName}`]));
    res.json({ claims: rows.filter((c) => pIn.has(c.patientId)).map((c) => ({ ...c, patientName: pName.get(c.patientId) })) });
  });

  // Simulated eligibility check, with a little latency.
  app.get("/api/patients/:id/eligibility", requireAuth, async (req, res) => {
    const patient = await db.query.patients.findFirst({ where: eq(patients.id, Number(req.params.id)) });
    if (!patient || !req.user!.clinicIds.includes(patient.clinicId)) return res.status(404).json({ error: "Not found" });
    await new Promise((r) => setTimeout(r, 400));
    await audit(req, { action: "check_eligibility", entityType: "patient", entityId: patient.id, clinicId: patient.clinicId });
    res.json({ eligibility: eligibilityFor(patient.insuranceCarrier) });
  });

  // Create a claim from a visit's invoice.
  app.post("/api/claims", requireAuth, async (req, res) => {
    const visitId = Number(req.body?.visitId);
    const visit = await db.query.visits.findFirst({ where: eq(visits.id, visitId) });
    if (!visit || !req.user!.clinicIds.includes(visit.clinicId)) return res.status(404).json({ error: "Visit not found" });
    const patient = await db.query.patients.findFirst({ where: eq(patients.id, visit.patientId) });
    let invoice = await db.query.invoices.findFirst({ where: eq(invoices.visitId, visitId) });
    if (!invoice) [invoice] = await db.insert(invoices).values({ patientId: visit.patientId, visitId, totalCents: 135500, status: "open" }).returning();
    const [row] = await db.insert(claims).values({
      patientId: visit.patientId, visitId, invoiceId: invoice.id, carrier: patient?.insuranceCarrier,
      totalCents: invoice.totalCents, status: "draft",
    }).returning();
    res.json({ claim: row });
  });

  app.post("/api/claims/:id/submit", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const claim = await db.query.claims.findFirst({ where: eq(claims.id, id) });
    if (!claim) return res.status(404).json({ error: "Not found" });
    const [row] = await db.update(claims).set({ status: "submitted", submittedAt: now(), submissionCount: (claim.submissionCount ?? 0) + 1 }).where(eq(claims.id, id)).returning();
    await audit(req, { action: "submit_claim", entityType: "claim", entityId: id });
    res.json({ claim: row });
  });

  // Resubmit a denied claim with a pre-authorization number that rides on it.
  app.post("/api/claims/:id/resubmit", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const claim = await db.query.claims.findFirst({ where: eq(claims.id, id) });
    if (!claim) return res.status(404).json({ error: "Not found" });
    const preAuthNumber = String(req.body?.preAuthNumber ?? "").trim() || null;
    const [row] = await db.update(claims).set({
      status: "submitted", preAuthNumber, submittedAt: now(), resolvedAt: null,
      submissionCount: (claim.submissionCount ?? 0) + 1,
    }).where(eq(claims.id, id)).returning();
    await audit(req, { action: "resubmit_claim", entityType: "claim", entityId: id, detail: { preAuthNumber, attempt: row.submissionCount } });
    res.json({ claim: row });
  });

  // Auto post a simulated ERA: insurance pays its share, the patient portion
  // lands on the patient balance.
  app.post("/api/claims/:id/post-era", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const claim = await db.query.claims.findFirst({ where: eq(claims.id, id) });
    if (!claim) return res.status(404).json({ error: "Not found" });
    const patient = await db.query.patients.findFirst({ where: eq(patients.id, claim.patientId) });
    const elig = eligibilityFor(patient?.insuranceCarrier ?? null);
    const insurancePaid = Math.round((claim.totalCents * elig.coveragePercent) / 100);
    const patientPortion = claim.totalCents - insurancePaid;
    const [row] = await db.update(claims).set({ status: "paid", paidCents: insurancePaid, resolvedAt: now() }).where(eq(claims.id, id)).returning();
    await db.insert(payments).values({ patientId: claim.patientId, invoiceId: claim.invoiceId, amountCents: insurancePaid, method: "insurance", reference: `ERA auto-post, ${elig.carrier}` });
    if (patient) await db.update(patients).set({ balanceCents: (patient.balanceCents ?? 0) + patientPortion }).where(eq(patients.id, patient.id));
    await audit(req, { action: "post_era", entityType: "claim", entityId: id, detail: { insurancePaid, patientPortion } });
    res.json({ claim: row, insurancePaid, patientPortion });
  });

  // Collect a patient payment on the mock gateway, reducing the balance.
  app.post("/api/patients/:id/pay", requireAuth, async (req, res) => {
    const patient = await db.query.patients.findFirst({ where: eq(patients.id, Number(req.params.id)) });
    if (!patient || !req.user!.clinicIds.includes(patient.clinicId)) return res.status(404).json({ error: "Not found" });
    const amountCents = Math.min(Number(req.body?.amountCents ?? 0), patient.balanceCents);
    if (amountCents <= 0) return res.status(400).json({ error: "Nothing to collect" });
    const method = req.body?.method ?? "card";
    await db.insert(payments).values({ patientId: patient.id, amountCents, method, reference: `MockGateway ${crypto.randomUUID().slice(0, 8)}` });
    const [updated] = await db.update(patients).set({ balanceCents: patient.balanceCents - amountCents }).where(eq(patients.id, patient.id)).returning();
    await audit(req, { action: "collect_payment", entityType: "patient", entityId: patient.id, clinicId: patient.clinicId, detail: { amountCents, method } });
    res.json({ ok: true, balanceCents: updated.balanceCents });
  });

  // A pay by text link, a tokenized public pay page (simulated).
  app.post("/api/patients/:id/pay-by-text", requireAuth, async (req, res) => {
    const patient = await db.query.patients.findFirst({ where: eq(patients.id, Number(req.params.id)) });
    if (!patient || !req.user!.clinicIds.includes(patient.clinicId)) return res.status(404).json({ error: "Not found" });
    const token = crypto.createHmac("sha256", "ueos-pay").update(`pay:${patient.id}`).digest("hex").slice(0, 12);
    res.json({ link: `/pay/${patient.id}?t=${token}`, sentTo: patient.phone, balanceCents: patient.balanceCents });
  });

  // A daily receipt: every transaction posted for the patient on a given day,
  // with the running total and the current balance. Downloadable as text.
  app.get("/api/patients/:id/receipt", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const patient = await db.query.patients.findFirst({ where: eq(patients.id, id) });
    if (!patient || !req.user!.clinicIds.includes(patient.clinicId)) return res.status(404).json({ error: "Not found" });
    const dateStr = String(req.query.date ?? now().toISOString().slice(0, 10));
    const dayStart = new Date(`${dateStr}T00:00:00`);
    const dayEnd = new Date(`${dateStr}T23:59:59`);
    const pays = await db.select().from(payments).where(eq(payments.patientId, id));
    const items = pays.filter((p) => { const d = new Date(p.createdAt); return d >= dayStart && d <= dayEnd; });
    const totalCents = items.reduce((m, p) => m + p.amountCents, 0);

    if (req.query.format === "txt") {
      const lines = [
        "United Endodontics", `Receipt for ${patient.firstName} ${patient.lastName}`,
        `Date: ${dateStr}`, "",
        ...items.map((p) => `  ${p.method.padEnd(10)} ${p.reference ?? ""}  $${(p.amountCents / 100).toFixed(2)}`),
        items.length ? "" : "  No transactions posted on this day.",
        `Total posted today: $${(totalCents / 100).toFixed(2)}`,
        `Account balance: $${((patient.balanceCents ?? 0) / 100).toFixed(2)}`,
      ];
      res.setHeader("Content-Type", "text/plain");
      res.setHeader("Content-Disposition", `attachment; filename="receipt-${id}-${dateStr}.txt"`);
      return res.send(lines.join("\n"));
    }
    res.json({ date: dateStr, items, totalCents, balanceCents: patient.balanceCents ?? 0 });
  });

  // A patient statement: balance and the recent invoice lines.
  app.get("/api/patients/:id/statement", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const patient = await db.query.patients.findFirst({ where: eq(patients.id, id) });
    if (!patient || !req.user!.clinicIds.includes(patient.clinicId)) return res.status(404).json({ error: "Not found" });
    const invs = await db.select().from(invoices).where(eq(invoices.patientId, id));
    const items = invs.length ? await db.select().from(invoiceItems).where(inArray(invoiceItems.invoiceId, invs.map((i) => i.id))) : [];
    const pays = await db.select().from(payments).where(eq(payments.patientId, id)).orderBy(desc(payments.createdAt)).limit(20);
    res.json({ balanceCents: patient.balanceCents, items, payments: pays });
  });
}
