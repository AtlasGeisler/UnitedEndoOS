import crypto from "node:crypto";

// Tokenized access for the referring doctor portal. A GP reaches the portal with
// a per-dentist token, no session login. The token carries the dentist id plus a
// signature, so it is verifiable without a lookup table and cannot be guessed by
// incrementing an id. Synthetic, for the demo.

const SECRET = process.env.PORTAL_SECRET ?? "unitedendoos-portal-secret";

function sign(id: number): string {
  return crypto.createHmac("sha256", SECRET).update(`rd:${id}`).digest("hex").slice(0, 16);
}

export function makePortalToken(dentistId: number): string {
  return `gp_${dentistId}_${sign(dentistId)}`;
}

export function parsePortalToken(token: string): number | null {
  const m = /^gp_(\d+)_([a-f0-9]{16})$/.exec(token ?? "");
  if (!m) return null;
  const id = Number(m[1]);
  if (m[2] !== sign(id)) return null;
  return id;
}

// The same scheme for the read-only patient portal, keyed by patient id.
function signPt(id: number): string {
  return crypto.createHmac("sha256", SECRET).update(`pt:${id}`).digest("hex").slice(0, 16);
}
export function makePatientToken(patientId: number): string {
  return `pt_${patientId}_${signPt(patientId)}`;
}
export function parsePatientToken(token: string): number | null {
  const m = /^pt_(\d+)_([a-f0-9]{16})$/.exec(token ?? "");
  if (!m) return null;
  const id = Number(m[1]);
  if (m[2] !== signPt(id)) return null;
  return id;
}

// A simple per-clinic intake token for the public intake link.
export function makeIntakeToken(clinicId: number): string {
  return `intake_${clinicId}_${crypto.createHmac("sha256", SECRET).update(`intake:${clinicId}`).digest("hex").slice(0, 12)}`;
}
export function parseIntakeToken(token: string): number | null {
  const m = /^intake_(\d+)_([a-f0-9]{12})$/.exec(token ?? "");
  if (!m) return null;
  const id = Number(m[1]);
  if (makeIntakeToken(id) !== token) return null;
  return id;
}
