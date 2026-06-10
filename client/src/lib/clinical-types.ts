// Lightweight client side shapes for the Phase 1 clinical data. Dates arrive as
// ISO strings over JSON.

export interface PatientRow {
  id: number;
  clinicId: number;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  sex: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  insuranceCarrier: string | null;
  balanceCents: number;
  status: string;
  primaryProviderId: number | null;
  referringDentistId: number | null;
  latestThumbAssetId?: number | null;
}

export interface StudyRow {
  id: number;
  patientId: number;
  visitId: number | null;
  type: string;
  capturedAt: string;
  deviceLabel: string | null;
  bodySite: string | null;
  toothNumbers: number[] | null;
  sequenceRole: string | null;
  status: string;
  originalAssetId: number | null;
  thumbAssetId: number | null;
}

export interface VisitRow {
  id: number;
  patientId: number;
  providerId: number | null;
  visitDate: string;
  type: string;
  toothNumber: number | null;
  chiefComplaint: string | null;
  status: string;
  note: SoapNoteRow | null;
}

export type FlagMap = Record<string, boolean>;

export interface SoapNoteRow {
  id: number;
  pulpalDiagnosis: string | null;
  apicalDiagnosis: string | null;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  canals: CanalDoc[] | null;
  cdtCodes: string[] | null;
  signedAt: string | null;
  // Rich clinical structures adopted from the prototype.
  etiology: FlagMap | null;
  clinicalFindings: FlagMap | null;
  radiographicFindings: FlagMap | null;
  treatmentPerformed: FlagMap | null;
  recommendations: FlagMap | null;
  prognosis: string | null;
  prognosisFactors: FlagMap | null;
  procedureDetails: Record<string, unknown> | null;
  specialDiagnoses: FlagMap | null;
}

export interface CanalDoc {
  name: string;
  workingLengthMm: string;
  reference: string;
  fileSize: string;
  obturation: string;
}

export const TYPE_GLYPH: Record<string, string> = {
  periapical: "PA",
  bitewing: "BW",
  panoramic: "Pano",
  cbct: "CBCT",
  intraoral_photo: "Photo",
  extraoral_photo: "Photo",
  document_scan: "Doc",
};

export const SEQUENCE_ROLES = ["pre_op", "working_length", "master_cone", "post_op"] as const;
export const SEQUENCE_LABELS: Record<string, string> = {
  pre_op: "Pre-op",
  working_length: "Working length",
  master_cone: "Master cone",
  post_op: "Post-op",
  recall: "Recall",
};

export function age(dob: string): number {
  const d = new Date(dob);
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) a--;
  return a;
}
