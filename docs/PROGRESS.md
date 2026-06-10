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
