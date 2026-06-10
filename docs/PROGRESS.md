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
