# UnitedEndoOS progress log

A dated entry per phase, describing what actually works.

## Phase 0, the shell (2026-06-09)

The macOS-style application frame is up and a user can sign in.

What works:

- Monorepo scaffold: client, server, shared, script, data, docs. Vite plus React 18 plus TypeScript on the client, Express plus tsx on the server, one process and one port through Vite middleware.
- PGlite as the local datastore, Postgres in process, so the app runs with zero external services. The same Drizzle schema targets a hosted Postgres later through a driver change.
- Clinic Glass design system: the United Endodontics palette, a green-tinted neutral ramp, light and dark modes at parity, the translucent glass material, and tabular numerals.
- macOS chrome: the slim toolbar with traffic-light dots, a clinic switcher, the translucent source-list sidebar grouped by section with a spring-animated active pill, and a toggleable Inspector panel.
- Session auth with bcrypt, six seeded role accounts, and an audit row on every login and logout. RBAC roles and clinic scoping are wired into the schema from the first phase.
- The Cmd+K command palette jumps to any module and toggles the theme. The keyboard map covers Cmd+K, Cmd+I, Cmd+1..9, and Esc.
- Every module route renders an honest empty state naming what it will do and which phase delivers it.

Checkpoint: log in as any seeded account, navigate all fourteen modules, toggle light and dark, open the palette, switch clinics. Passing.

Next: Phase 1, the full schema, the synthetic radiograph seed engine, the Patients directory, and the image-first Patient Chart.

## Phase 1, data and the imaging core (2026-06-09)

The chart opens to a wall of images. This is the heart of the product.

What works:

- The full schema: the governance core plus the system of record (patients,
  referrals, visits, SOAP notes with per canal documentation, referral reports,
  treatment plans), the imaging tables (studies, assets, annotations,
  comparisons, mount templates and instances), money (fees, invoices, payments,
  claims), messaging, and AI governance. Forty tables in all, pushed to PGlite.
- The synthetic radiograph generator: grayscale periapicals built from tooth and
  root silhouettes, a bright root-filling line on post-op shots, an optional dark
  periapical halo for AI-finding demos, exposure and grain variation by seed, and
  a SYNTHETIC watermark burned into every file. Panoramic strips, CBCT tiles, and
  intraoral photos too.
- The seed engine: two clinics, six staff, twelve referring dentists, sixty
  patients, roughly one hundred forty visits over eighteen months with structured
  endo notes, and 554 rendered images filed into studies and assets, including the
  full pre-op, working length, master cone, and post-op sequence on completed RCT
  visits.
- The server: a clinic-scoped patient directory, the chart detail and studies and
  visits endpoints, authenticated and audited image serving (a full original open
  is a PHI read in the audit trail, an unauthenticated request gets 401), and a
  drag and drop import endpoint that stores the original, derives a thumbnail, and
  files the study.
- The client: the Patients directory with instant search and latest-image
  previews, the image-first Patient Chart whose default tab is a Photos-style grid
  grouped by visit with a timeline rail and tooth, type, and status filters, the
  required RCT sequence shown as named slots with empty frames for missing roles,
  the interactive Tooth Chart with image-count badges and Universal or FDI
  numbering, the persistent scrubbable Filmstrip docked to the bottom, and the
  Quick Look lightbox with zoom, pan, rotate, flip, brightness, contrast, and
  invert.

Checkpoint passing: sign in, open a seeded patient, browse the image grid, open
Quick Look, and drag a file onto the chart to import it. Verified by API checks,
a production build, and screenshots. tsc clean.

Next: Phase 2, the Visit Workspace clinical cockpit, annotations and measurements,
compare mode, the AI SOAP draft with approval, AI image analysis, and referral
report delivery.

## Phase 2, the clinical cockpit and the AI features (2026-06-09)

A provider can take a tooth from findings to a signed note and a delivered
report, with the model assisting and a person authoring.

What works:

- The AI provider abstraction: Anthropic, OpenAI, and a deterministic offline
  MockProvider chosen by environment, so every AI feature works with no key. PHI
  redaction runs before every call, identifiers become a Patient-{id}
  placeholder, and the real name is reinserted only after the model returns.
  Every AI interaction is written to the AI audit log.
- The Visit Workspace cockpit: left holds the AAE pulpal and apical diagnosis
  pairs, the diagnostic tests, and the SOAP note. Center holds per canal
  documentation (working length, reference, file size, obturation), the CDT
  codes, and the required radiograph sequence as named slots. Right is the
  Inspector. The filmstrip docks to the bottom filtered to the visit.
- AI SOAP draft: one click composes a draft from the structured findings,
  watermarked AI draft, provider review required. The provider edits and signs.
- Sign and lock: signing locks the note, and a locked note rejects edits with a
  409, accepting only addenda. Verified end to end.
- AI image analysis: advisory findings render as numbered overlay pins on the
  radiograph and as a list with confidence, each requiring explicit accept or
  dismiss. Nothing alters the record on its own.
- Referral report: generated from the visit, then approved and delivered to the
  referring dentist over portal, fax, or email, with a delivery log row.
- Annotations and measurements: a calibrated length measurement and points draw
  as overlay geometry over the original and save through the annotations API.
  Originals are never mutated.
- Compare mode in Quick Look: two images side by side, or stacked with an opacity
  swipe slider, sharing zoom and the window-level controls.

Checkpoint passing: a full RCT visit taken from structured findings through an AI
drafted and approved note to a delivered referral report. Verified by API checks,
a production build, and screenshots showing the cockpit, the AI pins, and compare
mode. tsc clean.

Next: Phase 3, the Schedule with drag and drop, the Thanksgiving Rule engine with
an injectable clock, the Today huddle, and Worklists.

## Phase 3, the flow of the day (2026-06-09)

The day runs from a huddle, a schedule that protects emergency capacity, and
worklists that show what to finish.

What works:

- The Thanksgiving Rule engine: emergency slots are protected and held until a
  release time, by default 2 PM. A non-emergency booking into a still-protected
  slot is blocked, a manager may override with a logged reason, and an emergency
  booking is always allowed. The release job frees protected slots whose hold has
  passed. The clock is injectable so the release is demonstrable on demand.
- The Schedule day view: operatory columns, a time grid, drag and drop
  rescheduling, emergency slot shading, and a booking dialog that enforces the
  rule. A clock control and a release button make the rule visible.
- The Today huddle: production against goal, emergency slot status, unconfirmed
  patients, unsigned notes, referral SLA flags, CRM alerts, and an AI written one
  paragraph brief.
- Worklists: savable queues with counts and inline links, unsigned notes, unsent
  reports, claims to submit, and recall due.

Checkpoint passing, verified by API: front desk is blocked from a protected slot,
a manager overrides with a reason, the release holds before 2 PM, and after the
injectable clock advances to 2:05 PM the release frees the slots. Screenshots show
the huddle, the schedule with emergency holds, and the worklists. tsc clean,
production build green.

Next: Phase 4, the Referrals kanban, the Referring Doctor CRM with an alerts job,
the tokenized referring doctor portal, and treatment plans with e-signature.

## Phase 4, the growth engine (2026-06-09)

The referral loop is closed: a GP submits through the portal, the practice treats,
and the GP downloads the finished report.

What works:

- The Referrals kanban: a pipeline from received to closed with cards that drag
  between stages, plus a staff intake form that mirrors the portal.
- The Referring Doctor CRM: the list with lifetime counts, then a profile with a
  referral trend sparkline, the copyable tokenized portal link, alerts, recent
  patients referred with visit counts, touchpoints, and delivery preferences.
- The CRM alerts job recomputes milestones, lapsed referrers, low volume, and
  report SLA risk from the data, idempotently.
- The tokenized referring doctor portal, served outside the app shell with no
  login. A GP submits a referral, watches its status, and downloads the delivered
  report. The token is signed so it cannot be guessed, and an invalid token is
  rejected.
- Treatment plans: multi option plans (retreat, apico, extract and refer back)
  with per option fees and insurance estimates, a canvas e-signature, and a signed
  snapshot rendered and stored to files.

Checkpoint passing, verified by API: a referral submitted through the portal
appears in the pipeline as a portal referral, is treated to a signed note and a
delivered report, and the GP downloads that report through the portal, while an
unauthorized token is refused. Screenshots show the portal, the kanban, the CRM,
and the plan presentation. tsc clean, build green.

Next: Phase 5, billing from claim to paid, payments and payment plans, patient
texting, reminders, intake, the kiosk, and the patient portal.

## Phase 5, money and messages (2026-06-09)

A visit goes from completed to a paid claim and a collected balance, patients
text with the office, and they check themselves in at the kiosk.

What works:

- RCM lite: a simulated clearinghouse eligibility check, a claim created from a
  visit, submitted, and resolved by an auto posted ERA that pays the insurance
  share and lands the patient portion on the balance. The balance is then
  collected on a mock gateway, and a pay by text link is generated.
- The patient texting inbox on a simulated SMS transport, with threaded
  conversations, a development outbox, and a reminder scheduler that queues a
  reminder for each upcoming appointment.
- The office kiosk self check-in, a public route where a patient finds their
  appointment by last name and date of birth and is marked arrived, no login.
- The read-only patient portal, reached with a per patient token: upcoming
  visits, signed plans, balance, and secure messages.
- The tokenized online intake form that writes a pending patient for staff
  review.

Checkpoint passing, verified by API: a visit billed from a draft claim through a
posted ERA to a collected patient balance of zero, and a kiosk check-in that
marks the appointment arrived. Screenshots show billing, the texting inbox, the
kiosk, and the patient portal. tsc clean, build green.

Next: Phase 6, Analytics, Performance, Operations, Admin, insurance narratives,
the restorative follow-up tracker, the keyboard map, dark mode QA, Playwright
smoke tests, and the README demo script.

## Phase 6, intelligence and polish (2026-06-09)

The remaining modules, the narratives, the safety viewer, and the tests.

What works:

- Analytics with recharts: a six month revenue chart with a three month
  projection, case completion, top referrers, and the restorative follow-up
  tracker that flags completed RCTs without a permanent restoration after 30 days.
- Performance: provider production, case mix, chair time utilization, report
  turnaround, and emergency acceptance rate, which reflects the Thanksgiving Rule.
- Operations: staff and roles, locations, the Thanksgiving Rule settings, and the
  report delivery log.
- Admin: the config editor, the AI prompt manager, the prediction weights, and the
  AI audit log viewer where every row carries a PHI redacted badge, the visible
  proof of the safety posture.
- Insurance narratives: a seven section pre-authorization or denial appeal,
  PHI redacted before any AI call and logged.
- The keyboard map sheet at /shortcuts, reachable from the command palette.
- Dark mode QA: light and dark ship at parity, verified by screenshot.
- Playwright smoke tests for the six phase checkpoint flows, all green.

Checkpoint passing: all seven smoke tests green, the narrative generator returns
seven sections, analytics and performance render, and dark mode holds parity.
tsc clean, production build green.

## The build is complete

All six phases are built, each checkpoint passes, the smoke tests are green, and
the demo script in the README tells the story. A provider can sign in and, within
a couple of minutes, review the huddle, open a patient to a wall of synthetic
radiographs, compare two films, document a complete RCT with an AI drafted and
approved note, and send the referral report, in an interface a Mac user would
recognize as native.

## Deep merge with the EndoSOAP prototype (2026-06-09)

The original EndoSOAP prototype (the source of the 36-table schema) was provided
as a zip. UnitedEndoOS already recreated its tables and added the image-first
layer the prototype lacks, so the merge adopted the prototype's deeper clinical
detail field by field, preserving the image-first architecture.

What changed:

- The SOAP note schema gained the prototype's rich, typed JSON structures:
  etiology, graded clinical findings (cold, EPT, percussion, palpation, mobility,
  probing), radiographic findings, treatment performed, recommendations,
  prognosis and prognosis factors, the full RCT procedure detail (anesthetic,
  instrument system, irrigation, obturation technique, material, sealer, temp,
  complications), and special diagnoses (ICR, ECR, internal resorption, dens
  invaginatus, taurodontism, dilaceration).
- The Visit Workspace structured findings were rebuilt as data-driven tabs,
  Findings, Diagnosis, Procedure, and Prognosis, with toggle chips and procedure
  selects, plus a CDT suggest button driven by tooth and treatment.
- The CDT catalog was expanded to the full D3000 series with fees, and carrier
  patterns gained approval and denial rates, processing time, common denial
  reasons, and required documentation.
- The seed populates the rich structures on completed visits.

Verified: tsc clean, production build green, all seven smoke tests pass, the AI
features still run on Claude, and screenshots show the Findings and Procedure
tabs with the full vocabulary.

## Mined AI prompt templates from the prototype (2026-06-09)

The prototype's AI prompt templates were mined into a single server/prompts.ts
module and wired into the live AI features.

What changed:

- The SOAP draft uses the expert-endodontist prompt with standard dental
  abbreviations (RCT, SIP, SAP, EPT, GP, NaOCl, F/U) and a concise S, O, A, P
  format, while still returning structured JSON for the cockpit.
- The referral report uses the warm, collegial, 100 to 150 word thank-you-note
  prompt.
- The insurance narrative generator now calls the model with the seven section
  pre-authorization and denial appeal prompts, weaving in carrier intelligence
  (known denial reasons and required documentation) and redacting PHI first. On
  Claude it produced a 2,600 character, seven section pre-auth narrative in
  proper AAE terminology, audited with a Patient-{id} placeholder.
- All mined templates, including the AI training assistant protocol prompt, are
  seeded into the prompt manager so they are visible and editable in Admin, and
  the standard SOAP and referral document templates are seeded too.
- Fixed the seed delete order so a reseed over existing data clears invoice
  children before invoices.

Verified: tsc clean, build green, all seven smoke tests pass, the live narrative
runs on Claude with carrier intelligence and PHI redaction, and the Admin prompt
manager lists the six mined prompts.

## Mined the schedule-import-from-image feature (2026-06-09)

The prototype's AI schedule import was mined: a staff member uploads a photo or
screenshot of a paper or external schedule, the model reads it, and the
appointments are reviewed and created.

What works:

- The Anthropic provider gained a vision method, sending an image plus text and
  reading back the structured response. The mined extraction prompt asks for each
  appointment's patient, time, date, duration, tooth, type, and referring doctor
  as JSON.
- A new ai.ts function reads a schedule image. On Claude it uses the vision call,
  offline it returns a realistic sample so the flow is demonstrable. The image is
  not stored, only an extraction count is audited.
- Two routes, gated to front desk, manager, owner, and admin: import-image
  extracts the appointments for review, and confirm-import finds or creates each
  patient (pending review), matches the referring dentist by name, and books the
  appointment at the parsed time and type.
- The Schedule page gained an Import from image button and a dialog: upload,
  extract, review the table with per row include toggles, then create.

Verified end to end on Claude: a synthetic schedule image yielded four
appointments with correct times, teeth, types, and referrers, and confirming
created the patients and appointments on the day. tsc clean, build green, all
seven smoke tests pass.

## Mined three more prototype features (2026-06-09)

Diagnosis and prognosis prediction, the interactive tutorial, and the report
delivery service were mined from the prototype.

Diagnosis and prognosis predictor:
- A server scoring module weights the structured clinical findings into a pulpal
  and apical score that map to AAE diagnoses, and prognosis factors into a score
  that maps to favorable, questionable, or unfavorable. Weights default in code
  and are tunable in the aiPredictionWeights table, editable in Admin.
- The cockpit Diagnosis tab gained a predictor panel: predict from the findings,
  see the suggested pulpal, apical, and prognosis with confidence and the
  drivers, and apply with one click. Advisory, the clinician confirms.

Interactive tutorial:
- An eight step guided tour, reachable from the command palette, that walks a new
  user through the day, the schedule, the image-first chart, the cockpit, the AI
  features, the growth engine, analytics, and admin, each step linking to its
  module.

Report delivery service:
- A pluggable transport: email goes through SendGrid when a key is set, otherwise
  every channel (email, fax, portal, print) is simulated into a development
  outbox. The report deliver flow routes through it and records the transport and
  message id in the delivery log.

Verified: tsc clean, build green, all seven smoke tests pass. The predictor
returned Pulp necrosis and Chronic apical abscess with an unfavorable prognosis,
a weight edit saved, and a simulated fax delivery landed in the outbox.

## Interconnection: the chart as the hub (2026-06-12)

Feedback driven changes to center the app on the patient chart and imaging and to
make the schedule a real entry point.

- Click a booked appointment on the Schedule to open that patient's chart. Click
  an empty slot to add an appointment: search the patient, pick the type, and it
  is created at that time and operatory.
- The Patient Chart gained quick actions, Start visit (straight into the cockpit),
  Schedule appointment, and image import, and the Overview is now a dashboard:
  images, visits, completed, and balance stats, upcoming appointments, a recent
  imaging strip, and recent visits that open the cockpit on click.
- A new patient appointments endpoint feeds the dashboard.

tsc clean, build green, all seven smoke tests pass.
