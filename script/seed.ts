import { db, client } from "../server/db";
import { hashPassword } from "../server/auth";
import {
  clinics,
  users,
  userClinicAccess,
  auditLogs,
  type Role,
} from "../shared/schema";

// Seeds the governance core: two clinics and one account per role, password
// demo1234. Synthetic only. The clinical and imaging seed is added in Phase 1.
// Idempotent: it clears the seeded tables first so reruns are clean.

const CLINICS = [
  { name: "United Endodontics, Edina", shortName: "Edina", city: "Edina", state: "MN" },
  { name: "United Endodontics, Valley View", shortName: "Valley View", city: "Eden Prairie", state: "MN" },
];

interface SeedUser {
  email: string;
  fullName: string;
  role: Role;
  title?: string;
  clinics: number[]; // indexes into the inserted clinics
}

const USERS: SeedUser[] = [
  { email: "owner@ue.demo", fullName: "Dr. Maya Chen", role: "practice_owner", title: "Endodontist, Owner", clinics: [0, 1] },
  { email: "provider@ue.demo", fullName: "Dr. Sam Okafor", role: "clinical_provider", title: "Endodontist", clinics: [0, 1] },
  { email: "manager@ue.demo", fullName: "Robin Vasquez", role: "office_manager", title: "Office Manager", clinics: [0, 1] },
  { email: "frontdesk@ue.demo", fullName: "Jamie Lindqvist", role: "front_desk", title: "Front Desk", clinics: [0] },
  { email: "admin@ue.demo", fullName: "Alex Reiner", role: "admin", title: "System Administrator", clinics: [0, 1] },
  { email: "refdoc@gp.demo", fullName: "Dr. Priya Anand", role: "referring_doctor", title: "General Dentist", clinics: [] },
];

async function seed() {
  console.log("Seeding UnitedEndoOS (Phase 0 governance core)...");

  await db.delete(auditLogs);
  await db.delete(userClinicAccess);
  await db.delete(users);
  await db.delete(clinics);

  const insertedClinics = await db.insert(clinics).values(CLINICS).returning();

  const passwordHash = hashPassword("demo1234");
  for (const u of USERS) {
    const [row] = await db
      .insert(users)
      .values({
        email: u.email,
        passwordHash,
        fullName: u.fullName,
        role: u.role,
        title: u.title ?? null,
        homeClinicId: u.clinics.length ? insertedClinics[u.clinics[0]].id : null,
      })
      .returning();
    for (const ci of u.clinics) {
      await db
        .insert(userClinicAccess)
        .values({ userId: row.id, clinicId: insertedClinics[ci].id });
    }
  }

  console.log(`  ${insertedClinics.length} clinics`);
  console.log(`  ${USERS.length} users`);
  console.log("\nSeeded logins (password demo1234):");
  for (const u of USERS) console.log(`  ${u.email.padEnd(20)} ${u.role}`);

  await client.close();
  console.log("\nDone.");
}

seed().catch((err) => {
  console.error("Seed failed", err);
  process.exit(1);
});
