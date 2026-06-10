import { db } from "./db";
import { aiPredictionWeights } from "../shared/schema";

// The diagnosis and prognosis predictor, adopted from the prototype. Weighted
// clinical findings accumulate a pulpal and an apical score that map to AAE
// diagnoses, and prognosis factors accumulate a score that maps to a rating. The
// weights default here and can be tuned in the aiPredictionWeights table. This is
// advisory, the clinician confirms.

type Flags = Record<string, boolean> | null | undefined;

const PULPAL_DEFAULTS: Record<string, number> = {
  spontaneousPain: 3, lingeringPainToCold: 3, lingeringPainToHeat: 3,
  coldTestLingering: 3, coldTestNegative: 4, eptNegative: 4, heatTestNegative: 3,
};
const APICAL_DEFAULTS: Record<string, number> = {
  sinusTract: 4, swelling: 3, painOnBiting: 2,
  percussionModerate: 3, percussionSevere: 4, palpationModerate: 2, palpationSevere: 3,
};
const PROGNOSIS_DEFAULTS: Record<string, number> = {
  poorCoronal: 2, extensiveCaries: 2, shortRoots: 1, severePeriodontal: 3,
  rootFracture: 4, complexAnatomy: 1, calcifiedCanals: 2, previousFailure: 2,
  largeLesion: 2, openApex: 2, verticalRootFracture: 5, nonRestorableTooth: 5,
};

export interface DiagnosisPrediction {
  pulpalDiagnosis: string;
  apicalDiagnosis: string;
  confidence: number;
  findings: string[];
}
export interface PrognosisPrediction {
  prognosis: string;
  confidence: number;
  factors: string[];
}

async function weightOverrides(): Promise<Map<string, number>> {
  const rows = await db.select().from(aiPredictionWeights);
  return new Map(rows.map((r) => [r.finding, r.weight]));
}

export async function predictDiagnosis(clinicalFindings: Flags): Promise<DiagnosisPrediction> {
  const f = clinicalFindings ?? {};
  const overrides = await weightOverrides();
  const w = (key: string, base: Record<string, number>) => overrides.get(key) ?? base[key] ?? 0;

  let pulpal = 0, apical = 0;
  const findings: string[] = [];
  for (const key of Object.keys(PULPAL_DEFAULTS)) if (f[key]) { pulpal += w(key, PULPAL_DEFAULTS); findings.push(label(key)); }
  for (const key of Object.keys(APICAL_DEFAULTS)) if (f[key]) { apical += w(key, APICAL_DEFAULTS); findings.push(label(key)); }

  // Pulpal mapping.
  let pulpalDiagnosis = "Normal pulp";
  if (f.coldTestNegative || f.eptNegative) pulpalDiagnosis = "Pulp necrosis";
  else if (pulpal >= 3) pulpalDiagnosis = "Symptomatic irreversible pulpitis";
  else if (pulpal >= 1) pulpalDiagnosis = "Reversible pulpitis";

  // Apical mapping.
  let apicalDiagnosis = "Normal apical tissues";
  if (f.sinusTract) apicalDiagnosis = "Chronic apical abscess";
  else if (f.swelling) apicalDiagnosis = "Acute apical abscess";
  else if (apical >= 2) apicalDiagnosis = "Symptomatic apical periodontitis";
  else if (apical >= 1) apicalDiagnosis = "Asymptomatic apical periodontitis";

  const confidence = Math.min(0.95, 0.5 + (pulpal + apical) * 0.06);
  return { pulpalDiagnosis, apicalDiagnosis, confidence, findings };
}

export async function predictPrognosis(prognosisFactors: Flags): Promise<PrognosisPrediction> {
  const f = prognosisFactors ?? {};
  const overrides = await weightOverrides();
  let score = 0;
  const factors: string[] = [];
  for (const key of Object.keys(PROGNOSIS_DEFAULTS)) {
    if (f[key]) { score += overrides.get(key) ?? PROGNOSIS_DEFAULTS[key]; factors.push(label(key)); }
  }
  const prognosis = score >= 5 ? "Unfavorable" : score >= 2 ? "Questionable" : "Favorable";
  const confidence = Math.min(0.95, 0.6 + score * 0.05);
  return { prognosis, confidence, factors };
}

function label(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .replace("Cold Test", "cold")
    .trim();
}
