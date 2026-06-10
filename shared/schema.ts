import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

// Phase 0 schema: the governance core that auth and RBAC stand on. The full
// clinical and imaging schema is added in Phase 1. Roles, clinic scoping, and
// the audit trail exist from the first phase so nothing touches data outside
// an authenticated, logged path.

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

// A user may reach more than one clinic. Every PHI query scopes to the set of
// clinics a user is authorized for, never the whole network by default.
export const userClinicAccess = pgTable("user_clinic_access", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  clinicId: integer("clinic_id").notNull().references(() => clinics.id),
});

// The tamper-evident-shaped audit trail. Every PHI read and write appends a
// row with the actor, action, entity, and source. PHI never enters the detail.
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

export const insertClinicSchema = createInsertSchema(clinics);
export const insertUserSchema = createInsertSchema(users);

export type Clinic = typeof clinics.$inferSelect;
export type User = typeof users.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
