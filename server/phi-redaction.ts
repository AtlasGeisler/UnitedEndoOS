import type { Patient } from "../shared/schema";

// PHI redaction runs before every AI call, without exception. Patient
// identifiers are stripped and replaced with a stable Patient-{id} placeholder,
// and the real values are reinserted only after the model returns. The model
// never sees a name, date of birth, contact detail, address, or member id.

export interface RedactionMap {
  placeholder: string; // for example "Patient-12"
  replacements: Array<{ token: string; value: string }>;
}

// Generic patterns for anything that slips through the structured fields.
const PATTERNS: Array<[RegExp, string]> = [
  [/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN]"],
  [/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "[PHONE]"],
  [/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, "[EMAIL]"],
  [/\b\d{1,5}\s+\w+(\s\w+)*\s(St|Ave|Rd|Ln|Dr|Blvd|Ct|Way)\b/gi, "[ADDRESS]"],
  [/\b\d{4}-\d{2}-\d{2}\b/g, "[DATE]"],
  [/\bM\d{6}\b/g, "[MEMBER_ID]"],
];

export function buildRedaction(patient: Patient): RedactionMap {
  const placeholder = `Patient-${patient.id}`;
  const replacements: Array<{ token: string; value: string }> = [];
  const add = (value: string | null | undefined) => {
    if (value && value.trim()) replacements.push({ token: placeholder, value: value.trim() });
  };
  add(`${patient.firstName} ${patient.lastName}`);
  add(patient.firstName);
  add(patient.lastName);
  return { placeholder, replacements };
}

// Replaces the patient's identifiers with the placeholder, then masks any
// remaining identifier-shaped strings.
export function redact(text: string, map: RedactionMap): string {
  let out = text;
  for (const { token, value } of map.replacements) {
    out = out.split(value).join(token);
  }
  for (const [re, label] of PATTERNS) out = out.replace(re, label);
  return out;
}

// Reinserts the real patient name after the model returns. The placeholder maps
// back to the full legal name.
export function reinsert(text: string, map: RedactionMap): string {
  const full = map.replacements[0]?.value ?? map.placeholder;
  return text.split(map.placeholder).join(full);
}

// Redacts a structured object's string values for logging the AI input.
export function redactObject(obj: Record<string, unknown>, map: RedactionMap): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = typeof v === "string" ? redact(v, map) : v;
  }
  return out;
}
