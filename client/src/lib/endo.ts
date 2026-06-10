// Endodontic vocabularies for the clinical cockpit, mirroring the AAE diagnosis
// pairs and the structured findings the prototype used.

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

export const CDT_OPTIONS = [
  { code: "D3310", label: "RCT anterior" },
  { code: "D3320", label: "RCT premolar" },
  { code: "D3330", label: "RCT molar" },
  { code: "D3346", label: "Retreat molar" },
  { code: "D3347", label: "Retreat premolar" },
  { code: "D0220", label: "Periapical, first" },
  { code: "D0230", label: "Periapical, additional" },
  { code: "D0367", label: "CBCT" },
  { code: "D2954", label: "Post and core" },
];

export const CANAL_PRESETS = ["MB", "MB2", "ML", "DB", "DL", "B", "L", "P"];
export const FILE_SIZES = ["20/.04", "25/.04", "25/.06", "30/.04", "35/.04", "40/.06"];
export const OBTURATIONS = ["Gutta percha, warm vertical", "Single cone, bioceramic sealer", "Continuous wave", "Carrier based"];
