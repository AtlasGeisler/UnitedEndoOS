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
