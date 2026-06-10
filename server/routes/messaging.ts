import type { Express } from "express";
import { and, desc, eq, gte, lte, inArray } from "drizzle-orm";
import { db } from "../db";
import { requireAuth } from "../auth";
import { now } from "../clock";
import { conversations, messages, patients, appointments } from "../../shared/schema";

// Two way patient texting on a simulated SMS transport, plus the reminder
// scheduler. Outbound messages are the development outbox, no real SMS is sent.
export function registerMessagingRoutes(app: Express) {
  app.get("/api/conversations", requireAuth, async (req, res) => {
    const scope = req.user!.clinicIds;
    const pts = await db.select().from(patients).where(inArray(patients.clinicId, scope));
    const pById = new Map(pts.map((p) => [p.id, p]));
    const convs = await db.select().from(conversations).orderBy(desc(conversations.lastMessageAt));
    const visible = convs.filter((c) => c.patientId && pById.has(c.patientId));
    const lastMsgs = visible.length
      ? await db.select().from(messages).where(inArray(messages.conversationId, visible.map((c) => c.id)))
      : [];
    const lastByConv = new Map<number, string>();
    for (const m of lastMsgs) lastByConv.set(m.conversationId, m.body);
    res.json({
      conversations: visible.map((c) => ({
        id: c.id, channel: c.channel, subject: c.subject, lastMessageAt: c.lastMessageAt,
        patientName: c.patientId ? `${pById.get(c.patientId)?.firstName} ${pById.get(c.patientId)?.lastName}` : "",
        preview: lastByConv.get(c.id) ?? "",
      })),
    });
  });

  app.get("/api/conversations/:id", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const conv = await db.query.conversations.findFirst({ where: eq(conversations.id, id) });
    if (!conv) return res.status(404).json({ error: "Not found" });
    const msgs = await db.select().from(messages).where(eq(messages.conversationId, id)).orderBy(messages.createdAt);
    const patient = conv.patientId ? await db.query.patients.findFirst({ where: eq(patients.id, conv.patientId) }) : null;
    res.json({ conversation: conv, patientName: patient ? `${patient.firstName} ${patient.lastName}` : "", messages: msgs });
  });

  // Send an outbound text. The transport is simulated, the message lands in the
  // thread and the development outbox.
  app.post("/api/conversations/:id/messages", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const body = String(req.body?.body ?? "").trim();
    if (!body) return res.status(400).json({ error: "Empty message" });
    const [msg] = await db.insert(messages).values({ conversationId: id, direction: "outbound", authorId: req.user!.id, body }).returning();
    await db.update(conversations).set({ lastMessageAt: now() }).where(eq(conversations.id, id));
    res.json({ message: msg });
  });

  app.post("/api/conversations", requireAuth, async (req, res) => {
    const patientId = Number(req.body?.patientId);
    const patient = await db.query.patients.findFirst({ where: eq(patients.id, patientId) });
    if (!patient || !req.user!.clinicIds.includes(patient.clinicId)) return res.status(404).json({ error: "Not found" });
    const [conv] = await db.insert(conversations).values({ patientId, channel: "sms", subject: req.body?.subject ?? "Conversation", lastMessageAt: now() }).returning();
    res.json({ conversation: conv });
  });

  // The reminder scheduler: queue a reminder for each confirmed appointment in
  // the next two days that has a patient with a phone, as an outbound message.
  app.post("/api/reminders/run", requireAuth, async (req, res) => {
    const scope = req.user!.clinicIds;
    const from = now();
    const to = new Date(from.getTime() + 2 * 86400000);
    const appts = await db.select().from(appointments).where(and(
      inArray(appointments.clinicId, scope), gte(appointments.startsAt, from), lte(appointments.startsAt, to),
    ));
    let sent = 0;
    for (const a of appts) {
      if (!a.patientId) continue;
      const patient = await db.query.patients.findFirst({ where: eq(patients.id, a.patientId) });
      if (!patient?.phone) continue;
      let conv = await db.query.conversations.findFirst({ where: eq(conversations.patientId, a.patientId) });
      if (!conv) [conv] = await db.insert(conversations).values({ patientId: a.patientId, channel: "sms", subject: "Appointment reminder", lastMessageAt: now() }).returning();
      await db.insert(messages).values({
        conversationId: conv.id, direction: "outbound", authorId: req.user!.id,
        body: `Reminder from United Endodontics: your visit is ${a.startsAt.toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" })}. Reply C to confirm.`,
      });
      sent++;
    }
    res.json({ sent });
  });
}
