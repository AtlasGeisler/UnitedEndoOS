import type { Express } from "express";
import crypto from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { requireAuth, requireRole } from "../auth";
import { audit } from "../audit";
import { now } from "../clock";
import { claims, invoices, invoiceItems, payments, patients, visits, paymentBatches } from "../../shared/schema";

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

  // Claims a bulk payment can be applied to: submitted or accepted, not yet paid.
  app.get("/api/claims/payable", requireAuth, async (req, res) => {
    const scope = req.user!.clinicIds;
    const carrier = req.query.carrier ? String(req.query.carrier) : null;
    const rows = await db.select().from(claims).where(inArray(claims.status, ["submitted", "accepted"]));
    const pts = await db.select().from(patients).where(inArray(patients.clinicId, scope));
    const pName = new Map(pts.map((p) => [p.id, `${p.firstName} ${p.lastName}`]));
    const inScope = new Set(pts.map((p) => p.id));
    res.json({
      claims: rows
        .filter((c) => inScope.has(c.patientId) && (!carrier || c.carrier === carrier))
        .map((c) => {
          const elig = eligibilityFor(c.carrier);
          const insuranceCents = Math.round((c.totalCents * elig.coveragePercent) / 100);
          return { id: c.id, patientName: pName.get(c.patientId), carrier: c.carrier, totalCents: c.totalCents, insuranceCents };
        }),
    });
  });

  // Post a bulk insurance payment across the selected claims at once.
  app.post("/api/payment-batches", requireAuth, requireRole("office_manager", "practice_owner", "admin"), async (req, res) => {
    const scope = req.user!.clinicIds;
    const { name, carrier, method, checkNumber, claimIds } = req.body ?? {};
    const ids: number[] = Array.isArray(claimIds) ? claimIds.map(Number) : [];
    if (!name || ids.length === 0) return res.status(400).json({ error: "A name and at least one claim are required" });

    const clinicId = scope[0];
    const [batch] = await db.insert(paymentBatches).values({ clinicId, name, carrier: carrier ?? null, method: method ?? "eft", checkNumber: checkNumber ?? null, paymentDate: now(), createdBy: req.user!.id }).returning();

    let total = 0, applied = 0;
    for (const id of ids) {
      const claim = await db.query.claims.findFirst({ where: eq(claims.id, id) });
      if (!claim) continue;
      const patient = await db.query.patients.findFirst({ where: eq(patients.id, claim.patientId) });
      if (!patient || !scope.includes(patient.clinicId)) continue;
      const elig = eligibilityFor(claim.carrier);
      const insurancePaid = Math.round((claim.totalCents * elig.coveragePercent) / 100);
      const patientPortion = claim.totalCents - insurancePaid;
      await db.update(claims).set({ status: "paid", paidCents: insurancePaid, resolvedAt: now() }).where(eq(claims.id, id));
      await db.insert(payments).values({ patientId: claim.patientId, invoiceId: claim.invoiceId, amountCents: insurancePaid, method: "insurance", reference: `${name}${checkNumber ? ` #${checkNumber}` : ""}`, batchId: batch.id });
      await db.update(patients).set({ balanceCents: (patient.balanceCents ?? 0) + patientPortion }).where(eq(patients.id, patient.id));
      total += insurancePaid; applied++;
    }
    await db.update(paymentBatches).set({ amountCents: total, claimCount: applied }).where(eq(paymentBatches.id, batch.id));
    await audit(req, { action: "bulk_insurance_payment", entityType: "payment_batch", entityId: batch.id, clinicId, detail: { applied, total } });
    res.json({ batchId: batch.id, applied, totalCents: total });
  });

  app.get("/api/payment-batches", requireAuth, async (req, res) => {
    const rows = await db.select().from(paymentBatches).where(inArray(paymentBatches.clinicId, req.user!.clinicIds)).orderBy(desc(paymentBatches.createdAt)).limit(20);
    res.json({ batches: rows });
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

  // Payment tracer: search payments by method, payor type, amount range, and
  // date range, scoped to the user's clinics.
  app.get("/api/payments/search", requireAuth, async (req, res) => {
    const scope = req.user!.clinicIds;
    const pts = await db.select().from(patients).where(inArray(patients.clinicId, scope));
    const pName = new Map(pts.map((p) => [p.id, `${p.firstName} ${p.lastName}`]));
    const inScope = new Set(pts.map((p) => p.id));

    const method = req.query.method ? String(req.query.method) : null;
    const payor = req.query.payor ? String(req.query.payor) : null; // insurance | patient
    const minCents = req.query.min ? Math.round(Number(req.query.min) * 100) : null;
    const maxCents = req.query.max ? Math.round(Number(req.query.max) * 100) : null;
    const from = req.query.from ? new Date(`${req.query.from}T00:00:00`) : null;
    const to = req.query.to ? new Date(`${req.query.to}T23:59:59`) : null;

    const rows = await db.select().from(payments).orderBy(desc(payments.createdAt)).limit(500);
    const results = rows.filter((p) => {
      if (!inScope.has(p.patientId)) return false;
      if (method && p.method !== method) return false;
      if (payor === "insurance" && p.method !== "insurance") return false;
      if (payor === "patient" && p.method === "insurance") return false;
      if (minCents != null && p.amountCents < minCents) return false;
      if (maxCents != null && p.amountCents > maxCents) return false;
      const d = new Date(p.createdAt);
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    }).slice(0, 100);

    res.json({
      payments: results.map((p) => ({ id: p.id, patientName: pName.get(p.patientId), amountCents: p.amountCents, method: p.method, reference: p.reference, createdAt: p.createdAt })),
      totalCents: results.reduce((m, p) => m + p.amountCents, 0),
    });
  });

  // The patient ledger: charge lines across the patient's invoices, for billing.
  app.get("/api/patients/:id/ledger", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const patient = await db.query.patients.findFirst({ where: eq(patients.id, id) });
    if (!patient || !req.user!.clinicIds.includes(patient.clinicId)) return res.status(404).json({ error: "Not found" });
    const invs = await db.select().from(invoices).where(eq(invoices.patientId, id));
    const items = invs.length ? await db.select().from(invoiceItems).where(inArray(invoiceItems.invoiceId, invs.map((i) => i.id))) : [];
    res.json({ items: items.map((it) => ({ id: it.id, invoiceId: it.invoiceId, cdtCode: it.cdtCode, description: it.description, feeCents: it.feeCents })) });
  });

  // Create a single claim from selected ledger lines, transferring to insurance.
  app.post("/api/claims/from-items", requireAuth, async (req, res) => {
    const { patientId, itemIds } = req.body ?? {};
    const patient = await db.query.patients.findFirst({ where: eq(patients.id, Number(patientId)) });
    if (!patient || !req.user!.clinicIds.includes(patient.clinicId)) return res.status(404).json({ error: "Not found" });
    const ids: number[] = Array.isArray(itemIds) ? itemIds.map(Number) : [];
    if (ids.length === 0) return res.status(400).json({ error: "Select at least one charge" });
    const items = await db.select().from(invoiceItems).where(inArray(invoiceItems.id, ids));
    const totalCents = items.reduce((m, it) => m + it.feeCents, 0);
    const [claim] = await db.insert(claims).values({
      patientId: patient.id, invoiceId: items[0]?.invoiceId ?? null, carrier: patient.insuranceCarrier,
      totalCents, status: "draft",
    }).returning();
    await audit(req, { action: "claim_from_ledger", entityType: "claim", entityId: claim.id, clinicId: patient.clinicId, detail: { lines: items.length, totalCents } });
    res.json({ claim });
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
