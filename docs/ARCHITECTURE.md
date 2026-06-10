# Architecture

UnitedEndoOS is a single Node process that serves both the API and the client.
In development Express runs Vite in middleware mode, so there is one port and
one command. In production the same server serves the built assets from
`dist/public`.

## Layers

1. Governance core. Identity, role-based access control, clinic scoping, and a
   tamper-evident-shaped audit trail. Everything that touches data sits on this
   layer and nothing reaches data outside an authenticated, logged path.
2. System of record. The clinical and administrative tables: patients, visits,
   SOAP notes, diagnoses, procedures, plans, billing, and the imaging tables
   that make images the spine of the record.
3. Services. Image processing, the AI provider abstraction, and the simulated
   external systems (clearinghouse, SMS, email, payments), each behind a clean
   interface with a working mock so the app never blocks on a real service.
4. Interfaces. The Mac-style human UI, the kiosk and patient portal, and the
   tokenized referring doctor portal.

## Data

Drizzle ORM over PGlite locally, the same schema over hosted Postgres later.
The schema lives in `shared/schema.ts` and is the single source of truth for
both the server queries and the client types.

## Images

Studies and assets are modeled separately. A study is a clinical capture event
with tooth tags and a visit link. An asset is one file (original, annotated, or
thumbnail). Originals are never mutated. Annotations and measurements are stored
as overlay geometry, so the source image is preserved.

## AI and PHI

PHI redaction runs before every AI call: identifiers are stripped and replaced
with `Patient-{id}` placeholders, and the real values are reinserted only after
the model returns. Every AI interaction is written to the audit trail. All AI
output is advisory and requires explicit provider approval before it enters the
record.

## Security posture

bcrypt password hashing, session cookies, RBAC with a `requireRole` gate, clinic
scoping on every query, and an audit row on every read and write. Keys and
secrets load from the environment, never from code.
