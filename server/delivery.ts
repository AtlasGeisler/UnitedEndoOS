import crypto from "node:crypto";
import { now } from "./clock";

// A pluggable report delivery service, adopted from the prototype. Email goes
// through SendGrid when a key is configured, otherwise every channel (email,
// fax, portal, print) is simulated and recorded in a development outbox. No real
// message is sent without a configured transport.

export type Channel = "email" | "fax" | "portal" | "print";

export interface DeliveryRequest {
  channel: Channel;
  to: string;
  subject: string;
  body: string;
}
export interface DeliveryResult {
  channel: Channel;
  to: string;
  success: boolean;
  simulated: boolean;
  messageId: string;
  transport: string;
  error?: string;
}

// The development outbox: the most recent simulated deliveries, newest first.
const outbox: Array<DeliveryResult & { subject: string; at: string }> = [];
export function devOutbox() {
  return outbox.slice(0, 50);
}

function record(result: DeliveryResult, subject: string) {
  outbox.unshift({ ...result, subject, at: now().toISOString() });
  if (outbox.length > 100) outbox.length = 100;
}

async function sendEmailViaSendgrid(req: DeliveryRequest): Promise<DeliveryResult> {
  const key = process.env.SENDGRID_API_KEY!;
  const from = process.env.SENDGRID_FROM_EMAIL ?? "noreply@unitedendo.demo";
  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: req.to }] }],
      from: { email: from },
      subject: req.subject,
      content: [{ type: "text/plain", value: req.body }],
    }),
  });
  const ok = res.status >= 200 && res.status < 300;
  return {
    channel: "email", to: req.to, success: ok, simulated: false, transport: "sendgrid",
    messageId: res.headers.get("x-message-id") ?? `sg-${crypto.randomUUID().slice(0, 8)}`,
    error: ok ? undefined : `SendGrid ${res.status}`,
  };
}

export async function deliver(req: DeliveryRequest): Promise<DeliveryResult> {
  // Real email when SendGrid is configured.
  if (req.channel === "email" && process.env.SENDGRID_API_KEY) {
    try {
      const result = await sendEmailViaSendgrid(req);
      record(result, req.subject);
      return result;
    } catch (e) {
      const result: DeliveryResult = { channel: "email", to: req.to, success: false, simulated: false, transport: "sendgrid", messageId: "", error: (e as Error).message };
      record(result, req.subject);
      return result;
    }
  }

  // Otherwise simulate the transport and drop it in the development outbox.
  const transport = req.channel === "email" ? "email (simulated)" : req.channel === "fax" ? "fax (simulated)" : req.channel === "portal" ? "portal" : "print queue";
  const result: DeliveryResult = {
    channel: req.channel, to: req.to, success: true, simulated: true, transport,
    messageId: `${req.channel}-${crypto.randomUUID().slice(0, 8)}`,
  };
  record(result, req.subject);
  return result;
}

export function deliveryConfigured(): { email: boolean } {
  return { email: !!process.env.SENDGRID_API_KEY };
}
