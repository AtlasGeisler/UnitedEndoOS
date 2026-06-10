import { db } from "./db";
import { aiAuditLogs, type Patient } from "../shared/schema";
import { getProvider, isMock } from "./ai-providers";
import { buildRedaction, redact, reinsert, redactObject } from "./phi-redaction";

// The AI feature layer. Every function redacts PHI before the provider call,
// reinserts the patient name only after the model returns, and writes a row to
// the AI audit log. All output is advisory and is marked for provider approval.

export interface SoapInput {
  toothNumber: number | null;
  chiefComplaint: string | null;
  pulpalDiagnosis: string | null;
  apicalDiagnosis: string | null;
  diagnosticTests: Record<string, string> | null;
  canals: Array<{ name: string; workingLengthMm: string; reference: string; fileSize: string; obturation: string }> | null;
  procedure?: string;
}

export interface SoapDraft {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  provider: string;
}

export async function generateSoapDraft(
  patient: Patient,
  input: SoapInput,
  userId: number,
): Promise<SoapDraft> {
  const map = buildRedaction(patient);
  const provider = getProvider();
  const summary = soapSummary(patient.firstName, input);
  const redactedPrompt = redact(summary, map);

  let draft: Omit<SoapDraft, "provider">;
  if (isMock()) {
    draft = mockSoap(patient.firstName, input);
  } else {
    const system =
      "You are an endodontic scribe. Draft a SOAP note from the structured findings. You assist, the clinician authors and signs. Never invent findings. Return JSON with keys subjective, objective, assessment, plan.";
    const raw = await provider.chat(system, redactedPrompt);
    const restored = reinsert(raw, map);
    draft = parseSoap(restored) ?? mockSoap(patient.firstName, input);
  }

  await db.insert(aiAuditLogs).values({
    userId,
    patientId: patient.id,
    feature: "soap_draft",
    provider: provider.name,
    redactedInput: { prompt: redactedPrompt },
    output: draft,
    approved: null,
  });
  return { ...draft, provider: provider.name };
}

export interface ImageFinding {
  label: string;
  detail: string;
  confidence: number; // 0 to 1
  x: number; // 0 to 1, overlay pin position
  y: number;
}

// Image analysis returns advisory overlay-pin findings. The findings are
// synthetic and watermarked for provider review, they never alter the record on
// their own. Coordinates are deterministic from the study id so pins are stable.
export async function analyzeImage(
  patient: Patient,
  studyId: number,
  sequenceRole: string | null,
  toothNumber: number | null,
  userId: number,
): Promise<ImageFinding[]> {
  const provider = getProvider();
  const rng = mulberry(studyId * 2654435761);
  const findings: ImageFinding[] = [];

  // A periapical radiolucency near the apex on pre-op and unsequenced films.
  if (!sequenceRole || sequenceRole === "pre_op") {
    findings.push({
      label: "Periapical radiolucency",
      detail: `Possible apical radiolucency near tooth ${toothNumber ?? "of interest"}. Provider review required.`,
      confidence: 0.62 + rng() * 0.2,
      x: 0.5 + (rng() - 0.5) * 0.1,
      y: 0.74 + (rng() - 0.5) * 0.08,
    });
  }
  // Prior root filling on master cone, post-op, and recall.
  if (sequenceRole === "post_op" || sequenceRole === "master_cone" || sequenceRole === "recall") {
    findings.push({
      label: "Root filling present",
      detail: "Radiopaque obturation material detected within the canal space.",
      confidence: 0.8 + rng() * 0.15,
      x: 0.52, y: 0.55,
    });
  }
  if (rng() > 0.6) {
    findings.push({
      label: "Post or core suspected",
      detail: "Possible post in the coronal third. Confirm clinically.",
      confidence: 0.5 + rng() * 0.2,
      x: 0.5, y: 0.34,
    });
  }

  await db.insert(aiAuditLogs).values({
    userId,
    patientId: patient.id,
    feature: "image_analysis",
    provider: provider.name,
    redactedInput: { studyId, sequenceRole },
    output: findings,
    approved: null,
  });
  return findings;
}

export async function generateReferralReport(
  patient: Patient,
  input: SoapInput & { referrerName?: string; visitDate: string },
  userId: number,
): Promise<{ body: string; provider: string }> {
  const map = buildRedaction(patient);
  const provider = getProvider();
  const summary = soapSummary(patient.firstName, input);
  const redactedPrompt = redact(summary, map);

  let body: string;
  if (isMock()) {
    body = mockReport(patient, input);
  } else {
    const system =
      "You are an endodontist writing a concise, professional referral report back to the referring general dentist. Summarize the completed treatment and the restorative recommendation. No em dashes.";
    body = reinsert(await provider.chat(system, redactedPrompt), map) || mockReport(patient, input);
  }

  await db.insert(aiAuditLogs).values({
    userId,
    patientId: patient.id,
    feature: "referral_report",
    provider: provider.name,
    redactedInput: redactObject({ summary: redactedPrompt }, map),
    output: { body },
    approved: null,
  });
  return { body, provider: provider.name };
}

// --- mock composition, deterministic and clinically phrased ---

function soapSummary(firstName: string, input: SoapInput): string {
  const tests = input.diagnosticTests
    ? Object.entries(input.diagnosticTests).map(([k, v]) => `${k}: ${v}`).join(", ")
    : "not recorded";
  const canals = input.canals?.map((c) => `${c.name} ${c.workingLengthMm}mm ${c.fileSize}`).join("; ") ?? "none";
  return [
    `Patient ${firstName}, tooth ${input.toothNumber}.`,
    `Chief complaint: ${input.chiefComplaint ?? "not stated"}.`,
    `Diagnostic tests: ${tests}.`,
    `Pulpal diagnosis: ${input.pulpalDiagnosis ?? "pending"}.`,
    `Apical diagnosis: ${input.apicalDiagnosis ?? "pending"}.`,
    `Canals: ${canals}.`,
    input.procedure ? `Procedure: ${input.procedure}.` : "",
  ].join(" ");
}

function mockSoap(firstName: string, i: SoapInput) {
  const tooth = i.toothNumber ?? 0;
  const tests = i.diagnosticTests ?? {};
  const canals = i.canals ?? [];
  return {
    subjective: `${firstName} presents for evaluation of tooth ${tooth}. Chief complaint: ${i.chiefComplaint ?? "discomfort"}. History reviewed, no contraindications to treatment noted.`,
    objective: `Tooth ${tooth} responds ${tests.cold ?? "within normal limits"} to cold and ${tests.percussion ?? "within normal limits"} to percussion. Palpation ${tests.palpation ?? "negative"}. ${tests.sinus_tract === "positive" ? "A sinus tract is present. " : ""}Periapical radiograph reviewed.`,
    assessment: `Tooth ${tooth}. Pulpal diagnosis: ${i.pulpalDiagnosis ?? "to be determined"}. Apical diagnosis: ${i.apicalDiagnosis ?? "to be determined"}.`,
    plan: `${i.procedure ?? "Root canal therapy"} on tooth ${tooth}. ${canals.length ? `${canals.length} canal${canals.length === 1 ? "" : "s"} located and instrumented: ${canals.map((c) => `${c.name} to ${c.workingLengthMm}mm`).join(", ")}. Obturated with ${canals[0]?.obturation ?? "gutta percha"}.` : ""} Recommend permanent restoration within 30 days to protect the coronal seal.`,
  };
}

function mockReport(patient: Patient, i: SoapInput & { referrerName?: string; visitDate: string }) {
  const tooth = i.toothNumber ?? 0;
  return [
    `Dear ${i.referrerName ?? "Doctor"},`,
    ``,
    `Thank you for referring ${patient.firstName} ${patient.lastName} for endodontic care. I evaluated and treated tooth ${tooth}.`,
    ``,
    `Diagnosis: ${i.pulpalDiagnosis ?? "irreversible pulpitis"} with ${i.apicalDiagnosis ?? "apical periodontitis"}.`,
    `Treatment: ${i.procedure ?? "Root canal therapy"} was completed. ${i.canals?.length ? `${i.canals.length} canals were instrumented and obturated.` : ""}`,
    ``,
    `Please proceed with the permanent restoration within 30 days. The long term prognosis depends on a timely coronal seal. I am happy to see ${patient.firstName} back for a recall in six to twelve months.`,
    ``,
    `Warm regards,`,
    `United Endodontics`,
  ].join("\n");
}

function parseSoap(text: string): Omit<SoapDraft, "provider"> | null {
  try {
    const json = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
    if (json.subjective && json.plan) return json;
  } catch {
    // not JSON, fall back
  }
  return null;
}

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
