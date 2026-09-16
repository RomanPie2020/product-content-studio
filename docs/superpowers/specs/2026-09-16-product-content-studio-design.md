# Product Content Studio — Design

**Date:** 2026-09-16
**Status:** Approved
**Source requirements:** `docs/task.md`

## 1. Purpose

A small product-card editor for an online store. A manager signs in, edits a
product's description and SEO fields, saves explicitly, and controls whether the
card is published. Visitors browse only published products and open their pages.

Scope is the core task only. The bonus items (LLM generation, Shopify import,
Figma-to-code, Docker/CI) are explicitly out of scope.

## 2. Stack and rationale

| Concern | Choice | Rationale |
|---|---|---|
| Framework | Next.js 15, App Router, TypeScript strict | Route Handlers provide a real REST surface; `generateMetadata` maps directly onto the SEO-field requirement |
| Database | PostgreSQL 18, running natively on the host | Real relational database; no Docker dependency for a clean local run |
| ORM | Prisma | Migrations make the clean-machine setup reproducible; typed client |
| Validation | Zod, one schema shared by client and server | The same rules run in the form and in the API handler, so direct API calls cannot bypass them and the rules are not duplicated |
| Auth | Opaque session token in an httpOnly cookie, `Session` row in the DB, argon2 password hashing | Logout revokes server-side; no credential material reaches client code |
| UI | Tailwind CSS v4, hand-built components | Five screens do not justify a component library; full control over responsive behaviour |
| Tests | Vitest (unit + integration) and Playwright (E2E) | See section 7 |
| Quality | ESLint + Prettier | Per requirements |
| Package manager | npm | Per requirements; already present on the target machine |

Registration, password recovery, roles, and product creation/deletion are out of
scope per the task.

## 3. Data model

```
User        id, email (unique), passwordHash, createdAt
Session     id (token, PK), userId -> User, expiresAt, createdAt
Product     id, slug (unique), name, description, seoTitle, seoDescription,
            status (enum: draft | published), createdAt, updatedAt
ProductSpec id, productId -> Product, label, value, position
```

`ProductSpec` is a real relation rather than a JSON column: the specs are
"фактичні характеристики", they are read-only, and modelling them relationally is
the honest choice in a task that asks for a relational database.

`name` and specs have no write path anywhere in the application — not in the
service layer, not in the API schema. Read-only is enforced by the absence of a
mutation, not by hiding a field in the UI.

## 4. Routes

**Public pages**
- `/` — catalog of published products
- `/products/[slug]` — product card

**Admin pages** (session required)
- `/admin/login`
- `/admin/products` — list with name and status
- `/admin/products/[id]` — editor

**REST API**
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/admin/products`
- `GET /api/admin/products/:id`
- `PATCH /api/admin/products/:id`
- `GET /api/products`
- `GET /api/products/:slug`

## 5. Structure

Business logic lives in `lib/` so that route handlers stay thin and the logic is
testable without going through HTTP:

```
lib/db.ts                     Prisma client singleton
lib/auth/password.ts          hash / verify
lib/auth/session.ts           create / validate / revoke / expire
lib/auth/guard.ts             requireSession() for admin routes
lib/validation/product.ts     Zod schemas shared client + server
lib/products/service.ts       listPublished, getPublishedBySlug,
                              listAll, getById, updateContent
lib/http/responses.ts         consistent JSON error shapes
```

Each unit has one purpose and a narrow interface. The service layer is the only
module that talks to Prisma; route handlers and pages call the service.

## 6. Requirement enforcement

**Drafts are not publicly reachable.** The public service functions filter
`status = 'published'` at the query level. A draft slug returns 404, not 403, so
the response does not reveal that the product exists. This holds for both the
public page and the public API, and is covered by a Vitest test and a Playwright
test.

**Product content cannot execute as script.** Description and SEO fields render
as plain text through React's default escaping. `dangerouslySetInnerHTML` does
not appear in the codebase, and an ESLint rule (`react/no-danger`) fails the
build if it is introduced.

**Validation cannot be bypassed.** Description <= 1000, SEO title <= 60, SEO
description <= 160, all three non-empty after trimming. The `PATCH` handler
parses the request body with the same Zod schema the form uses and rejects with
400 before reaching the service layer.

**Saving is explicit.** The editor is a controlled form with no autosave and no
optimistic mutation. Character counters reflect the three limits. Dirty state is
tracked so the user knows there are unsaved changes.

**A failed save does not lose work.** The form state is never reset from a
rejected response. Errors surface as field-level messages plus a banner; the
success state is reachable only from a 2xx response.

**Persistence.** All writes go to PostgreSQL through Prisma and survive restart.
Status drives public visibility.

**Secrets.** `.env` is gitignored, `.env.example` is committed with placeholders,
no secret is exposed under a `NEXT_PUBLIC_` name, and `passwordHash` never leaves
the service layer.

**Session cookie.** httpOnly, sameSite=lax, secure in production, with an
explicit expiry that the server validates on every admin request.

**Responsive.** Mobile-first Tailwind. The admin list collapses from a table to
cards on narrow screens; the editor is single-column throughout.

## 7. Testing strategy

Two levels, chosen so that each covers what the other cannot.

**Vitest** — validation rules, auth primitives, and API handlers, run against a
dedicated test database that is truncated and re-seeded per test:

- validation boundaries: 1000 / 60 / 160 exactly, one over, empty, whitespace-only
- password hash and verify, including rejection of a wrong password
- session create, validate, expire, revoke
- `PATCH` without a session -> 401
- `PATCH` with invalid data -> 400 **and the database row is unchanged**
- `PATCH` with valid data -> 200 and the change is persisted
- public `GET` of a draft -> 404

**Playwright** — four critical journeys against a real server and real database:

1. wrong credentials are rejected and no session is issued
2. login -> edit description and SEO -> save -> reload -> values persisted
3. flip a product to draft -> it disappears from the catalog and its direct URL 404s
4. a rejected save still shows the text the user typed

Two databases are used: the development database keeps the demo seed data, and
the test database is the one the suites wipe. This keeps `npm test` from
destroying the data a reviewer is clicking through.

No test depends on an external service or an API key.

## 8. Seed data

One administrator and three products — two published, one draft — with Ukrainian
names, specs, descriptions, and SEO copy. Credentials are documented in
`README.md` and come from environment variables with documented defaults.

## 9. Deliverables

- Application source, ESLint and Prettier config
- Vitest and Playwright suites
- `README.md` — setup on a clean machine, how to run the app and the tests,
  admin login, technical decisions, testing rationale, actual verification
  results, known limitations, time spent
- `AI-WORKLOG.md` — tools and models used, their contribution against the
  candidate's own, 2-3 concrete decisions about AI-produced code with the
  reasoning and how each was verified, and the role the automated tests played in
  checking AI output
- `.env.example` with no secrets
- Public GitHub repository

## 10. Known constraints

- PostgreSQL must be installed and running locally; the README documents the two
  `CREATE DATABASE` commands.
- Playwright downloads browser binaries on first install, which needs network
  access once. No network access is needed to run the tests afterwards.
