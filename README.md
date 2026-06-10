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

## Guided demo, about five minutes

Sign in as `provider@ue.demo`.

1. Morning huddle. The Today page opens to the huddle: production against goal,
   emergency slot status, unsigned notes, and an AI written brief.
2. A wall of images. Open Patients, click a patient. The chart opens to the
   imaging grid, not a form. Press Space on any radiograph for Quick Look, then
   press Compare to view two films side by side or with an opacity swipe.
3. A full visit. Open Clinical, open a visit. Fill the diagnosis and canals, click
   AI draft note, edit, then Sign and lock. Click Generate referral report, then
   Send. In the Inspector, click Analyze for AI overlay-pin findings.
4. The Thanksgiving Rule. Open Schedule. The dashed slots are protected emergency
   holds. As `frontdesk@ue.demo`, clicking one and booking a routine patient is
   blocked. As `manager@ue.demo`, override with a reason. Click Pin to 2 PM, then
   Release slots, and the held slots free.
5. The referral loop. Open Referring Doctors, copy a portal link, open it in a new
   tab, and submit a referral. It appears in the Referrals kanban. Treat it, and
   the GP can download the report from the portal.
6. Money. Open Billing. Submit a claim, Post ERA, and Collect the patient balance.
7. Check in. Open `/kiosk`, enter a patient last name, and check in.
8. Insight. Open Analytics for the revenue projection and the restorative
   follow-up tracker, and Admin for the AI audit log where every row is PHI
   redacted.

## Keyboard map

- Cmd+K, command palette
- Cmd+I, toggle the Inspector
- Cmd+1 through Cmd+9, switch modules
- Esc, close panels

See the full map at `/shortcuts`.

## Tests

```bash
npm run check    # tsc, no emit
npm test         # Playwright smoke tests for the six checkpoint flows
```

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
