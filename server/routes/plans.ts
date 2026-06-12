import type { Express } from "express";
import sharp from "sharp";
import { desc, eq } from "drizzle-orm";
import { db } from "../db";
import { requireAuth } from "../auth";
import { audit } from "../audit";
import { storage } from "../storage";
import { now } from "../clock";
import { treatmentPlans, patients } from "../../shared/schema";

interface PlanOption {
  key: string;
  name: string;
  items: { cdt: string; description: string; feeCents: number }[];
  insuranceEstimateCents: number;
}

// Treatment plans: multi option plans with per option fees and insurance
// estimates, a canvas e-signature, and a signed snapshot stored to files.
export function registerPlanRoutes(app: Express) {
  app.get("/api/patients/:id/plans", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const rows = await db.select().from(treatmentPlans).where(eq(treatmentPlans.patientId, id)).orderBy(desc(treatmentPlans.createdAt));
    res.json({ plans: rows });
  });

  app.post("/api/plans", requireAuth, async (req, res) => {
    const { patientId, title, options } = req.body ?? {};
    const patient = await db.query.patients.findFirst({ where: eq(patients.id, Number(patientId)) });
    if (!patient || !req.user!.clinicIds.includes(patient.clinicId)) return res.status(404).json({ error: "Patient not found" });
    const [row] = await db.insert(treatmentPlans).values({
      patientId: Number(patientId), createdBy: req.user!.id, title: title ?? "Treatment plan",
      options: options ?? [], status: "proposed",
    }).returning();
    await audit(req, { action: "create_plan", entityType: "treatment_plan", entityId: row.id, clinicId: patient.clinicId });
    res.json({ plan: row });
  });

  // Update the plan's pre-authorization tracking.
  app.patch("/api/plans/:id/preauth", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const plan = await db.query.treatmentPlans.findFirst({ where: eq(treatmentPlans.id, id) });
    if (!plan) return res.status(404).json({ error: "Plan not found" });
    const patient = await db.query.patients.findFirst({ where: eq(patients.id, plan.patientId) });
    if (!patient || !req.user!.clinicIds.includes(patient.clinicId)) return res.status(404).json({ error: "Not found" });
    const cur = (plan.preAuth as Record<string, unknown>) ?? {};
    const [row] = await db.update(treatmentPlans).set({ preAuth: { ...cur, ...(req.body ?? {}) } }).where(eq(treatmentPlans.id, id)).returning();
    await audit(req, { action: "update_plan_preauth", entityType: "treatment_plan", entityId: id, clinicId: patient.clinicId });
    res.json({ plan: row });
  });

  // Capture the e-signature and store a signed snapshot of the chosen option.
  app.post("/api/plans/:id/sign", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const plan = await db.query.treatmentPlans.findFirst({ where: eq(treatmentPlans.id, id) });
    if (!plan) return res.status(404).json({ error: "Plan not found" });
    const patient = await db.query.patients.findFirst({ where: eq(patients.id, plan.patientId) });
    if (!patient || !req.user!.clinicIds.includes(patient.clinicId)) return res.status(404).json({ error: "Not found" });

    const { signatureDataUrl, chosenOptionKey } = req.body ?? {};
    if (!signatureDataUrl) return res.status(400).json({ error: "Signature required" });

    const signedAt = now();
    // Store the signature image.
    const sigMatch = /^data:image\/png;base64,(.+)$/.exec(String(signatureDataUrl));
    const sigBuf = sigMatch ? Buffer.from(sigMatch[1], "base64") : Buffer.from("");
    const sig = await storage.put(`plans/${id}/signature.png`, sigBuf);

    // Render a signed snapshot of the plan, the patient name, the chosen option,
    // and the signature, as a stored image standing in for the signed PDF.
    const options = (plan.options as PlanOption[]) ?? [];
    const chosen = options.find((o) => o.key === chosenOptionKey) ?? options[0];
    const snapshot = await renderSnapshot(plan.title, `${patient.firstName} ${patient.lastName}`, chosen, signatureDataUrl, signedAt);
    const snap = await storage.put(`plans/${id}/snapshot.png`, snapshot);

    await db.update(treatmentPlans).set({
      status: "signed", signedAt, signaturePath: sig.storagePath, pdfPath: snap.storagePath,
      options: options.map((o) => ({ ...o, chosen: o.key === chosen?.key })),
    }).where(eq(treatmentPlans.id, id));
    await audit(req, { action: "sign_plan", entityType: "treatment_plan", entityId: id, clinicId: patient.clinicId });
    res.json({ ok: true, snapshotPath: snap.storagePath });
  });

  // Serve a plan snapshot or signature, authenticated.
  app.get("/api/plans/:id/snapshot", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const plan = await db.query.treatmentPlans.findFirst({ where: eq(treatmentPlans.id, id) });
    if (!plan?.pdfPath) return res.status(404).json({ error: "No snapshot" });
    try {
      const buf = await storage.get(plan.pdfPath);
      res.setHeader("Content-Type", "image/png");
      res.send(buf);
    } catch {
      res.status(404).json({ error: "Missing" });
    }
  });
}

async function renderSnapshot(title: string, patientName: string, option: PlanOption | undefined, signatureDataUrl: string, signedAt: Date): Promise<Buffer> {
  const lines = (option?.items ?? []).map((it, i) => `<text x="60" y="${260 + i * 30}" font-family="Inter, sans-serif" font-size="15" fill="#1A1A1A">${esc(it.cdt)}  ${esc(it.description)}</text><text x="740" y="${260 + i * 30}" text-anchor="end" font-family="Inter" font-size="15" fill="#1A1A1A">$${(it.feeCents / 100).toFixed(2)}</text>`).join("");
  const total = (option?.items ?? []).reduce((m, it) => m + it.feeCents, 0);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
    <rect width="800" height="600" fill="#F5F0E8"/>
    <rect x="0" y="0" width="800" height="90" fill="#1E3A28"/>
    <text x="60" y="45" font-family="Georgia, serif" font-size="26" fill="#F5F0E8">United Endodontics</text>
    <text x="60" y="70" font-family="Inter" font-size="14" fill="#7CB68A">Signed treatment plan</text>
    <text x="60" y="140" font-family="Inter" font-size="20" font-weight="700" fill="#1A1A1A">${esc(title)}</text>
    <text x="60" y="170" font-family="Inter" font-size="15" fill="#5C6557">Patient: ${esc(patientName)}</text>
    <text x="60" y="215" font-family="Inter" font-size="16" font-weight="700" fill="#3A7D44">${esc(option?.name ?? "Selected option")}</text>
    ${lines}
    <line x1="60" y1="${280 + (option?.items.length ?? 0) * 30}" x2="740" y2="${280 + (option?.items.length ?? 0) * 30}" stroke="#C2C9BD"/>
    <text x="60" y="${310 + (option?.items.length ?? 0) * 30}" font-family="Inter" font-size="16" font-weight="700" fill="#1A1A1A">Total</text>
    <text x="740" y="${310 + (option?.items.length ?? 0) * 30}" text-anchor="end" font-family="Inter" font-size="16" font-weight="700" fill="#1A1A1A">$${(total / 100).toFixed(2)}</text>
    <text x="60" y="500" font-family="Inter" font-size="13" fill="#5C6557">Patient signature, ${signedAt.toLocaleDateString("en-US")}</text>
    <image x="60" y="505" width="280" height="70" href="${signatureDataUrl}"/>
    <line x1="60" y1="575" x2="340" y2="575" stroke="#1A1A1A"/>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

function esc(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
