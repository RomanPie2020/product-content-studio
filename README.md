# Product Content Studio

A product-card editor where an authenticated manager edits description and SEO fields
and controls publication, while visitors browse only published products.

## Prerequisites

- Node.js 22+
- PostgreSQL 18, running locally on `localhost:5432`

## Setup

1. Create the database role and the two databases (main + test — they must be
   separate; the test database is wiped and reseeded on every test run):

   ```sql
   CREATE ROLE pcs_app WITH LOGIN PASSWORD 'your-password';
   CREATE DATABASE product_studio OWNER pcs_app;
   CREATE DATABASE product_studio_test OWNER pcs_app;
   ```

2. Copy the environment template and fill in real values:

   ```bash
   cp .env.example .env
   ```

   `.env` needs `DATABASE_URL`, `TEST_DATABASE_URL` (pointing at the two databases
   above), `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, and `E2E_BASE_URL`.

3. Install dependencies and set up the schema:

   ```bash
   npm install
   npm run db:generate    # generate the Prisma client
   npm run db:migrate     # apply migrations to the main database
   npm run db:test:deploy # apply the same migrations to the test database
   npm run db:seed        # seed the main database: 1 admin + 3 demo products
   ```

4. Run the app:

   ```bash
   npm run dev
   ```

   - Public catalog: `http://localhost:3000/`
   - Admin login: `http://localhost:3000/admin/login`, using the
     `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` from your `.env`

## Testing

```bash
npm test          # Vitest — unit/integration tests against product_studio_test
npm run test:e2e  # Playwright — builds the app, starts it, and drives it in a real browser
```

Two levels of testing, because they check different things and neither
substitutes for the other: Vitest exercises the service layer, validation,
auth, and HTTP routes in isolation with mocked I/O boundaries where it makes
sense, and is fast enough to run on every change. Playwright drives the actual
built app end to end through a real browser (desktop and mobile viewports),
which is the only way to catch what unit tests structurally cannot — hydration
issues, cookie handling across real requests, and whether content is genuinely
escaped in the rendered DOM rather than just in a serializer's output. The XSS
test in `e2e/visibility.spec.ts` exists specifically because a unit test that
only checks the returned JSON would still pass even if the page injected that
JSON unsafely into HTML.

## Technical decisions

- **Next.js App Router, single application.** The spec calls for one small
  full-stack app; splitting a frontend and a separate API service would have
  added a network hop and a second deployable for no benefit at this scale.
- **REST Route Handlers over Server Actions for the editor.** The editor and
  login form are Client Components that need explicit save, error, and loading
  states independent of navigation, which maps directly onto a `fetch` to a
  Route Handler; Server Actions are Server-Component-and-form oriented, and
  the same handlers double as a stable, directly testable HTTP surface.
- **Session cookies over JWT.** Sessions can be revoked immediately (logout
  actually invalidates access — a stateless JWT wouldn't) and never carry
  claims that need re-verifying against the database anyway, so there is no
  benefit to statelessness here.
- **The session token itself is never stored — only its SHA-256 hash.** The
  raw token lives only in the httpOnly cookie. If the `Session` table were
  ever exposed (backup leak, read-only replica misconfiguration, etc.), the
  stored hashes would not be usable to forge a session, the same reasoning
  as storing a password hash instead of a password.
- **Two databases (`product_studio`, `product_studio_test`).** Automated
  tests truncate and reseed their database on every run; running them
  against the development database would destroy manually-entered dev data.
- **argon2id for password hashing.** The current OWASP-recommended default
  for password storage; resistant to GPU/ASIC cracking in a way bcrypt and
  PBKDF2 are not.
- **Drafts return 404, never 403, on every public surface** (catalog listing,
  product page, and the public API). A 403 confirms a draft product exists at
  that slug; a 404 does not distinguish "doesn't exist" from "exists but you
  can't see it," which is the correct behavior for unpublished content whose
  existence itself may be sensitive (unannounced products, pricing, etc.).
- **`prisma` pinned to the exact version `7.10.0`**, not `^7.10.0` or
  `latest`. At the time of writing, the `prisma` CLI's `latest` dist-tag
  resolves to `8.0.0-rc.15`, a release candidate, while `@prisma/client`'s
  `latest` is `7.10.0` — installing either without an explicit version
  produces a CLI/client version mismatch that fails at runtime.
- **`Product.name` and `ProductSpec` rows have no write path anywhere.** The
  spec scopes editing to description and SEO fields only; there is no route,
  service function, or Zod schema that accepts a write to either, so this is
  enforced structurally rather than by a runtime check that could be bypassed.

## Verification results (actual, run before this commit)

```
npm run lint          → 0 errors, 2 warnings (unused variables in test files)
npm run format:check  → all files match Prettier style
npx tsc --noEmit      → no errors
npm test              → 69 passed (69), 6 test files
npm run test:e2e      → 20 passed (20) — desktop + mobile projects
npm run build         → succeeds, 11 routes compiled
```

## Known limitations

- No rate limiting on the login endpoint — acceptable for a single-admin
  internal tool, not for an exposed multi-tenant deployment.
- No password reset flow; a forgotten password requires reseeding or a
  direct database update.
- No audit trail of who changed what — the schema doesn't record edit
  history, only the current state.
- No image/media management — the product card's image (if any) is not
  part of the editable content.
- Session revocation on logout deletes the one session row for that token;
  it does not offer "sign out of all devices."

## Time spent

Implemented end to end (spec → scaffold → data layer → auth → services →
API routes → UI → end-to-end tests → this document) across a single working
session, roughly 2026-09-16 16:30–21:40 (about 5 hours), tracked via commit
timestamps in `git log`.
