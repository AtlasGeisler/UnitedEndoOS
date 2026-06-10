import type { Express } from "express";
import { and, desc, eq, gte, ilike, inArray } from "drizzle-orm";
import { db } from "../db";
import { now } from "../clock";
import { parsePatientToken, parseIntakeToken, makePatientToken } from "../portal-token";
import { patients, appointments, treatmentPlans, conversations, messages } from "../../shared/schema";

// Public, patient facing surfaces: the office kiosk self check-in, the tokenized
// online intake form, and the read-only patient portal. Synthetic data only.
export function registerPublicRoutes(app: Express) {
  // Kiosk self check-in for the office iPad. A patient finds their appointment by
  // last name and date of birth and checks in, no login.
  app.post("/api/kiosk/checkin", async (req, res) => {
    const lastName = String(req.body?.lastName ?? "").trim();
    const dob = String(req.body?.dateOfBirth ?? "").trim();
    if (!lastName) return res.status(400).json({ error: "Last name is required" });

    const matches = await db.select().from(patients).where(ilike(patients.lastName, lastName));
    const patient = dob ? matches.find((p) => p.dateOfBirth === dob) : matches[0];
    if (!patient) return res.status(404).json({ error: "We could not find your appointment. Please see the front desk." });

    const dayStart = new Date(now()); dayStart.setHours(0, 0, 0, 0);
    const todays = await db.select().from(appointments).where(and(
      eq(appointments.patientId, patient.id), gte(appointments.startsAt, dayStart),
    )).orderBy(appointments.startsAt);
    const appt = todays[0];
    if (!appt) return res.status(404).json({ error: "No upcoming appointment found. Please see the front desk." });

    await db.update(appointments).set({ confirmed: true, status: "arrived" }).where(eq(appointments.id, appt.id));
    res.json({
      ok: true,
      firstName: patient.firstName,
      appointmentTime: appt.startsAt,
      message: `Welcome, ${patient.firstName}. You are checked in. Please have a seat, we will be with you shortly.`,
    });
  });

  // Online intake, a tokenized public link that writes a pending patient for
  // staff review.
  app.get("/api/intake/:token", async (req, res) => {
    const clinicId = parseIntakeToken(req.params.token);
    if (clinicId == null) return res.status(404).json({ error: "Invalid intake link" });
    res.json({ clinicId, ok: true });
  });
  app.post("/api/intake", async (req, res) => {
    const clinicId = parseIntakeToken(String(req.body?.token ?? ""));
    if (clinicId == null) return res.status(401).json({ error: "Invalid intake link" });
    const { firstName, lastName, dateOfBirth, phone, email, insuranceCarrier } = req.body ?? {};
    if (!firstName || !lastName) return res.status(400).json({ error: "Name is required" });
    const [patient] = await db.insert(patients).values({
      clinicId, firstName, lastName, dateOfBirth: dateOfBirth || "1990-01-01",
      phone: phone ?? null, email: email ?? null, insuranceCarrier: insuranceCarrier ?? null,
      status: "pending_review",
    }).returning();
    res.json({ ok: true, patientId: patient.id, portalToken: makePatientToken(patient.id) });
  });

  // The read-only patient portal: upcoming visits, signed plans, balance, and
  // secure messages, reached with a per patient token.
  app.get("/api/patient-portal", async (req, res) => {
    const id = parsePatientToken(String(req.query.token ?? ""));
    if (id == null) return res.status(401).json({ error: "Invalid link" });
    const patient = await db.query.patients.findFirst({ where: eq(patients.id, id) });
    if (!patient) return res.status(404).json({ error: "Not found" });
    const upcoming = await db.select().from(appointments).where(and(eq(appointments.patientId, id), gte(appointments.startsAt, now()))).orderBy(appointments.startsAt).limit(5);
    const plans = await db.select().from(treatmentPlans).where(and(eq(treatmentPlans.patientId, id), eq(treatmentPlans.status, "signed")));
    const convs = await db.select().from(conversations).where(eq(conversations.patientId, id));
    const msgs = convs.length ? await db.select().from(messages).where(inArray(messages.conversationId, convs.map((c) => c.id))).orderBy(desc(messages.createdAt)).limit(10) : [];
    res.json({
      patient: { firstName: patient.firstName, lastName: patient.lastName, balanceCents: patient.balanceCents },
      upcoming: upcoming.map((a) => ({ id: a.id, startsAt: a.startsAt, status: a.status })),
      plans: plans.map((p) => ({ id: p.id, title: p.title, signedAt: p.signedAt })),
      messages: msgs.map((m) => ({ id: m.id, direction: m.direction, body: m.body, createdAt: m.createdAt })),
    });
  });
}
