import type { Express } from "express";
import { and, desc, eq, ilike, inArray } from "drizzle-orm";
import { db } from "../db";
import { requireAuth, requireRole } from "../auth";
import { audit } from "../audit";
import { insuranceProfiles, insuranceProfileExceptions } from "../../shared/schema";

// Insurance profiles, adopted from EndoVision: carrier and employer plans with
// coverage percentages, deductibles, an annual maximum, per-code exceptions, and
// advanced deductibles. Includes create-from-existing, a duplicate check, and the
// combine-plans merge.
export function registerInsuranceRoutes(app: Express) {
  app.get("/api/insurance-profiles", requireAuth, async (req, res) => {
    const rows = await db.select().from(insuranceProfiles).where(inArray(insuranceProfiles.clinicId, req.user!.clinicIds)).orderBy(insuranceProfiles.carrier, insuranceProfiles.employer);
    res.json({ profiles: rows });
  });

  // Duplicate check: does a carrier and employer combination already exist.
  app.get("/api/insurance-profiles/check", requireAuth, async (req, res) => {
    const carrier = String(req.query.carrier ?? "").trim();
    const employer = String(req.query.employer ?? "").trim();
    if (!carrier || !employer) return res.json({ exists: false });
    const found = await db.select().from(insuranceProfiles).where(and(
      inArray(insuranceProfiles.clinicId, req.user!.clinicIds), ilike(insuranceProfiles.carrier, carrier), ilike(insuranceProfiles.employer, employer),
    ));
    res.json({ exists: found.length > 0, id: found[0]?.id ?? null });
  });

  app.get("/api/insurance-profiles/:id", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const profile = await db.query.insuranceProfiles.findFirst({ where: eq(insuranceProfiles.id, id) });
    if (!profile || !req.user!.clinicIds.includes(profile.clinicId)) return res.status(404).json({ error: "Not found" });
    const exceptions = await db.select().from(insuranceProfileExceptions).where(eq(insuranceProfileExceptions.profileId, id));
    res.json({ profile, exceptions });
  });

  app.post("/api/insurance-profiles", requireAuth, requireRole("office_manager", "practice_owner", "admin"), async (req, res) => {
    const clinicId = req.user!.clinicIds[0];
    let body = req.body ?? {};
    // Create from an existing profile: seed the fields, then apply overrides.
    if (body.copyFromId) {
      const src = await db.query.insuranceProfiles.findFirst({ where: eq(insuranceProfiles.id, Number(body.copyFromId)) });
      if (src && req.user!.clinicIds.includes(src.clinicId)) {
        body = { groupNumber: src.groupNumber, planType: src.planType, defaultCoveragePercent: src.defaultCoveragePercent, deductibleCents: src.deductibleCents, annualMaximumCents: src.annualMaximumCents, advancedDeductibles: src.advancedDeductibles, ...body };
      }
    }
    const carrier = String(body.carrier ?? "").trim();
    const employer = String(body.employer ?? "").trim();
    if (!carrier || !employer) return res.status(400).json({ error: "Carrier and employer are required" });
    // Reject duplicates, mirroring the EndoVision warning.
    const dup = await db.select().from(insuranceProfiles).where(and(inArray(insuranceProfiles.clinicId, req.user!.clinicIds), ilike(insuranceProfiles.carrier, carrier), ilike(insuranceProfiles.employer, employer)));
    if (dup.length) return res.status(409).json({ error: "A profile with that carrier and employer already exists", duplicate: true });

    const [row] = await db.insert(insuranceProfiles).values({
      clinicId, carrier, employer, groupNumber: body.groupNumber ?? null, planType: body.planType ?? null,
      defaultCoveragePercent: Number(body.defaultCoveragePercent ?? 50), deductibleCents: Number(body.deductibleCents ?? 0),
      annualMaximumCents: Number(body.annualMaximumCents ?? 150000), advancedDeductibles: body.advancedDeductibles ?? null,
    }).returning();
    await audit(req, { action: "create_insurance_profile", entityType: "insurance_profile", entityId: row.id, clinicId });
    res.json({ profile: row });
  });

  app.patch("/api/insurance-profiles/:id", requireAuth, requireRole("office_manager", "practice_owner", "admin"), async (req, res) => {
    const id = Number(req.params.id);
    const profile = await db.query.insuranceProfiles.findFirst({ where: eq(insuranceProfiles.id, id) });
    if (!profile || !req.user!.clinicIds.includes(profile.clinicId)) return res.status(404).json({ error: "Not found" });
    const f = req.body ?? {};
    const [row] = await db.update(insuranceProfiles).set({
      groupNumber: f.groupNumber ?? profile.groupNumber,
      planType: f.planType ?? profile.planType,
      defaultCoveragePercent: f.defaultCoveragePercent != null ? Number(f.defaultCoveragePercent) : profile.defaultCoveragePercent,
      deductibleCents: f.deductibleCents != null ? Number(f.deductibleCents) : profile.deductibleCents,
      annualMaximumCents: f.annualMaximumCents != null ? Number(f.annualMaximumCents) : profile.annualMaximumCents,
      advancedDeductibles: f.advancedDeductibles ?? profile.advancedDeductibles,
    }).where(eq(insuranceProfiles.id, id)).returning();
    res.json({ profile: row });
  });

  // Replace the per-code coverage exceptions list.
  app.put("/api/insurance-profiles/:id/exceptions", requireAuth, requireRole("office_manager", "practice_owner", "admin"), async (req, res) => {
    const id = Number(req.params.id);
    const profile = await db.query.insuranceProfiles.findFirst({ where: eq(insuranceProfiles.id, id) });
    if (!profile || !req.user!.clinicIds.includes(profile.clinicId)) return res.status(404).json({ error: "Not found" });
    const list: { cdtCode: string; coveragePercent: number }[] = Array.isArray(req.body?.exceptions) ? req.body.exceptions : [];
    await db.delete(insuranceProfileExceptions).where(eq(insuranceProfileExceptions.profileId, id));
    if (list.length) await db.insert(insuranceProfileExceptions).values(list.filter((e) => e.cdtCode).map((e) => ({ profileId: id, cdtCode: e.cdtCode, coveragePercent: Number(e.coveragePercent) })));
    const exceptions = await db.select().from(insuranceProfileExceptions).where(eq(insuranceProfileExceptions.profileId, id));
    res.json({ exceptions });
  });

  // Combine two profiles: the loser's exceptions move to the winner, then the
  // loser is removed. Mirrors the EndoVision combine-plans flow (EV#7).
  app.post("/api/insurance-profiles/combine", requireAuth, requireRole("office_manager", "practice_owner", "admin"), async (req, res) => {
    const keepId = Number(req.body?.keepId);
    const dropId = Number(req.body?.dropId);
    const keep = await db.query.insuranceProfiles.findFirst({ where: eq(insuranceProfiles.id, keepId) });
    const drop = await db.query.insuranceProfiles.findFirst({ where: eq(insuranceProfiles.id, dropId) });
    if (!keep || !drop || !req.user!.clinicIds.includes(keep.clinicId) || !req.user!.clinicIds.includes(drop.clinicId)) return res.status(404).json({ error: "Not found" });
    await db.update(insuranceProfileExceptions).set({ profileId: keepId }).where(eq(insuranceProfileExceptions.profileId, dropId));
    await db.delete(insuranceProfiles).where(eq(insuranceProfiles.id, dropId));
    await audit(req, { action: "combine_insurance_profiles", entityType: "insurance_profile", entityId: keepId, detail: { dropped: dropId } });
    res.json({ ok: true, keepId });
  });
}
