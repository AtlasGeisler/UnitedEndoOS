// Endodontic vocabularies for the clinical cockpit, adopted from the EndoSOAP
// prototype: AAE diagnosis pairs, etiology, graded clinical findings, radiographic
// findings, treatment performed, recommendations, prognosis factors, the RCT
// procedure detail, special diagnoses, and the CDT D3000-series knowledge. Groups
// are data so the cockpit renders them generically.

export interface Flag {
  key: string;
  label: string;
}
export interface FlagGroup {
  key: string;
  label: string;
  flags: Flag[];
}

export const PULPAL_DX = [
  "Normal pulp",
  "Reversible pulpitis",
  "Symptomatic irreversible pulpitis",
  "Asymptomatic irreversible pulpitis",
  "Pulp necrosis",
  "Previously treated",
  "Previously initiated therapy",
];

export const APICAL_DX = [
  "Normal apical tissues",
  "Symptomatic apical periodontitis",
  "Asymptomatic apical periodontitis",
  "Acute apical abscess",
  "Chronic apical abscess",
  "Condensing osteitis",
];

// Etiology, the cause of the condition.
export const ETIOLOGY: Flag[] = [
  { key: "caries", label: "Caries" },
  { key: "defectiveRestoration", label: "Defective restoration" },
  { key: "mechanicalExposure", label: "Mechanical exposure" },
  { key: "directPulpCap", label: "Direct pulp cap" },
  { key: "indirectPulpCap", label: "Indirect pulp cap" },
  { key: "previousRCT", label: "Previous RCT" },
  { key: "trauma", label: "Trauma" },
  { key: "crackFracture", label: "Crack or fracture" },
  { key: "resorption", label: "Resorption" },
  { key: "periodontal", label: "Periodontal" },
  { key: "idiopathic", label: "Idiopathic" },
];

// Clinical findings, grouped, with graded pulp testing.
export const FINDING_GROUPS: FlagGroup[] = [
  {
    key: "symptoms",
    label: "Symptoms",
    flags: [
      { key: "spontaneousPain", label: "Spontaneous pain" },
      { key: "lingeringPainToCold", label: "Lingering pain to cold" },
      { key: "lingeringPainToHeat", label: "Lingering pain to heat" },
      { key: "painOnBiting", label: "Pain on biting" },
      { key: "swelling", label: "Swelling" },
      { key: "sinusTract", label: "Sinus tract" },
    ],
  },
  {
    key: "cold",
    label: "Cold test",
    flags: [
      { key: "coldTestPositive", label: "Normal" },
      { key: "coldTestNegative", label: "No response" },
      { key: "coldTestLingering", label: "Prolonged" },
    ],
  },
  {
    key: "ept",
    label: "EPT and heat",
    flags: [
      { key: "eptPositive", label: "EPT responsive" },
      { key: "eptNegative", label: "EPT no response" },
      { key: "heatTestPositive", label: "Heat positive" },
      { key: "heatTestNegative", label: "Heat negative" },
    ],
  },
  {
    key: "percussion",
    label: "Percussion",
    flags: [
      { key: "percussionNone", label: "None" },
      { key: "percussionMild", label: "Mild" },
      { key: "percussionModerate", label: "Moderate" },
      { key: "percussionSevere", label: "Severe" },
    ],
  },
  {
    key: "palpation",
    label: "Palpation",
    flags: [
      { key: "palpationNone", label: "None" },
      { key: "palpationMild", label: "Mild" },
      { key: "palpationModerate", label: "Moderate" },
      { key: "palpationSevere", label: "Severe" },
    ],
  },
  {
    key: "mobility",
    label: "Mobility and probing",
    flags: [
      { key: "mobilityNormal", label: "Mobility normal" },
      { key: "mobilityClass1", label: "Class I" },
      { key: "mobilityClass2", label: "Class II" },
      { key: "mobilityClass3", label: "Class III" },
      { key: "probingNormal", label: "Probing normal" },
      { key: "probingDeep", label: "Probing deep" },
      { key: "probingNarrowDefect", label: "Narrow defect" },
    ],
  },
];

export const RADIOGRAPHIC: Flag[] = [
  { key: "normal", label: "Normal" },
  { key: "apicalRadiolucency", label: "Apical radiolucency" },
  { key: "lateralRadiolucency", label: "Lateral radiolucency" },
  { key: "furcalRadiolucency", label: "Furcal radiolucency" },
  { key: "widenedPDL", label: "Widened PDL" },
  { key: "lossOfLaminaDura", label: "Loss of lamina dura" },
  { key: "calcification", label: "Calcification" },
  { key: "caries", label: "Caries" },
  { key: "previousRCT", label: "Previous RCT" },
  { key: "missedCanals", label: "Missed canals" },
  { key: "shortFill", label: "Short fill" },
  { key: "perforation", label: "Perforation" },
  { key: "rootFracture", label: "Root fracture" },
  { key: "externalResorption", label: "External resorption" },
  { key: "internalResorption", label: "Internal resorption" },
  { key: "immatureApex", label: "Immature apex" },
];

export const TREATMENT_PERFORMED: Flag[] = [
  { key: "rootCanalTherapy", label: "Root canal therapy" },
  { key: "retreatment", label: "Retreatment" },
  { key: "pulpotomy", label: "Pulpotomy" },
  { key: "pulpectomy", label: "Pulpectomy" },
  { key: "apicalSurgery", label: "Apical surgery" },
  { key: "incisionAndDrainage", label: "Incision and drainage" },
  { key: "calciumHydroxidePlaced", label: "CaOH placed" },
  { key: "temporaryRestoration", label: "Temporary restoration" },
  { key: "permanentRestoration", label: "Permanent restoration" },
  { key: "emergency", label: "Emergency" },
];

export const RECOMMENDATIONS: Flag[] = [
  { key: "crownRecommended", label: "Crown recommended" },
  { key: "buildupNeeded", label: "Buildup needed" },
  { key: "postNeeded", label: "Post needed" },
  { key: "extractionRecommended", label: "Extraction recommended" },
  { key: "monitorOnly", label: "Monitor only" },
  { key: "referToGP", label: "Refer to GP" },
  { key: "followUp6Months", label: "Follow up 6 months" },
  { key: "followUp12Months", label: "Follow up 12 months" },
  { key: "softDiet", label: "Soft diet" },
  { key: "takeAnalgesics", label: "Analgesics" },
  { key: "takeAntibiotics", label: "Antibiotics" },
  { key: "warmSaltRinses", label: "Warm salt rinses" },
];

export const PROGNOSIS_OPTIONS = ["Favorable", "Questionable", "Unfavorable"];
export const PROGNOSIS_FACTORS: Flag[] = [
  { key: "poorCoronal", label: "Poor coronal seal" },
  { key: "extensiveCaries", label: "Extensive caries" },
  { key: "shortRoots", label: "Short roots" },
  { key: "severePeriodontal", label: "Severe periodontal" },
  { key: "rootFracture", label: "Root fracture" },
  { key: "complexAnatomy", label: "Complex anatomy" },
  { key: "calcifiedCanals", label: "Calcified canals" },
  { key: "previousFailure", label: "Previous failure" },
  { key: "largeLesion", label: "Large lesion" },
  { key: "openApex", label: "Open apex" },
  { key: "verticalRootFracture", label: "Vertical root fracture" },
  { key: "nonRestorableTooth", label: "Non-restorable" },
];

export const SPECIAL_DIAGNOSES: Flag[] = [
  { key: "icrPresent", label: "Invasive cervical resorption" },
  { key: "ecrPresent", label: "External cervical resorption" },
  { key: "internalResorptionPresent", label: "Internal root resorption" },
  { key: "densInvaginatusPresent", label: "Dens invaginatus" },
  { key: "taurodontismPresent", label: "Taurodontism" },
  { key: "dilacerationPresent", label: "Dilaceration" },
];

// Procedure detail option lists.
export const INSTRUMENT_SYSTEMS = ["ProTaper Gold", "WaveOne Gold", "TruNatomy", "Vortex Blue", "Hand K-files", "Hybrid"];
export const INSTRUMENTATION_TYPES = ["Rotary", "Reciprocating", "Hand", "Hybrid"];
export const NAOCL_CONCENTRATIONS = ["2.5%", "5.25%", "6%"];
export const OBTURATION_TECHNIQUES = ["Warm vertical condensation", "Lateral condensation", "Single cone", "Carrier based", "Continuous wave"];
export const OBTURATION_MATERIALS = ["Gutta percha", "Bioceramic coated GP", "MTA and GP"];
export const SEALER_TYPES = ["AH Plus", "BC Sealer", "Pulp Canal Sealer", "Sealapex"];
export const ANESTHETIC_AGENTS = ["2% lidocaine 1:100k epi", "4% articaine 1:100k epi", "0.5% bupivacaine 1:200k epi", "3% mepivacaine plain"];
export const TEMP_MATERIALS = ["Cavit", "IRM", "Composite", "Glass ionomer"];
export const PERFORATION_LOCATIONS = ["Furcal", "Mid-root", "Apical", "Strip"];

// CDT D3000-series catalog with descriptions and typical fees in cents.
export interface CdtCode {
  code: string;
  label: string;
  feeCents: number;
}
export const CDT_CATALOG: CdtCode[] = [
  { code: "D0140", label: "Limited oral evaluation", feeCents: 11500 },
  { code: "D0220", label: "Periapical, first film", feeCents: 3500 },
  { code: "D0230", label: "Periapical, each additional", feeCents: 2900 },
  { code: "D0364", label: "CBCT, limited field", feeCents: 32500 },
  { code: "D3310", label: "Endodontic therapy, anterior", feeCents: 95000 },
  { code: "D3320", label: "Endodontic therapy, premolar", feeCents: 108000 },
  { code: "D3330", label: "Endodontic therapy, molar", feeCents: 132000 },
  { code: "D3346", label: "Retreatment, anterior", feeCents: 118000 },
  { code: "D3347", label: "Retreatment, premolar", feeCents: 124000 },
  { code: "D3348", label: "Retreatment, molar", feeCents: 152000 },
  { code: "D3221", label: "Pulpal debridement", feeCents: 38000 },
  { code: "D3410", label: "Apicoectomy, anterior", feeCents: 110000 },
  { code: "D3421", label: "Apicoectomy, premolar", feeCents: 120000 },
  { code: "D3425", label: "Apicoectomy, molar", feeCents: 135000 },
  { code: "D2950", label: "Core buildup", feeCents: 32000 },
  { code: "D2954", label: "Prefabricated post and core", feeCents: 38000 },
];

// Suggests CDT codes from the tooth number and the treatment performed.
export function suggestCdt(toothNumber: number | null, treatment: { retreatment?: boolean; apicalSurgery?: boolean } | null): string[] {
  const molars = [1, 2, 3, 14, 15, 16, 17, 18, 19, 30, 31, 32];
  const premolars = [4, 5, 12, 13, 20, 21, 28, 29];
  const kind = toothNumber == null ? "anterior" : molars.includes(toothNumber) ? "molar" : premolars.includes(toothNumber) ? "premolar" : "anterior";
  const out = ["D0140", "D0220"];
  if (treatment?.apicalSurgery) {
    out.push(kind === "molar" ? "D3425" : kind === "premolar" ? "D3421" : "D3410");
  } else if (treatment?.retreatment) {
    out.push(kind === "molar" ? "D3348" : kind === "premolar" ? "D3347" : "D3346");
  } else {
    out.push(kind === "molar" ? "D3330" : kind === "premolar" ? "D3320" : "D3310");
  }
  out.push("D2954");
  return out;
}

export const DIAGNOSTIC_TESTS: { key: string; label: string; options: string[] }[] = [
  { key: "cold", label: "Cold", options: ["wnl", "exaggerated", "lingering", "no response"] },
  { key: "EPT", label: "EPT", options: ["responsive", "no response"] },
  { key: "percussion", label: "Percussion", options: ["negative", "sensitive", "exaggerated"] },
  { key: "palpation", label: "Palpation", options: ["negative", "tender"] },
  { key: "bite", label: "Bite", options: ["negative", "positive"] },
  { key: "probing", label: "Probing", options: ["wnl", "isolated defect"] },
  { key: "mobility", label: "Mobility", options: ["0", "1", "2", "3"] },
  { key: "sinus_tract", label: "Sinus tract", options: ["absent", "present"] },
];

export const CDT_OPTIONS = CDT_CATALOG.map((c) => ({ code: c.code, label: c.label }));
export const CANAL_PRESETS = ["MB", "MB2", "ML", "DB", "DL", "B", "L", "P"];
export const FILE_SIZES = ["20/.04", "25/.04", "25/.06", "30/.04", "35/.04", "40/.06"];
export const OBTURATIONS = OBTURATION_TECHNIQUES;
