import type { Express } from "express";
import { and, eq, gte, lte, inArray, ilike } from "drizzle-orm";
import { db } from "../db";
import { requireAuth, requireRole } from "../auth";
import { audit } from "../audit";
import { now, setClock, isPinned } from "../clock";
import { bookSlot, runRelease, releaseTimeFor, emergencyTypeIds } from "../thanksgiving";
import { extractScheduleFromImage, type ParsedAppointment } from "../ai";
import { appointments, appointmentTypes, patients, users, staffProfiles, referringDentists } from "../../shared/schema";

// The Schedule API and the Thanksgiving Rule endpoints. Bookings route through
// the rule engine, drag and drop moves reschedule, the release job frees
// protected slots, and the clock is injectable so the 2 PM release can be
// exercised on demand.
export function registerScheduleRoutes(app: Express) {
  // The day's columns: providers and operatories, plus the appointments.
  app.get("/api/schedule", requireAuth, async (req, res) => {
    const scope = req.user!.clinicIds;
    if (!scope.length) return res.json({ appointments: [], providers: [], types: [] });
    const clinicId = req.query.clinicId ? Number(req.query.clinicId) : scope[0];
    const dateStr = String(req.query.date ?? now().toISOString().slice(0, 10));
    const dayStart = new Date(`${dateStr}T00:00:00`);
    const dayEnd = new Date(`${dateStr}T23:59:59`);

    const appts = await db.select().from(appointments).where(and(
      eq(appointments.clinicId, clinicId),
      gte(appointments.startsAt, dayStart),
      lte(appointments.startsAt, dayEnd),
    )).orderBy(appointments.startsAt);

    const patientIds = appts.map((a) => a.patientId).filter((x): x is number => x != null);
    const pts = patientIds.length ? await db.select().from(patients).where(inArray(patients.id, patientIds)) : [];
    const pById = new Map(pts.map((p) => [p.id, p]));
    const types = await db.select().from(appointmentTypes);
    const tById = new Map(types.map((t) => [t.id, t]));
    const providers = (await db.select().from(staffProfiles).where(eq(staffProfiles.isProvider, true)));

    res.json({
      date: dateStr,
      clinicId,
      now: now().toISOString(),
      clockPinned: isPinned(),
      providers: providers.map((p) => ({ userId: p.userId, name: p.displayName, color: p.color })),
      types,
      appointments: appts.map((a) => ({
        ...a,
        patientName: a.patientId ? `${pById.get(a.patientId)?.firstName ?? ""} ${pById.get(a.patientId)?.lastName ?? ""}`.trim() : null,
        typeName: a.appointmentTypeId ? tById.get(a.appointmentTypeId)?.name : null,
        typeColor: a.appointmentTypeId ? tById.get(a.appointmentTypeId)?.color : null,
        isEmergencyType: a.appointmentTypeId ? !!tById.get(a.appointmentTypeId)?.isEmergency : false,
      })),
    });
  });

  // Create an appointment or a protected emergency slot.
  app.post("/api/appointments", requireAuth, async (req, res) => {
    const { clinicId, providerId, appointmentTypeId, operatory, startsAt, endsAt, patientId, isProtected } = req.body ?? {};
    if (!req.user!.clinicIds.includes(Number(clinicId))) return res.status(403).json({ error: "Clinic out of scope" });
    const start = new Date(startsAt);
    const [row] = await db.insert(appointments).values({
      clinicId: Number(clinicId), providerId: providerId ? Number(providerId) : null,
      appointmentTypeId: appointmentTypeId ? Number(appointmentTypeId) : null,
      operatory: operatory ?? "Op 1", startsAt: start, endsAt: new Date(endsAt),
      patientId: patientId ? Number(patientId) : null,
      isProtected: !!isProtected,
      releaseTime: isProtected ? releaseTimeFor(start) : null,
      status: isProtected && !patientId ? "protected" : "scheduled",
    }).returning();
    await audit(req, { action: "create_appointment", entityType: "appointment", entityId: row.id, clinicId: Number(clinicId), detail: { isProtected: !!isProtected } });
    res.json({ appointment: row });
  });

  // Book a patient into a slot, through the Thanksgiving Rule engine.
  app.post("/api/appointments/:id/book", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const { patientId, isEmergency, overrideReason } = req.body ?? {};
    if (!patientId) return res.status(400).json({ error: "patientId required" });
    const result = await bookSlot({
      slotId: id, patientId: Number(patientId), isEmergency: !!isEmergency,
      actorRole: req.user!.role, overrideReason, actorClinicIds: req.user!.clinicIds,
    });
    if (!result.ok) return res.status(result.status).json({ error: result.reason });
    await audit(req, {
      action: overrideReason ? "book_override" : "book_slot",
      entityType: "appointment", entityId: id,
      detail: { isEmergency: !!isEmergency, overrideReason: overrideReason ?? null },
    });
    res.json({ ok: true, appointmentId: result.appointmentId });
  });

  // Drag and drop reschedule.
  app.patch("/api/appointments/:id", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const slot = await db.query.appointments.findFirst({ where: eq(appointments.id, id) });
    if (!slot || !req.user!.clinicIds.includes(slot.clinicId)) return res.status(404).json({ error: "Not found" });
    const f = req.body ?? {};
    const [row] = await db.update(appointments).set({
      startsAt: f.startsAt ? new Date(f.startsAt) : slot.startsAt,
      endsAt: f.endsAt ? new Date(f.endsAt) : slot.endsAt,
      operatory: f.operatory ?? slot.operatory,
      providerId: f.providerId != null ? Number(f.providerId) : slot.providerId,
      status: f.status ?? slot.status,
      confirmed: f.confirmed != null ? !!f.confirmed : slot.confirmed,
    }).where(eq(appointments.id, id)).returning();
    res.json({ appointment: row });
  });

  // Run the release job over the user's clinics.
  app.post("/api/schedule/release", requireAuth, requireRole("office_manager", "practice_owner", "front_desk"), async (req, res) => {
    const result = await runRelease(req.user!.clinicIds);
    await audit(req, { action: "release_protected_slots", entityType: "schedule", detail: { released: result.released } });
    res.json(result);
  });

  // The injectable clock, for demos and tests of the release.
  app.post("/api/dev/clock", requireAuth, async (req, res) => {
    setClock(req.body?.iso ?? null);
    res.json({ now: now().toISOString(), pinned: isPinned() });
  });
  app.get("/api/dev/clock", requireAuth, (_req, res) => res.json({ now: now().toISOString(), pinned: isPinned() }));

  // Emergency type ids, so the client can flag an emergency booking.
  app.get("/api/appointment-types", requireAuth, async (_req, res) => {
    const types = await db.select().from(appointmentTypes);
    const emergency = await emergencyTypeIds();
    res.json({ types: types.map((t) => ({ ...t, isEmergency: emergency.has(t.id) })) });
  });

  // Schedule import from image: extract the day's appointments for review, then
  // confirm to create them. A front desk or manager tool.
  app.post("/api/schedule/import-image", requireAuth, requireRole("front_desk", "office_manager", "practice_owner", "admin"), async (req, res) => {
    const { dataUrl, date } = req.body ?? {};
    if (!dataUrl) return res.status(400).json({ error: "An image is required" });
    const today = String(date ?? now().toISOString().slice(0, 10));
    const result = await extractScheduleFromImage(String(dataUrl), today, req.user!.id);
    await audit(req, { action: "schedule_import_extract", entityType: "schedule", detail: { extracted: result.appointments.length } });
    res.json(result);
  });

  app.post("/api/schedule/confirm-import", requireAuth, requireRole("front_desk", "office_manager", "practice_owner", "admin"), async (req, res) => {
    const scope = req.user!.clinicIds;
    const clinicId = Number(req.body?.clinicId ?? scope[0]);
    if (!scope.includes(clinicId)) return res.status(403).json({ error: "Clinic out of scope" });
    const date = String(req.body?.date ?? now().toISOString().slice(0, 10));
    const items: ParsedAppointment[] = Array.isArray(req.body?.appointments) ? req.body.appointments : [];

    const types = await db.select().from(appointmentTypes);
    const dentists = await db.select().from(referringDentists);
    let patientsCreated = 0, appointmentsCreated = 0;

    for (const a of items) {
      if (!a.patientName) continue;
      const [first, ...rest] = a.patientName.trim().split(" ");
      const last = rest.join(" ") || first;
      // Find or create the patient, pending staff review.
      let patient = await db.query.patients.findFirst({ where: and(eq(patients.clinicId, clinicId), ilike(patients.firstName, first), ilike(patients.lastName, last)) });
      if (!patient) {
        const refDoc = a.referringDoctor ? dentists.find((d) => d.fullName.toLowerCase().includes(a.referringDoctor!.replace(/^dr\.?\s*/i, "").toLowerCase())) : null;
        [patient] = await db.insert(patients).values({ clinicId, firstName: first, lastName: last, dateOfBirth: "1990-01-01", status: "pending_review", referringDentistId: refDoc?.id ?? null }).returning();
        patientsCreated++;
      }
      // Match the appointment type by name.
      const type = types.find((t) => (a.appointmentType ?? "").toLowerCase().includes(t.name.split(",")[0].toLowerCase().slice(0, 6))) ?? types[0];
      const start = new Date(`${a.date || date}T${(a.time || "09:00").padStart(5, "0")}:00`);
      const dur = a.duration && a.duration > 0 ? a.duration : 60;
      await db.insert(appointments).values({
        clinicId, patientId: patient.id, providerId: null, appointmentTypeId: type?.id ?? null,
        operatory: "Op 1", startsAt: start, endsAt: new Date(start.getTime() + dur * 60000),
        status: "scheduled", confirmed: false, note: a.notes ?? null,
      });
      appointmentsCreated++;
    }
    await audit(req, { action: "schedule_import_confirm", entityType: "schedule", clinicId, detail: { patientsCreated, appointmentsCreated } });
    res.json({ patientsCreated, appointmentsCreated });
  });
}
