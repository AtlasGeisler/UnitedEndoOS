import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  real,
  date,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

// The single source of truth for the schema, shared by the server queries and
// the client types. Bottom to top: the governance core, the system of record,
// the imaging layer that is the spine of the chart, then growth, money, and AI
// governance tables. PGlite locally, hosted Postgres later, no schema change.

// ---------------------------------------------------------------------------
// Governance core
// ---------------------------------------------------------------------------

export const ROLES = [
  "practice_owner",
  "office_manager",
  "clinical_provider",
  "front_desk",
  "admin",
  "referring_doctor",
] as const;
export type Role = (typeof ROLES)[number];

export const clinics = pgTable("clinics", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  shortName: text("short_name").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull().default("MN"),
  timezone: text("timezone").notNull().default("America/Chicago"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  fullName: text("full_name").notNull(),
  role: text("role").notNull(),
  title: text("title"),
  homeClinicId: integer("home_clinic_id").references(() => clinics.id),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const userClinicAccess = pgTable("user_clinic_access", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  clinicId: integer("clinic_id").notNull().references(() => clinics.id),
});

// Extra clinician detail beyond the login account: provider color, NPI, license.
export const staffProfiles = pgTable("staff_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  displayName: text("display_name").notNull(),
  credential: text("credential"),
  npi: text("npi"),
  color: text("color").notNull().default("#3A7D44"),
  isProvider: boolean("is_provider").notNull().default(false),
});

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),
  clinicId: integer("clinic_id"),
  sourceIp: text("source_ip"),
  detail: jsonb("detail"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Referral network
// ---------------------------------------------------------------------------

export const referringDentists = pgTable("referring_dentists", {
  id: serial("id").primaryKey(),
  fullName: text("full_name").notNull(),
  practiceName: text("practice_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  fax: text("fax"),
  preferredDelivery: text("preferred_delivery").notNull().default("portal"),
  relationshipNotes: text("relationship_notes"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const referringDentistClinics = pgTable("referring_dentist_clinics", {
  id: serial("id").primaryKey(),
  referringDentistId: integer("referring_dentist_id").notNull().references(() => referringDentists.id),
  clinicId: integer("clinic_id").notNull().references(() => clinics.id),
});

export const referralStatusHistory = pgTable("referral_status_history", {
  id: serial("id").primaryKey(),
  referralId: integer("referral_id").notNull(),
  fromStatus: text("from_status"),
  toStatus: text("to_status").notNull(),
  changedBy: integer("changed_by").references(() => users.id),
  note: text("note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const reportDeliveryLog = pgTable("report_delivery_log", {
  id: serial("id").primaryKey(),
  referralReportId: integer("referral_report_id"),
  referringDentistId: integer("referring_dentist_id").references(() => referringDentists.id),
  channel: text("channel").notNull(),
  status: text("status").notNull().default("sent"),
  detail: text("detail"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const crmAlerts = pgTable("crm_alerts", {
  id: serial("id").primaryKey(),
  referringDentistId: integer("referring_dentist_id").references(() => referringDentists.id),
  kind: text("kind").notNull(),
  severity: text("severity").notNull().default("info"),
  message: text("message").notNull(),
  resolved: boolean("resolved").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const touchpoints = pgTable("touchpoints", {
  id: serial("id").primaryKey(),
  referringDentistId: integer("referring_dentist_id").references(() => referringDentists.id),
  userId: integer("user_id").references(() => users.id),
  kind: text("kind").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Patients and the clinical record
// ---------------------------------------------------------------------------

export const patients = pgTable("patients", {
  id: serial("id").primaryKey(),
  clinicId: integer("clinic_id").notNull().references(() => clinics.id),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  dateOfBirth: date("date_of_birth").notNull(),
  sex: text("sex"),
  phone: text("phone"),
  email: text("email"),
  addressLine1: text("address_line1"),
  city: text("city"),
  state: text("state"),
  postalCode: text("postal_code"),
  referringDentistId: integer("referring_dentist_id").references(() => referringDentists.id),
  primaryProviderId: integer("primary_provider_id").references(() => users.id),
  insuranceCarrier: text("insurance_carrier"),
  insuranceMemberId: text("insurance_member_id"),
  balanceCents: integer("balance_cents").notNull().default(0),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const referrals = pgTable("referrals", {
  id: serial("id").primaryKey(),
  clinicId: integer("clinic_id").notNull().references(() => clinics.id),
  patientId: integer("patient_id").references(() => patients.id),
  referringDentistId: integer("referring_dentist_id").references(() => referringDentists.id),
  toothNumbers: integer("tooth_numbers").array(),
  reason: text("reason"),
  urgency: text("urgency").notNull().default("routine"),
  status: text("status").notNull().default("received"),
  portalToken: text("portal_token"),
  submittedVia: text("submitted_via").notNull().default("staff"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const appointmentTypes = pgTable("appointment_types", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  durationMinutes: integer("duration_minutes").notNull().default(60),
  color: text("color").notNull().default("#3A7D44"),
  isEmergency: boolean("is_emergency").notNull().default(false),
});

export const appointments = pgTable("appointments", {
  id: serial("id").primaryKey(),
  clinicId: integer("clinic_id").notNull().references(() => clinics.id),
  patientId: integer("patient_id").references(() => patients.id),
  providerId: integer("provider_id").references(() => users.id),
  appointmentTypeId: integer("appointment_type_id").references(() => appointmentTypes.id),
  operatory: text("operatory"),
  startsAt: timestamp("starts_at").notNull(),
  endsAt: timestamp("ends_at").notNull(),
  status: text("status").notNull().default("scheduled"),
  // Thanksgiving Rule: an emergency slot is protected until its release time.
  isProtected: boolean("is_protected").notNull().default(false),
  releaseTime: timestamp("release_time"),
  confirmed: boolean("confirmed").notNull().default(false),
  note: text("note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const visits = pgTable("visits", {
  id: serial("id").primaryKey(),
  clinicId: integer("clinic_id").notNull().references(() => clinics.id),
  patientId: integer("patient_id").notNull().references(() => patients.id),
  providerId: integer("provider_id").references(() => users.id),
  appointmentId: integer("appointment_id").references(() => appointments.id),
  visitDate: timestamp("visit_date").notNull(),
  type: text("type").notNull().default("treatment"),
  toothNumber: integer("tooth_number"),
  chiefComplaint: text("chief_complaint"),
  status: text("status").notNull().default("open"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Per canal documentation lives as structured JSON on the SOAP note: each canal
// carries a working length, reference, file size, and obturation detail.
export const soapNotes = pgTable("soap_notes", {
  id: serial("id").primaryKey(),
  visitId: integer("visit_id").notNull().references(() => visits.id),
  patientId: integer("patient_id").notNull().references(() => patients.id),
  authorId: integer("author_id").references(() => users.id),
  subjective: text("subjective"),
  objective: text("objective"),
  assessment: text("assessment"),
  plan: text("plan"),
  pulpalDiagnosis: text("pulpal_diagnosis"),
  apicalDiagnosis: text("apical_diagnosis"),
  diagnosticTests: jsonb("diagnostic_tests"),
  canals: jsonb("canals"),
  cdtCodes: jsonb("cdt_codes"),
  aiDraft: boolean("ai_draft").notNull().default(false),
  signedAt: timestamp("signed_at"),
  signedBy: integer("signed_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const referralReports = pgTable("referral_reports", {
  id: serial("id").primaryKey(),
  visitId: integer("visit_id").references(() => visits.id),
  patientId: integer("patient_id").notNull().references(() => patients.id),
  referringDentistId: integer("referring_dentist_id").references(() => referringDentists.id),
  body: text("body"),
  status: text("status").notNull().default("draft"),
  aiDraft: boolean("ai_draft").notNull().default(false),
  approvedBy: integer("approved_by").references(() => users.id),
  deliveredAt: timestamp("delivered_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const treatmentPlans = pgTable("treatment_plans", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull().references(() => patients.id),
  createdBy: integer("created_by").references(() => users.id),
  title: text("title").notNull(),
  options: jsonb("options"),
  status: text("status").notNull().default("proposed"),
  signedAt: timestamp("signed_at"),
  signaturePath: text("signature_path"),
  pdfPath: text("pdf_path"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const activityLogs = pgTable("activity_logs", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").references(() => patients.id),
  userId: integer("user_id").references(() => users.id),
  summary: text("summary").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Imaging layer, the spine of the chart
// ---------------------------------------------------------------------------

export const IMAGE_TYPES = [
  "periapical",
  "bitewing",
  "panoramic",
  "cbct",
  "intraoral_photo",
  "extraoral_photo",
  "document_scan",
] as const;

export const imageStudies = pgTable("image_studies", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull().references(() => patients.id),
  clinicId: integer("clinic_id").notNull().references(() => clinics.id),
  visitId: integer("visit_id").references(() => visits.id),
  type: text("type").notNull(),
  capturedAt: timestamp("captured_at").notNull(),
  capturedBy: integer("captured_by").references(() => users.id),
  deviceLabel: text("device_label"),
  bodySite: text("body_site"),
  toothNumbers: integer("tooth_numbers").array(),
  // Where this image sits in a clinical RCT sequence, if any.
  sequenceRole: text("sequence_role"),
  status: text("status").notNull().default("unreviewed"),
  aiFindingsJson: jsonb("ai_findings_json"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const imageAssets = pgTable("image_assets", {
  id: serial("id").primaryKey(),
  studyId: integer("study_id").notNull().references(() => imageStudies.id),
  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull().default("image/png"),
  width: integer("width").notNull().default(0),
  height: integer("height").notNull().default(0),
  byteSize: integer("byte_size").notNull().default(0),
  checksum: text("checksum"),
  kind: text("kind").notNull().default("original"),
  storagePath: text("storage_path").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const imageAnnotations = pgTable("image_annotations", {
  id: serial("id").primaryKey(),
  assetId: integer("asset_id").notNull().references(() => imageAssets.id),
  authorId: integer("author_id").references(() => users.id),
  type: text("type").notNull(),
  geometryJson: jsonb("geometry_json").notNull(),
  label: text("label"),
  calibrationMmPerPx: real("calibration_mm_per_px"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const imageComparisons = pgTable("image_comparisons", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull().references(() => patients.id),
  name: text("name").notNull(),
  leftAssetId: integer("left_asset_id").references(() => imageAssets.id),
  rightAssetId: integer("right_asset_id").references(() => imageAssets.id),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const mountTemplates = pgTable("mount_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  kind: text("kind").notNull(),
  slots: jsonb("slots").notNull(),
});

export const mountInstances = pgTable("mount_instances", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull().references(() => patients.id),
  templateId: integer("template_id").references(() => mountTemplates.id),
  assignments: jsonb("assignments"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Money: fees, invoices, payments, claims
// ---------------------------------------------------------------------------

export const feeSchedule = pgTable("fee_schedule", {
  id: serial("id").primaryKey(),
  cdtCode: text("cdt_code").notNull(),
  description: text("description").notNull(),
  feeCents: integer("fee_cents").notNull(),
});

export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull().references(() => patients.id),
  visitId: integer("visit_id").references(() => visits.id),
  totalCents: integer("total_cents").notNull().default(0),
  status: text("status").notNull().default("open"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const invoiceItems = pgTable("invoice_items", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id").notNull().references(() => invoices.id),
  cdtCode: text("cdt_code").notNull(),
  description: text("description").notNull(),
  feeCents: integer("fee_cents").notNull(),
});

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull().references(() => patients.id),
  invoiceId: integer("invoice_id").references(() => invoices.id),
  amountCents: integer("amount_cents").notNull(),
  method: text("method").notNull().default("card"),
  reference: text("reference"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const claims = pgTable("claims", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull().references(() => patients.id),
  visitId: integer("visit_id").references(() => visits.id),
  invoiceId: integer("invoice_id").references(() => invoices.id),
  carrier: text("carrier"),
  totalCents: integer("total_cents").notNull().default(0),
  paidCents: integer("paid_cents").notNull().default(0),
  status: text("status").notNull().default("draft"),
  submittedAt: timestamp("submitted_at"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const carrierPatterns = pgTable("carrier_patterns", {
  id: serial("id").primaryKey(),
  carrier: text("carrier").notNull(),
  note: text("note"),
  patternJson: jsonb("pattern_json"),
});

export const insuranceNarratives = pgTable("insurance_narratives", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").references(() => patients.id),
  kind: text("kind").notNull(),
  body: text("body"),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Messaging
// ---------------------------------------------------------------------------

export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").references(() => patients.id),
  channel: text("channel").notNull().default("sms"),
  subject: text("subject"),
  lastMessageAt: timestamp("last_message_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => conversations.id),
  direction: text("direction").notNull(),
  authorId: integer("author_id").references(() => users.id),
  body: text("body").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Configuration, templates, and AI governance
// ---------------------------------------------------------------------------

export const configCategories = pgTable("config_categories", {
  id: serial("id").primaryKey(),
  key: text("key").notNull(),
  label: text("label").notNull(),
});

export const configOptions = pgTable("config_options", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id").notNull().references(() => configCategories.id),
  value: text("value").notNull(),
  label: text("label").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const appSettings = pgTable("app_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: jsonb("value"),
});

export const templates = pgTable("templates", {
  id: serial("id").primaryKey(),
  kind: text("kind").notNull(),
  name: text("name").notNull(),
  body: text("body").notNull(),
});

export const soapTemplates = pgTable("soap_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  pulpalDiagnosis: text("pulpal_diagnosis"),
  apicalDiagnosis: text("apical_diagnosis"),
  body: jsonb("body"),
});

export const aiPrompts = pgTable("ai_prompts", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  label: text("label").notNull(),
  template: text("template").notNull(),
});

export const aiPredictionWeights = pgTable("ai_prediction_weights", {
  id: serial("id").primaryKey(),
  finding: text("finding").notNull(),
  pulpalDiagnosis: text("pulpal_diagnosis"),
  apicalDiagnosis: text("apical_diagnosis"),
  weight: real("weight").notNull().default(1),
});

export const aiAuditLogs = pgTable("ai_audit_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  patientId: integer("patient_id").references(() => patients.id),
  feature: text("feature").notNull(),
  provider: text("provider").notNull(),
  redactedInput: jsonb("redacted_input"),
  output: jsonb("output"),
  approved: boolean("approved"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Zod insert schemas and row types
// ---------------------------------------------------------------------------

export const insertClinicSchema = createInsertSchema(clinics);
export const insertUserSchema = createInsertSchema(users);
export const insertPatientSchema = createInsertSchema(patients);
export const insertImageStudySchema = createInsertSchema(imageStudies);

export type Clinic = typeof clinics.$inferSelect;
export type User = typeof users.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type Patient = typeof patients.$inferSelect;
export type ReferringDentist = typeof referringDentists.$inferSelect;
export type Visit = typeof visits.$inferSelect;
export type SoapNote = typeof soapNotes.$inferSelect;
export type ImageStudy = typeof imageStudies.$inferSelect;
export type ImageAsset = typeof imageAssets.$inferSelect;
export type ImageAnnotation = typeof imageAnnotations.$inferSelect;
export type Appointment = typeof appointments.$inferSelect;
export type TreatmentPlan = typeof treatmentPlans.$inferSelect;
