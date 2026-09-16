# AI Development Worklog

## Tools and models used

The entire application — design spec, implementation plan, and all
seventeen tasks of implementation — was built with **Claude Code** running
**Claude Sonnet 5** (`claude-sonnet-5`), using the `superpowers` skill set
for structured plan-driven execution (brainstorm → spec → plan →
task-by-task implementation with a verification step per task).

Concrete contribution split: the AI wrote effectively all source code,
configuration, tests, and commit messages, working from a design spec and
implementation plan that were themselves produced collaboratively (the AI
drafted them, I reviewed and approved the scope, constraints, and
architecture before any code was written). My own contribution was
direction and review, not authorship: setting the two hard requirements
(role-gated editing, published-only visibility), approving or rejecting
each proposed architectural decision, running and reading the actual test
output after every task rather than trusting a claimed "done," and making
the calls documented below where the AI's default proposal needed a
correction.

## Specific decisions about AI-generated code

**1. Hashing the session token before storing it, rather than storing the
raw token — commit [`fed219a`](https://github.com/RomanPie2020/product-content-studio/commit/fed219a).**
Claude's first-pass proposal stored the session token directly as the
`Session` table's primary key, which is what most quick session-cookie
tutorials do. I asked for the token to be hashed (SHA-256) before storage,
matching how the password itself is never stored in plaintext: if the
`Session` table were ever exposed — a backup leak, a misconfigured
read-only replica, a logging mistake — the stored values shouldn't be
directly usable to forge a session. Claude implemented `hashToken()` in
`src/lib/auth/session.ts`, hashing on both create and lookup, and the
cookie still carries the raw token (the only place it needs to exist in
plaintext). Verified by reading the resulting `session.ts` end to end and
by the auth test suite (`tests/auth.test.ts`), which asserts a session
created with one token cannot be validated with a different one and that
the stored id is not the raw token.

**2. Returning 404 instead of 403 for unpublished products on every public
surface — commit [`430be97`](https://github.com/RomanPie2020/product-content-studio/commit/430be97).**
This was specified up front (I set it as a constraint before Claude wrote
the service layer), rather than left to the AI's default — a first draft
of a "get by slug" endpoint from an AI is more likely to reach for 403 or
`null` semantics, since 404-for-privacy is the less obvious choice. Claude
implemented it consistently: the service layer's `getPublishedBySlug`
returns `null` for both "doesn't exist" and "exists but is a draft," which
the API route and the page's `notFound()` call then turn into 404 with no
distinction between the two cases anywhere in the response. Verified by
`tests/products.service.test.ts` (draft slug returns `null`, same as a
nonexistent slug) and end to end by
`e2e/visibility.spec.ts`, which checks the actual HTTP status code for a
draft product's page and API route, not just that it's "not shown."

**3. Preserving typed form state after a rejected save — commit
[`1d3f0d8`](https://github.com/RomanPie2020/product-content-studio/commit/1d3f0d8).**
The editor form's default AI-generated behavior on a failed save (e.g. a
description over the character limit) reset the field to the last-saved
value along with showing the error, which loses whatever the manager just
typed. I flagged this as a real usability problem — a user shouldn't have
to retype a long description just because it was one character too long —
and asked for the input to keep exactly what was typed while showing the
validation error inline. Claude fixed this by keeping the failed
`fetch`'s response error separate from the form's local `value` state,
only ever updating `value` from a successful save or the initial load.
Verified with a dedicated Playwright test
(`e2e/editor.spec.ts` → "a rejected save keeps the typed text and shows no
success") that submits an over-limit description and asserts the textarea
still holds the invalid text after the error is shown.

**4. Pinning `prisma`/`@prisma/client`/`@prisma/adapter-pg` to the exact
version `7.10.0` rather than `^7.10.0` or unpinned — set in the
implementation plan before commit [`4e2299a`](https://github.com/RomanPie2020/product-content-studio/commit/4e2299a).**
Claude flagged during planning that the `prisma` CLI's `latest` dist-tag
was, at the time, a `8.0.0-rc.15` release candidate while
`@prisma/client`'s `latest` was `7.10.0` — an unpinned or caret-ranged
install would silently produce a CLI/client version mismatch that only
surfaces at runtime (generator/client protocol drift), not at install
time. I accepted this as a stated global constraint rather than
second-guessing it, and verified it directly: `npm ls prisma
@prisma/client @prisma/adapter-pg` after install confirms all three sit at
exactly `7.10.0`, and `npx prisma generate` / `npm run db:migrate`
succeeded without the client-generator mismatch error that an unpinned
install would have produced.

## Role of automated tests in checking AI output

Automated tests were the primary way AI-written code was actually
verified, not just reviewed by reading — for a project this size, reading
alone would not have reliably caught behavioral bugs like the two the
Vitest and Playwright suites surfaced during Task 16 (see below). Every
task's plan step ended with running a real command and reading its actual
output before moving on; nothing was marked done on a claimed result.

**Judging the quality of the AI-written tests themselves** mattered as
much as judging the application code, since a test suite that only
confirms what the implementation already does is worthless as a check.
Two things gave confidence the tests were real checks rather than
theater:

- The Vitest suite exercises negative paths as first-class cases, not
  just happy paths — e.g. `tests/auth.test.ts` asserts a wrong password
  and an expired session are both rejected, and
  `tests/products.service.test.ts` asserts a draft product is
  unreachable through the *public* read path while still reachable
  through the *admin* one, which is the actual requirement, not an
  implementation detail.
- The Playwright XSS test in `e2e/visibility.spec.ts` earns its place by
  actually attempting the injection through the real editor UI and then
  checking the rendered public page for both "text is visible" and "no
  script executed" — a test that only checked for an escaped-string
  marker in a JSON response, which is what a weaker AI-generated test
  would default to, would still pass even if the page were rendering
  raw HTML unsafely.

The tests also caught two real bugs in AI-generated code directly, during
implementation of Task 16 (both fixed in commit
[`c0a69d5`](https://github.com/RomanPie2020/product-content-studio/commit/c0a69d5)): the end-to-end specs used
`getByLabel("Опис")` without `exact: true`, which silently matched both
the "Опис" and "SEO-опис" fields (Playwright's label matching is
substring-based by default) and would have filled the wrong field; and
the visibility suite mutates publication state but both browser projects
(desktop, mobile) ran against a single one-time database seed, so the
second project's unpublish test started from state the first project had
already mutated. Both were caught by the tests actually failing on first
run, not by inspection — which is the point of running them rather than
trusting generated code that "looks right."
