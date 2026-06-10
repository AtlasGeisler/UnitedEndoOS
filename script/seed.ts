import { db, client } from "../server/db";
import { hashPassword } from "../server/auth";
import { storage } from "../server/storage";
import { renderRadiograph, type RadiographType } from "./radiographs";
import * as s from "../shared/schema";

// The Phase 1 seed. Synthetic and fictional throughout, no real person and no
// real data. It loads the governance core, reference data, the referral
// network, 60 patients, roughly 140 visits over 18 months with structured endo
// notes, and roughly 400 programmatically generated radiographs filed into
// studies and assets so the chart is a wall of images on first launch.

// A seeded PRNG so reseeding yields the same demo.
let _s = 1337;
const rnd = () => {
  _s |= 0;
  _s = (_s + 0x6d2b79f5) | 0;
  let t = Math.imul(_s ^ (_s >>> 15), 1 | _s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = <T>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)];
const rint = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000);

const FIRST = ["Ada", "Alan", "Grace", "Linus", "Margaret", "Edsger", "Barbara", "Donald", "Katherine", "Tim", "Radia", "Vint", "Hedy", "Claude", "Dorothy", "Marvin", "Ken", "Joan", "Frances", "Guido", "Maya", "Omar", "Priya", "Tobias", "Sofia", "Marcus", "Lena", "Caleb", "Nadia", "Rohan", "Elise", "Bjorn", "Imani", "Theo", "Aria", "Felix", "Noor", "Cyrus", "Greta", "Mateo"];
const LAST = ["Lovelace", "Turing", "Hopper", "Torvalds", "Hamilton", "Dijkstra", "Liskov", "Knuth", "Johnson", "Berners-Lee", "Perlman", "Cerf", "Lamarr", "Shannon", "Vaughan", "Minsky", "Thompson", "Clarke", "Allen", "Rossum", "Okafor", "Haddad", "Anand", "Berg", "Marino", "Cole", "Sorensen", "Reyes", "Khan", "Patel", "Nyberg", "Holm", "Abara", "Vance", "Costa", "Bauer", "Saab", "Darius", "Lindqvist", "Soto"];
const CITIES = [["Edina", "55435"], ["Minneapolis", "55401"], ["Eden Prairie", "55344"], ["Bloomington", "55420"], ["St. Louis Park", "55416"], ["Minnetonka", "55305"]];
const CARRIERS = ["Delta Dental", "Cigna", "MetLife", "Aetna", "United Concordia", "Guardian", "Self pay"];

const PULPAL = ["Normal pulp", "Reversible pulpitis", "Symptomatic irreversible pulpitis", "Asymptomatic irreversible pulpitis", "Pulp necrosis", "Previously treated", "Previously initiated therapy"];
const APICAL = ["Normal apical tissues", "Symptomatic apical periodontitis", "Asymptomatic apical periodontitis", "Acute apical abscess", "Chronic apical abscess", "Condensing osteitis"];
const TESTS = ["cold", "EPT", "percussion", "palpation", "bite", "probing", "mobility", "sinus_tract"];

// Endo CDT codes with fees in cents.
const PROCS = [
  { cdt: "D3330", desc: "Endodontic therapy, molar", feeCents: 132000, kind: "molar" },
  { cdt: "D3320", desc: "Endodontic therapy, premolar", feeCents: 108000, kind: "premolar" },
  { cdt: "D3310", desc: "Endodontic therapy, anterior", feeCents: 95000, kind: "anterior" },
  { cdt: "D3346", desc: "Retreatment, molar", feeCents: 152000, kind: "molar" },
  { cdt: "D3347", desc: "Retreatment, premolar", feeCents: 124000, kind: "premolar" },
];
const ADJUNCT = [
  { cdt: "D0140", desc: "Limited oral evaluation", feeCents: 11500 },
  { cdt: "D0220", desc: "Periapical radiograph, first", feeCents: 3500 },
  { cdt: "D0230", desc: "Periapical radiograph, each additional", feeCents: 2900 },
  { cdt: "D0367", desc: "CBCT capture and interpretation", feeCents: 32500 },
  { cdt: "D2954", desc: "Prefabricated post and core", feeCents: 38000 },
];

const MOLARS = [2, 3, 14, 15, 18, 19, 30, 31];
const PREMOLARS = [4, 5, 12, 13, 20, 21, 28, 29];
const ANTERIOR = [6, 7, 8, 9, 10, 11, 22, 23, 24, 25, 26, 27];

function toothKind(n: number): "molar" | "premolar" | "anterior" {
  if (MOLARS.includes(n)) return "molar";
  if (PREMOLARS.includes(n)) return "premolar";
  return "anterior";
}
function canalCount(kind: string): number {
  return kind === "molar" ? rint(3, 4) : kind === "premolar" ? rint(1, 2) : 1;
}

async function clearAll() {
  // Delete in dependency order. PGlite has no TRUNCATE CASCADE convenience here.
  const order = [
    s.imageAnnotations, s.imageComparisons, s.imageAssets, s.imageStudies,
    s.mountInstances, s.messages, s.conversations, s.payments, s.invoiceItems,
    s.invoices, s.claims, s.insuranceNarratives, s.referralReports, s.soapNotes,
    s.treatmentPlans, s.activityLogs, s.visits, s.appointments,
    s.reportDeliveryLog, s.referralStatusHistory, s.crmAlerts, s.touchpoints,
    s.referrals, s.patients, s.referringDentistClinics, s.referringDentists,
    s.aiAuditLogs, s.aiPrompts, s.aiPredictionWeights, s.soapTemplates,
    s.templates, s.configOptions, s.configCategories, s.appSettings,
    s.carrierPatterns, s.feeSchedule, s.appointmentTypes, s.mountTemplates,
    s.staffProfiles, s.auditLogs, s.userClinicAccess, s.users, s.clinics,
  ];
  for (const t of order) await db.delete(t);
}

async function seed() {
  console.log("Seeding UnitedEndoOS (Phase 1, this renders ~400 images, give it a minute)...");
  await clearAll();

  // --- clinics and staff ---
  const clinics = await db.insert(s.clinics).values([
    { name: "United Endodontics, Edina", shortName: "Edina", city: "Edina", state: "MN" },
    { name: "United Endodontics, Valley View", shortName: "Valley View", city: "Eden Prairie", state: "MN" },
  ]).returning();
  const clinicIds = clinics.map((c) => c.id);

  const passwordHash = hashPassword("demo1234");
  const userSpecs: Array<{ email: string; fullName: string; role: s.Role; title: string; clinics: number[]; provider?: boolean; color?: string }> = [
    { email: "owner@ue.demo", fullName: "Dr. Maya Chen", role: "practice_owner", title: "Endodontist, Owner", clinics: [0, 1], provider: true, color: "#1E3A28" },
    { email: "provider@ue.demo", fullName: "Dr. Sam Okafor", role: "clinical_provider", title: "Endodontist", clinics: [0, 1], provider: true, color: "#3A7D44" },
    { email: "manager@ue.demo", fullName: "Robin Vasquez", role: "office_manager", title: "Office Manager", clinics: [0, 1] },
    { email: "frontdesk@ue.demo", fullName: "Jamie Lindqvist", role: "front_desk", title: "Front Desk", clinics: [0] },
    { email: "admin@ue.demo", fullName: "Alex Reiner", role: "admin", title: "System Administrator", clinics: [0, 1] },
    { email: "refdoc@gp.demo", fullName: "Dr. Priya Anand", role: "referring_doctor", title: "General Dentist", clinics: [] },
  ];
  const users: s.User[] = [];
  for (const u of userSpecs) {
    const [row] = await db.insert(s.users).values({
      email: u.email, passwordHash, fullName: u.fullName, role: u.role, title: u.title,
      homeClinicId: u.clinics.length ? clinicIds[u.clinics[0]] : null,
    }).returning();
    users.push(row);
    for (const ci of u.clinics) await db.insert(s.userClinicAccess).values({ userId: row.id, clinicId: clinicIds[ci] });
    await db.insert(s.staffProfiles).values({
      userId: row.id, displayName: u.fullName, credential: u.provider ? "DDS, MS" : null,
      npi: u.provider ? String(rint(1000000000, 1999999999)) : null,
      color: u.color ?? "#788273", isProvider: !!u.provider,
    });
  }
  const providers = users.filter((_, i) => userSpecs[i].provider);

  // --- reference data ---
  const apptTypes = await db.insert(s.appointmentTypes).values([
    { name: "RCT, molar", durationMinutes: 90, color: "#3A7D44" },
    { name: "RCT, anterior or premolar", durationMinutes: 60, color: "#7CB68A" },
    { name: "Retreatment", durationMinutes: 90, color: "#1E3A28" },
    { name: "Consult or evaluation", durationMinutes: 30, color: "#5B6B7C" },
    { name: "Emergency", durationMinutes: 60, color: "#C0432F", isEmergency: true },
    { name: "Recall", durationMinutes: 30, color: "#C98A2B" },
  ]).returning();

  await db.insert(s.feeSchedule).values([...PROCS, ...ADJUNCT].map((p) => ({ cdtCode: p.cdt, description: p.desc, feeCents: p.feeCents })));

  await db.insert(s.mountTemplates).values([
    { name: "Endo PA series", kind: "endo_pa_3", slots: [{ role: "pre_op" }, { role: "working_length" }, { role: "post_op" }] },
    { name: "Full mouth series", kind: "fmx_18", slots: Array.from({ length: 18 }, (_, i) => ({ slot: i + 1 })) },
    { name: "Bitewing series", kind: "bwx_4", slots: Array.from({ length: 4 }, (_, i) => ({ slot: i + 1 })) },
  ]);

  const catDx = await db.insert(s.configCategories).values({ key: "pulpal_diagnosis", label: "Pulpal Diagnosis" }).returning();
  await db.insert(s.configOptions).values(PULPAL.map((v, i) => ({ categoryId: catDx[0].id, value: v, label: v, sortOrder: i })));

  await db.insert(s.aiPrompts).values([
    { key: "soap_draft", label: "SOAP note draft", template: "Draft an endodontic SOAP note from the structured findings for Patient-{id}. Assist only, the provider authors and signs." },
    { key: "referral_report", label: "Referral report", template: "Draft a referral report to the referring dentist for Patient-{id} summarizing the completed endodontic treatment." },
    { key: "image_analysis", label: "Image analysis", template: "List advisory radiographic findings for the attached synthetic image. Provider review required." },
  ]);
  await db.insert(s.aiPredictionWeights).values([
    { finding: "percussion", apicalDiagnosis: "Symptomatic apical periodontitis", weight: 1.4 },
    { finding: "cold", pulpalDiagnosis: "Reversible pulpitis", weight: 1.2 },
    { finding: "sinus_tract", apicalDiagnosis: "Chronic apical abscess", weight: 1.8 },
    { finding: "EPT", pulpalDiagnosis: "Pulp necrosis", weight: 1.5 },
  ]);
  await db.insert(s.appSettings).values([
    { key: "thanksgiving_rule", value: { releaseHour: 14, managerOverride: true } },
    { key: "ai_provider", value: { provider: "mock" } },
  ]);
  await db.insert(s.carrierPatterns).values(CARRIERS.slice(0, 5).map((c) => ({ carrier: c, note: `${c} typically requests a periapical and a narrative for D3330.`, patternJson: { needsNarrative: true } })));

  // --- referring dentists ---
  const GP_PRACTICES = ["Lakeside Family Dental", "Nokomis Dental Arts", "Cedar Smiles", "Linden Hills Dental", "Bryn Mawr Dental Group", "Calhoun Family Dentistry", "Edina Dental Care", "Wayzata Smile Studio"];
  const refDentists: s.ReferringDentist[] = [];
  for (let i = 0; i < 12; i++) {
    const fullName = `Dr. ${pick(FIRST)} ${pick(LAST)}`;
    const practice = GP_PRACTICES[i % GP_PRACTICES.length];
    const [rd] = await db.insert(s.referringDentists).values({
      fullName, practiceName: practice,
      email: `${fullName.split(" ")[1].toLowerCase()}@gp.demo`,
      phone: `952-555-${String(rint(1000, 9999))}`,
      preferredDelivery: pick(["portal", "fax", "email"]),
      relationshipNotes: pick(["Prefers same day reports.", "High volume molar referrals.", "Wants CBCT on retreats.", "New relationship, nurture."]),
      status: "active",
    }).returning();
    refDentists.push(rd);
    await db.insert(s.referringDentistClinics).values({ referringDentistId: rd.id, clinicId: pick(clinicIds) });
    if (i < 6) {
      await db.insert(s.touchpoints).values({ referringDentistId: rd.id, userId: providers[0].id, kind: pick(["call", "lunch", "thank_you_note"]), note: "Checked in on recent cases." });
    }
  }

  // --- patients, visits, notes, images ---
  let imageCount = 0;
  const patientCount = 60;
  for (let p = 0; p < patientCount; p++) {
    const clinicIdx = rnd() > 0.5 ? 0 : 1;
    const [city, zip] = pick(CITIES);
    const dobYear = rint(1948, 2012);
    const [patient] = await db.insert(s.patients).values({
      clinicId: clinicIds[clinicIdx],
      firstName: pick(FIRST), lastName: pick(LAST),
      dateOfBirth: `${dobYear}-${String(rint(1, 12)).padStart(2, "0")}-${String(rint(1, 28)).padStart(2, "0")}`,
      sex: pick(["F", "M"]),
      phone: `612-555-${String(rint(1000, 9999))}`,
      email: `patient${p}@example.com`,
      addressLine1: `${rint(100, 9999)} ${pick(["Oak", "Maple", "Cedar", "Birch", "Elm"])} ${pick(["St", "Ave", "Ln"])}`,
      city, state: "MN", postalCode: zip,
      referringDentistId: pick(refDentists).id,
      primaryProviderId: pick(providers).id,
      insuranceCarrier: pick(CARRIERS),
      insuranceMemberId: `M${rint(100000, 999999)}`,
      balanceCents: rnd() > 0.6 ? rint(0, 40000) : 0,
    }).returning();

    // A baseline panoramic or PA for almost every patient.
    if (rnd() > 0.15) {
      await makeStudy(patient, clinicIds[clinicIdx], null, rnd() > 0.6 ? "panoramic" : "periapical", null, providers[0].id, daysAgo(rint(30, 540)));
      imageCount++;
    }

    const numVisits = rint(1, 4);
    for (let v = 0; v < numVisits; v++) {
      const tooth = pick([...MOLARS, ...PREMOLARS, ...ANTERIOR]);
      const kind = toothKind(tooth);
      const proc = PROCS.find((x) => x.kind === kind) ?? PROCS[0];
      const visitDate = daysAgo(rint(5, 540));
      const completed = rnd() > 0.25;
      const provider = pick(providers);

      const [appt] = await db.insert(s.appointments).values({
        clinicId: clinicIds[clinicIdx], patientId: patient.id, providerId: provider.id,
        appointmentTypeId: pick(apptTypes).id, operatory: `Op ${rint(1, 4)}`,
        startsAt: visitDate, endsAt: new Date(visitDate.getTime() + 90 * 60000),
        status: completed ? "completed" : "scheduled", confirmed: true,
      }).returning();

      const [visit] = await db.insert(s.visits).values({
        clinicId: clinicIds[clinicIdx], patientId: patient.id, providerId: provider.id,
        appointmentId: appt.id, visitDate, type: "treatment", toothNumber: tooth,
        chiefComplaint: pick(["Pain on biting", "Lingering cold sensitivity", "Swelling", "Referred for evaluation", "Spontaneous pain"]),
        status: completed ? "signed" : "open",
      }).returning();

      const cn = canalCount(kind);
      const canals = Array.from({ length: cn }, (_, i) => ({
        name: ["MB", "ML", "DB", "DL", "B", "L", "P", "Canal"][i] ?? `C${i + 1}`,
        workingLengthMm: (18 + rnd() * 6).toFixed(1),
        reference: pick(["MB cusp", "Incisal", "Buccal cusp", "Lingual cusp"]),
        fileSize: pick(["25/.06", "30/.04", "35/.04", "40/.06"]),
        obturation: pick(["Gutta percha, warm vertical", "Single cone, bioceramic sealer", "Continuous wave"]),
      }));
      const tests = Object.fromEntries(TESTS.map((t) => [t, pick(["normal", "exaggerated", "no response", "positive", "negative", "wnl"])]));

      const [note] = await db.insert(s.soapNotes).values({
        visitId: visit.id, patientId: patient.id, authorId: provider.id,
        subjective: `${patient.firstName} presents with ${pick(["pain on biting", "thermal sensitivity", "swelling"])} on tooth ${tooth}.`,
        objective: `Tooth ${tooth} responds ${tests.cold} to cold, ${tests.percussion} to percussion.`,
        assessment: `Tooth ${tooth}, endodontic diagnosis established.`,
        plan: completed ? `Completed ${proc.desc.toLowerCase()} on tooth ${tooth}.` : `Plan ${proc.desc.toLowerCase()} on tooth ${tooth}.`,
        pulpalDiagnosis: pick(PULPAL), apicalDiagnosis: pick(APICAL),
        diagnosticTests: tests, canals, cdtCodes: [proc.cdt, "D0220"],
        signedAt: completed ? visitDate : null, signedBy: completed ? provider.id : null,
      }).returning();

      // The required radiograph sequence for a completed RCT visit.
      if (completed) {
        for (const role of ["pre_op", "working_length", "master_cone", "post_op"]) {
          await makeStudy(patient, clinicIds[clinicIdx], visit.id, "periapical", role, provider.id, visitDate, tooth);
          imageCount++;
        }
        // A few visits also carry a CBCT or a clinical photo.
        if (rnd() > 0.7) { await makeStudy(patient, clinicIds[clinicIdx], visit.id, "cbct", null, provider.id, visitDate, tooth); imageCount++; }
        if (rnd() > 0.7) { await makeStudy(patient, clinicIds[clinicIdx], visit.id, "intraoral_photo", null, provider.id, visitDate, tooth); imageCount++; }

        // Invoice, claim, and a partial payment for a completed visit.
        const lineFee = proc.feeCents;
        const [inv] = await db.insert(s.invoices).values({ patientId: patient.id, visitId: visit.id, totalCents: lineFee + 3500, status: "open" }).returning();
        await db.insert(s.invoiceItems).values([
          { invoiceId: inv.id, cdtCode: proc.cdt, description: proc.desc, feeCents: lineFee },
          { invoiceId: inv.id, cdtCode: "D0220", description: "Periapical radiograph", feeCents: 3500 },
        ]);
        const claimStatus = pick(["draft", "submitted", "accepted", "paid", "denied"]);
        await db.insert(s.claims).values({
          patientId: patient.id, visitId: visit.id, invoiceId: inv.id, carrier: patient.insuranceCarrier,
          totalCents: lineFee + 3500, paidCents: claimStatus === "paid" ? Math.floor(lineFee * 0.6) : 0,
          status: claimStatus, submittedAt: claimStatus === "draft" ? null : visitDate,
          resolvedAt: claimStatus === "paid" || claimStatus === "denied" ? new Date(visitDate.getTime() + 14 * 86400000) : null,
        });
        if (claimStatus === "paid") await db.insert(s.payments).values({ patientId: patient.id, invoiceId: inv.id, amountCents: Math.floor(lineFee * 0.6), method: "insurance", reference: "ERA auto-post" });

        // A referral report back to the GP for some completed cases.
        if (rnd() > 0.4) {
          const [rr] = await db.insert(s.referralReports).values({
            visitId: visit.id, patientId: patient.id, referringDentistId: patient.referringDentistId,
            body: `Completed ${proc.desc.toLowerCase()} on tooth ${tooth}. Recommend permanent restoration within 30 days to protect the coronal seal.`,
            status: "delivered", approvedBy: provider.id, deliveredAt: new Date(visitDate.getTime() + 86400000),
          }).returning();
          await db.insert(s.reportDeliveryLog).values({ referralReportId: rr.id, referringDentistId: patient.referringDentistId, channel: pick(["portal", "fax", "email"]), status: "sent" });
        }
      }
      await db.insert(s.activityLogs).values({ patientId: patient.id, userId: provider.id, summary: `Visit on tooth ${tooth}, ${completed ? "treatment completed" : "treatment planned"}.` });
    }

    // A simple two message conversation for some patients.
    if (rnd() > 0.6) {
      const [conv] = await db.insert(s.conversations).values({ patientId: patient.id, channel: "sms", subject: "Post-op check", lastMessageAt: daysAgo(rint(1, 60)) }).returning();
      await db.insert(s.messages).values([
        { conversationId: conv.id, direction: "outbound", authorId: providers[0].id, body: "Hi, this is United Endodontics checking in after your visit. How are you feeling?" },
        { conversationId: conv.id, direction: "inbound", body: pick(["Much better, thank you.", "A little sore but improving.", "All good, thanks for checking."]) },
      ]);
    }
  }

  // --- CRM alerts and a few open referrals ---
  await db.insert(s.crmAlerts).values([
    { referringDentistId: refDentists[3].id, kind: "volume_drop", severity: "caution", message: `${refDentists[3].fullName} referrals down 32 percent over the last 60 days.` },
    { referringDentistId: refDentists[7].id, kind: "lapsed", severity: "caution", message: `${refDentists[7].fullName} has not referred in 94 days.` },
    { referringDentistId: refDentists[1].id, kind: "milestone", severity: "info", message: `${refDentists[1].fullName} reached 50 lifetime referrals.` },
  ]);
  for (let i = 0; i < 8; i++) {
    const rd = pick(refDentists);
    await db.insert(s.referrals).values({
      clinicId: pick(clinicIds), referringDentistId: rd.id,
      toothNumbers: [pick([...MOLARS, ...ANTERIOR])],
      reason: pick(["Suspected irreversible pulpitis", "Failed prior RCT, evaluate for retreatment", "Cracked tooth evaluation", "Periapical lesion on routine film"]),
      urgency: pick(["routine", "routine", "urgent"]),
      status: pick(["received", "scheduled", "in_treatment", "report_due"]),
      submittedVia: pick(["portal", "staff", "fax"]),
    });
  }

  console.log(`\n  ${clinics.length} clinics, ${users.length} users, ${refDentists.length} referring dentists`);
  console.log(`  ${patientCount} patients, ~${imageCount} image studies rendered`);
  console.log("\nSeeded logins (password demo1234):");
  for (const u of userSpecs) console.log(`  ${u.email.padEnd(20)} ${u.role}`);
  await client.close();
  console.log("\nDone.");
}

// Renders one synthetic image, stores the original and a thumbnail, and writes
// the study plus its assets.
async function makeStudy(
  patient: s.Patient, clinicId: number, visitId: number | null,
  type: RadiographType, sequenceRole: string | null, capturedBy: number,
  capturedAt: Date, tooth?: number,
) {
  const seed = (patient.id * 7919 + (visitId ?? 0) * 131 + (tooth ?? 0) * 17 + Math.floor(rnd() * 1000)) >>> 0;
  const { original, thumbnail, width, height } = await renderRadiograph({ type, seed, toothNumber: tooth, sequenceRole });
  const [study] = await db.insert(s.imageStudies).values({
    patientId: patient.id, clinicId, visitId, type, capturedAt, capturedBy,
    deviceLabel: type === "cbct" ? "CS 8200 3D" : type === "panoramic" ? "Pano sensor" : "Size 2 PA sensor",
    bodySite: tooth ? `Tooth ${tooth}` : "Full arch",
    toothNumbers: tooth ? [tooth] : null,
    sequenceRole, status: sequenceRole === "post_op" ? "reviewed" : "unreviewed",
  }).returning();
  const base = `studies/${study.id}`;
  const orig = await storage.put(`${base}/original.png`, original);
  const thumb = await storage.put(`${base}/thumb.png`, thumbnail);
  await db.insert(s.imageAssets).values([
    { studyId: study.id, filename: "original.png", width, height, kind: "original", storagePath: orig.storagePath, byteSize: orig.byteSize, checksum: orig.checksum },
    { studyId: study.id, filename: "thumb.png", width: 360, height: Math.round((360 / width) * height), kind: "thumbnail", storagePath: thumb.storagePath, byteSize: thumb.byteSize, checksum: thumb.checksum },
  ]);
}

seed().catch((err) => {
  console.error("Seed failed", err);
  process.exit(1);
});
