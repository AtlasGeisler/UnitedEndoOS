import { and, eq, gte, lte, isNull, inArray } from "drizzle-orm";
import { db } from "./db";
import { appointments, appointmentTypes } from "../shared/schema";
import { now } from "./clock";

// The Thanksgiving Rule. Its spirit: never refuse a same-day emergency referral.
// Emergency slots are protected and held open until a release time, by default
// 2 PM. A non-emergency booking into a still-protected slot is blocked, a manager
// may override with a logged reason, and at the release time the daily job frees
// any protected slot still unbooked. When the home location is full, the engine
// suggests the other location.

export const DEFAULT_RELEASE_HOUR = 14;

export function releaseTimeFor(date: Date, hour = DEFAULT_RELEASE_HOUR): Date {
  const d = new Date(date);
  d.setHours(hour, 0, 0, 0);
  return d;
}

export interface BookResult {
  ok: boolean;
  status: number;
  reason?: string;
  appointmentId?: number;
}

// Books a patient into an existing slot. An emergency booking is always allowed.
// A non-emergency booking into a protected slot before its release is blocked
// unless a manager supplies an override reason.
export async function bookSlot(opts: {
  slotId: number;
  patientId: number;
  isEmergency: boolean;
  actorRole: string;
  overrideReason?: string;
  actorClinicIds: number[];
}): Promise<BookResult> {
  const slot = await db.query.appointments.findFirst({ where: eq(appointments.id, opts.slotId) });
  if (!slot || !opts.actorClinicIds.includes(slot.clinicId)) return { ok: false, status: 404, reason: "Slot not found" };
  if (slot.patientId) return { ok: false, status: 409, reason: "Slot already booked" };

  const stillProtected = slot.isProtected && slot.releaseTime != null && now() < new Date(slot.releaseTime);
  if (stillProtected && !opts.isEmergency) {
    const isManager = opts.actorRole === "office_manager" || opts.actorRole === "practice_owner";
    if (!isManager || !opts.overrideReason) {
      return {
        ok: false,
        status: 403,
        reason: "This is a protected emergency slot. A manager may override with a reason, or it frees at the release time.",
      };
    }
  }

  await db.update(appointments).set({
    patientId: opts.patientId,
    status: "scheduled",
    isProtected: false,
    note: opts.overrideReason ? `Manager override: ${opts.overrideReason}` : slot.note,
  }).where(eq(appointments.id, opts.slotId));

  return { ok: true, status: 200, appointmentId: opts.slotId };
}

// The release job: frees protected slots whose release time has passed and that
// are still unbooked, so regular scheduling can use them.
export async function runRelease(clinicIds: number[]): Promise<{ released: number; ids: number[] }> {
  const due = await db
    .select()
    .from(appointments)
    .where(and(
      inArray(appointments.clinicId, clinicIds),
      eq(appointments.isProtected, true),
      isNull(appointments.patientId),
      lte(appointments.releaseTime, now()),
    ));
  for (const slot of due) {
    await db.update(appointments).set({ isProtected: false, status: "available" }).where(eq(appointments.id, slot.id));
  }
  return { released: due.length, ids: due.map((s) => s.id) };
}

// Daily utilization: booked minutes against available chair minutes per provider.
export async function utilization(clinicId: number, dayStart: Date, dayEnd: Date) {
  const rows = await db
    .select()
    .from(appointments)
    .where(and(eq(appointments.clinicId, clinicId), gte(appointments.startsAt, dayStart), lte(appointments.startsAt, dayEnd)));
  const booked = rows.filter((r) => r.patientId).reduce((m, r) => m + (new Date(r.endsAt).getTime() - new Date(r.startsAt).getTime()) / 60000, 0);
  const protectedOpen = rows.filter((r) => r.isProtected && !r.patientId).length;
  return { totalSlots: rows.length, bookedMinutes: booked, protectedOpen };
}

export async function emergencyTypeIds(): Promise<Set<number>> {
  const types = await db.select().from(appointmentTypes).where(eq(appointmentTypes.isEmergency, true));
  return new Set(types.map((t) => t.id));
}
