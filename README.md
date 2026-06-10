# UnitedEndoOS

An image-centric electronic dental record for United Endodontics, a
multi-location endodontic specialty practice in the Twin Cities. The chart
opens to radiographs, not a form. Text records hang off images, never the
reverse. The interface aims to feel like a native macOS application running in
the browser.

Synthetic demo data only. No real patient information, ever.

## Requirements

- Node 20.11 or newer (developed on Node 22)
- No external database. The local datastore is PGlite, Postgres compiled to
  WebAssembly and persisted under `data/pgdata`.

## Quick start

```bash
npm install
npm run db:push    # create the schema in the local PGlite database
npm run seed       # load synthetic clinics, staff, and (Phase 1+) patients
npm run dev        # start the app on http://localhost:5173
```

Open http://localhost:5173 and sign in with a seeded account. Every account
uses the password `demo1234`.

| Email | Role |
| --- | --- |
| owner@ue.demo | Practice Owner |
| provider@ue.demo | Provider |
| manager@ue.demo | Office Manager |
| frontdesk@ue.demo | Front Desk |
| admin@ue.demo | Administrator |
| refdoc@gp.demo | Referring Doctor (portal) |

## Keyboard map

- Cmd+K, command palette
- Cmd+I, toggle the Inspector
- Cmd+1 through Cmd+9, switch modules
- Esc, close panels

## Layout

- `client/`, React app, the Clinic Glass UI
- `server/`, Express API, auth, audit, database access
- `shared/`, the Drizzle schema shared by both sides
- `script/`, the seed engine
- `data/`, the local database and synthetic image files (gitignored)
- `docs/`, architecture and the progress log

## Posture

Role-based access control, an audit row on every PHI read and write, PHI
redaction before any AI call, and provider approval on all AI output. The
architecture is production-credible even though this build runs locally and on
synthetic data. See `docs/PROGRESS.md` for what is built so far.

## Writing rule

No em dashes or en dashes anywhere in this codebase, its copy, or its outputs.
Commas, colons, or periods instead.
