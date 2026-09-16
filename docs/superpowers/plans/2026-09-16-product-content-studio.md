# Product Content Studio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a product-card editor where an authenticated manager edits description and SEO fields and controls publication, while visitors browse only published products.

**Architecture:** A single Next.js App Router application. All business logic lives in `src/lib/` modules that are the only code touching Prisma; REST Route Handlers under `src/app/api/` are thin wrappers that authenticate, validate with Zod, and delegate. Pages are Server Components that call the service layer directly, except the editor and login form, which are Client Components talking to the REST API.

**Tech Stack:** Next.js 16.3.5, React 19.3.0, TypeScript (strict), PostgreSQL 18, Prisma 7.10.0 with the `@prisma/adapter-pg` driver adapter, Zod 4.6.5, Tailwind CSS 4.3.3, Vitest 5.0.1, Playwright 1.63.0, ESLint 10.10.0, Prettier 3.9.7, argon2id via `@node-rs/argon2` 2.2.1.

**Spec:** `docs/superpowers/specs/2026-09-16-product-content-studio-design.md`

## Global Constraints

- **Package manager:** npm. Never introduce a `yarn.lock` or `pnpm-lock.yaml`.
- **Version pinning — critical:** the `latest` dist-tag for the `prisma` CLI is currently `8.0.0-rc.15`, a release candidate, while `@prisma/client` latest is `7.10.0`. Installing without an explicit version produces a broken CLI/client mismatch. Always install `prisma@7.10.0`, `@prisma/client@7.10.0`, and `@prisma/adapter-pg@7.10.0` together with exact versions.
- **Next.js 16 async request APIs:** `cookies()`, `headers()`, and `params` in `page.tsx`, `layout.tsx`, and `route.ts` are Promises and **must** be awaited. Synchronous access was removed in v16.
- **Prisma 7 client import:** the generator is `provider = "prisma-client"` (no `-js`) with a required `output`. Import from the generated path (`@/generated/prisma/client`), **never** from `@prisma/client`.
- **Field limits, exact:** description ≤ 1000 characters, SEO title ≤ 60, SEO description ≤ 160. All three non-empty **after trimming**.
- **Session lifetime:** exactly 24 hours.
- **Read-only fields:** `Product.name` and `ProductSpec` rows have no write path anywhere — not in the service layer, not in any Zod schema, not in any route.
- **No `dangerouslySetInnerHTML` anywhere.** ESLint enforces this.
- **UI copy in Ukrainian.** Code, identifiers, comments, commit messages, and documentation in English.
- **Secrets:** `.env` is gitignored and already exists locally with all five variables. `.env.example` is committed with placeholders. Never commit a real secret, never expose one under a `NEXT_PUBLIC_` name, and never return `passwordHash` from the service layer.
- **Drafts return 404, never 403,** on every public surface.
- **Commit after every task** using the message given in the task's final step.

## Environment already in place

Do not redo these; they are done and verified:

- Repo at `C:\Dev_IT\product-content-studio`, git initialized, remote `origin` → `https://github.com/RomanPie2020/product-content-studio`, branch `main`.
- `.gitignore` excluding `.env`; `.env.example` committed.
- `.env` present with `DATABASE_URL`, `TEST_DATABASE_URL`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `E2E_BASE_URL`.
- PostgreSQL 18 running on `localhost:5432`, role `pcs_app` created, databases `product_studio` and `product_studio_test` created and owned by `pcs_app`, both connection-verified.

## File Structure

| Path | Responsibility |
|---|---|
| `prisma/schema.prisma` | Data model and generator config |
| `prisma/seed.ts` | Demo admin + three products |
| `prisma.config.ts` | Prisma 7 CLI config (schema path, seed command) |
| `scripts/with-test-db.mjs` | Cross-platform runner that swaps `DATABASE_URL` → `TEST_DATABASE_URL` |
| `src/lib/db.ts` | Prisma client singleton with pg driver adapter |
| `src/lib/validation/product.ts` | Zod schemas + limit constants, shared client/server |
| `src/lib/validation/errors.ts` | Zod error → field-keyed messages (schema-agnostic) |
| `src/lib/auth/password.ts` | argon2id hash / verify |
| `src/lib/auth/session.ts` | Token generation, create/validate/revoke |
| `src/lib/auth/guard.ts` | Cookie → current user, for pages and routes |
| `src/lib/products/service.ts` | All product reads and the single content write |
| `src/lib/http/responses.ts` | Uniform JSON success/error envelopes |
| `src/app/api/auth/login/route.ts` | `POST` login |
| `src/app/api/auth/logout/route.ts` | `POST` logout |
| `src/app/api/admin/products/route.ts` | `GET` admin list |
| `src/app/api/admin/products/[id]/route.ts` | `GET` one, `PATCH` content |
| `src/app/api/products/route.ts` | `GET` published list |
| `src/app/api/products/[slug]/route.ts` | `GET` published one |
| `src/app/page.tsx` | Public catalog |
| `src/app/products/[slug]/page.tsx` | Public card + `generateMetadata` |
| `src/app/admin/login/page.tsx` + `login-form.tsx` | Login |
| `src/app/admin/products/page.tsx` | Admin list |
| `src/app/admin/products/[id]/page.tsx` + `editor-form.tsx` | Editor |
| `src/components/*` | Shared presentational primitives |
| `tests/*.test.ts` | Vitest suites |
| `e2e/*.spec.ts` | Playwright suites |

---

### Task 1: Scaffold the application and tooling

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `.prettierrc.json`, `.prettierignore`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`

**Interfaces:**
- Consumes: nothing
- Produces: a running Next.js app; the `@/*` path alias mapping to `src/*`; npm scripts `dev`, `build`, `start`, `lint`, `format`, `format:check`

- [ ] **Step 1: Create the project manually (do not use `create-next-app`)**

`create-next-app` refuses to scaffold into a directory that already has files, and we already have `docs/`, `.gitignore`, and `.env`. Create `package.json`:

```json
{
  "name": "product-content-studio",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "format": "prettier --write .",
    "format:check": "prettier --check ."
  }
}
```

- [ ] **Step 2: Install dependencies with exact versions**

```bash
npm install --save-exact next@16.3.5 react@19.3.0 react-dom@19.3.0 zod@4.6.5
npm install --save-exact --save-dev typescript@5.9.3 @types/node@22.18.0 @types/react@19.3.0 @types/react-dom@19.3.0 tailwindcss@4.3.3 @tailwindcss/postcss@4.3.3 eslint@10.10.0 eslint-config-next@16.3.5 prettier@3.9.7
```

If `@types/react@19.3.0` does not resolve, use `npm install --save-dev @types/react@^19 @types/react-dom@^19` — the types package versions track React loosely.

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Create `next.config.ts`, `postcss.config.mjs`, and Prettier config**

`next.config.ts`:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
```

`postcss.config.mjs`:

```js
const config = {
  plugins: ["@tailwindcss/postcss"],
};

export default config;
```

`.prettierrc.json`:

```json
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all",
  "printWidth": 100
}
```

`.prettierignore`:

```
.next
node_modules
src/generated
prisma/migrations
playwright-report
test-results
```

- [ ] **Step 5: Create `eslint.config.mjs` (ESLint 10 flat config)**

The `react/no-danger` rule is what enforces the "content cannot execute as script" requirement.

```js
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

export default [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "react/no-danger": "error",
    },
  },
  {
    ignores: [".next/**", "node_modules/**", "src/generated/**", "playwright-report/**"],
  },
];
```

Install the compat helper: `npm install --save-exact --save-dev @eslint/eslintrc@3.3.1`

- [ ] **Step 6: Create the root layout, global stylesheet, and a placeholder home page**

`src/app/globals.css`:

```css
@import "tailwindcss";

:root {
  --background: #ffffff;
  --foreground: #111827;
}

body {
  background: var(--background);
  color: var(--foreground);
}
```

`src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Product Content Studio",
  description: "Редактор товарних карток",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
```

`src/app/page.tsx` (temporary, replaced in Task 14):

```tsx
export default function HomePage() {
  return <main className="p-8">Каталог</main>;
}
```

- [ ] **Step 7: Verify the app builds and lints**

```bash
npm run build
npm run lint
npm run format:check
```

Expected: build succeeds, lint reports no errors, Prettier reports all files formatted. If `format:check` fails, run `npm run format` and re-check.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "Scaffold Next.js app with TypeScript, Tailwind, ESLint and Prettier"
```

---

### Task 2: Prisma schema, migration, and client singleton

**Files:**
- Create: `prisma/schema.prisma`, `prisma.config.ts`, `src/lib/db.ts`, `scripts/with-test-db.mjs`
- Modify: `package.json` (scripts)

**Interfaces:**
- Consumes: `DATABASE_URL`, `TEST_DATABASE_URL` from `.env`
- Produces: `prisma` — the `PrismaClient` singleton exported from `@/lib/db`; generated types `Product`, `ProductSpec`, `User`, `Session`, `ProductStatus` importable from `@/generated/prisma/client`

- [ ] **Step 1: Install Prisma with pinned versions**

```bash
npm install --save-exact @prisma/client@7.10.0 @prisma/adapter-pg@7.10.0 pg@8.23.0
npm install --save-exact --save-dev prisma@7.10.0 @types/pg@8.23.1 dotenv@17.4.2 tsx@4.23.13
```

The explicit `prisma@7.10.0` is mandatory — see Global Constraints.

- [ ] **Step 2: Create `prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum ProductStatus {
  draft
  published
}

model User {
  id           String    @id @default(cuid())
  email        String    @unique
  passwordHash String
  createdAt    DateTime  @default(now())
  sessions     Session[]
}

model Session {
  id        String   @id
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt DateTime
  createdAt DateTime @default(now())

  @@index([userId])
}

model Product {
  id             String        @id @default(cuid())
  slug           String        @unique
  name           String
  description    String
  seoTitle       String
  seoDescription String
  status         ProductStatus @default(draft)
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt
  specs          ProductSpec[]
}

model ProductSpec {
  id        String  @id @default(cuid())
  productId String
  product   Product @relation(fields: [productId], references: [id], onDelete: Cascade)
  label     String
  value     String
  position  Int

  @@index([productId])
}
```

`Session.id` holds the SHA-256 hash of the session token, never the token itself — see Task 6.

- [ ] **Step 3: Create `prisma.config.ts`**

Prisma 7 no longer auto-loads `.env`; `import "dotenv/config"` is required.

```ts
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
```

- [ ] **Step 4: Create `scripts/with-test-db.mjs`**

Inline `VAR=value command` prefixes do not work on Windows, so environment swapping goes through Node.

```js
import { spawnSync } from "node:child_process";
import "dotenv/config";

const url = process.env.TEST_DATABASE_URL;
if (!url) {
  console.error("TEST_DATABASE_URL is not set. Copy .env.example to .env and fill it in.");
  process.exit(1);
}

const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error("Usage: node scripts/with-test-db.mjs <command> [args...]");
  process.exit(1);
}

const result = spawnSync(command, args, {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, DATABASE_URL: url },
});

process.exit(result.status ?? 1);
```

- [ ] **Step 5: Add database scripts to `package.json`**

```json
"db:generate": "prisma generate",
"db:migrate": "prisma migrate dev",
"db:deploy": "prisma migrate deploy",
"db:seed": "prisma db seed",
"db:reset": "prisma migrate reset --force",
"db:test:deploy": "node scripts/with-test-db.mjs prisma migrate deploy"
```

- [ ] **Step 6: Create the initial migration and generate the client**

```bash
npm run db:migrate -- --name init
npm run db:test:deploy
```

Expected: a directory appears under `prisma/migrations/`, both databases gain the four tables, and `src/generated/prisma/` is populated.

- [ ] **Step 7: Add `src/generated` to `.gitignore`**

Append to `.gitignore`:

```
# prisma generated client
src/generated/
```

The client is a build artifact regenerated by `npm run db:generate`; the README will instruct reviewers to run it.

- [ ] **Step 8: Create `src/lib/db.ts`**

```ts
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env and fill it in.");
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

The singleton guard prevents connection-pool exhaustion from hot reloads in development.

- [ ] **Step 9: Verify the client connects**

```bash
npx tsx --env-file=.env -e "import('./src/lib/db.ts').then(async ({prisma}) => { console.log('products:', await prisma.product.count()); await prisma.$disconnect(); })"
```

Expected: `products: 0`.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "Add Prisma schema, initial migration and client singleton"
```

---

### Task 3: Seed script with demo data

**Files:**
- Create: `prisma/seed.ts`

**Interfaces:**
- Consumes: `prisma` from `@/lib/db`, `hashPassword` is *not* yet available, so this task uses `@node-rs/argon2` directly and Task 5 refactors it
- Produces: `seedDatabase(): Promise<void>` — exported so the Vitest and Playwright harnesses can reuse it

- [ ] **Step 1: Install argon2**

```bash
npm install --save-exact @node-rs/argon2@2.2.1
```

This package ships prebuilt binaries for Windows, macOS, and Linux — no C++ toolchain required.

- [ ] **Step 2: Write `prisma/seed.ts`**

Three products: two published, one draft, exactly as the task requires.

```ts
import "dotenv/config";
import { hash } from "@node-rs/argon2";
import { prisma } from "../src/lib/db";

type SeedSpec = { label: string; value: string };

type SeedProduct = {
  slug: string;
  name: string;
  description: string;
  seoTitle: string;
  seoDescription: string;
  status: "draft" | "published";
  specs: SeedSpec[];
};

const PRODUCTS: SeedProduct[] = [
  {
    slug: "kavomashyna-barista-pro",
    name: "Кавомашина Barista Pro",
    description:
      "Автоматична кавомашина з вбудованою керамічною кавомолкою та капучинатором. " +
      "Готує еспресо, americano та капучино одним дотиком, зберігає до шести профілів напоїв.",
    seoTitle: "Кавомашина Barista Pro — автоматична з капучинатором",
    seoDescription:
      "Автоматична кавомашина Barista Pro з керамічною кавомолкою, капучинатором і шістьма профілями напоїв.",
    status: "published",
    specs: [
      { label: "Потужність", value: "1450 Вт" },
      { label: "Тиск помпи", value: "19 бар" },
      { label: "Об'єм резервуара", value: "1.8 л" },
      { label: "Гарантія", value: "24 місяці" },
    ],
  },
  {
    slug: "navushnyky-aura-silent",
    name: "Навушники Aura Silent",
    description:
      "Бездротові повнорозмірні навушники з активним шумозаглушенням і часом роботи до 40 годин. " +
      "Складна конструкція та чохол у комплекті роблять їх зручними в дорозі.",
    seoTitle: "Навушники Aura Silent — бездротові з шумозаглушенням",
    seoDescription:
      "Бездротові навушники Aura Silent з активним шумозаглушенням, 40 годин автономності та чохлом у комплекті.",
    status: "published",
    specs: [
      { label: "Тип", value: "Повнорозмірні, закриті" },
      { label: "Час роботи", value: "40 годин" },
      { label: "Bluetooth", value: "5.3" },
      { label: "Вага", value: "255 г" },
    ],
  },
  {
    slug: "chaynyk-thermo-glass",
    name: "Чайник Thermo Glass",
    description:
      "Скляний електрочайник з підсвіткою та регулюванням температури від 40 до 100 градусів. " +
      "Підтримує температуру протягом години після закипання.",
    seoTitle: "Чайник Thermo Glass — скляний з регулюванням температури",
    seoDescription:
      "Скляний електрочайник Thermo Glass із підсвіткою, вибором температури 40–100 °C і годинним підтриманням тепла.",
    status: "draft",
    specs: [
      { label: "Матеріал колби", value: "Термостійке скло" },
      { label: "Об'єм", value: "1.7 л" },
      { label: "Потужність", value: "2200 Вт" },
      { label: "Гарантія", value: "12 місяців" },
    ],
  },
];

export async function seedDatabase(): Promise<void> {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error("SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set");
  }

  const passwordHash = await hash(password);

  await prisma.user.upsert({
    where: { email },
    update: { passwordHash },
    create: { email, passwordHash },
  });

  for (const product of PRODUCTS) {
    const { specs, ...fields } = product;
    await prisma.product.upsert({
      where: { slug: product.slug },
      update: fields,
      create: { ...fields, specs: { create: specs } },
    });
  }
}

async function main() {
  await seedDatabase();
  const [users, products] = await Promise.all([prisma.user.count(), prisma.product.count()]);
  console.log(`Seeded ${users} user(s) and ${products} product(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 3: Run the seed and verify the counts**

```bash
npm run db:seed
```

Expected output: `Seeded 1 user(s) and 3 product(s).`

- [ ] **Step 4: Verify the draft/published split directly in the database**

```bash
npx tsx --env-file=.env -e "import('./src/lib/db.ts').then(async ({prisma}) => { console.log(await prisma.product.groupBy({ by: ['status'], _count: true })); await prisma.\$disconnect(); })"
```

Expected: `published` count 2, `draft` count 1.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add seed script with one admin and three demo products"
```

---

### Task 4: Vitest harness against the test database

**Files:**
- Create: `vitest.config.ts`, `tests/helpers/db.ts`
- Modify: `package.json` (scripts)

**Interfaces:**
- Consumes: `prisma` from `@/lib/db`, `seedDatabase` from `prisma/seed`
- Produces: `resetDatabase(): Promise<void>` and `resetAndSeed(): Promise<void>` from `tests/helpers/db`; npm scripts `test` and `test:watch`

- [ ] **Step 1: Install Vitest**

```bash
npm install --save-exact --save-dev vitest@5.0.1 vite-tsconfig-paths@6.1.1
```

- [ ] **Step 2: Create `vitest.config.ts`**

`vite-tsconfig-paths` makes the `@/*` alias resolve inside tests. `fileParallelism: false` keeps suites from truncating each other's rows.

```ts
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 20000,
  },
});
```

- [ ] **Step 3: Create `tests/helpers/db.ts`**

```ts
import { prisma } from "@/lib/db";
import { seedDatabase } from "../../prisma/seed";

export async function resetDatabase(): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "ProductSpec", "Product", "Session", "User" RESTART IDENTITY CASCADE',
  );
}

export async function resetAndSeed(): Promise<void> {
  await resetDatabase();
  await seedDatabase();
}
```

- [ ] **Step 4: Add test scripts to `package.json`**

```json
"test": "node scripts/with-test-db.mjs vitest run",
"test:watch": "node scripts/with-test-db.mjs vitest"
```

- [ ] **Step 5: Write a guard test proving the harness points at the test database**

This test exists to catch the worst possible misconfiguration: tests wiping the development database.

`tests/helpers/db.test.ts`:

```ts
import { describe, expect, it, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { resetAndSeed, resetDatabase } from "./db";

describe("test database harness", () => {
  it("is pointed at the test database, not the development one", () => {
    expect(process.env.DATABASE_URL).toContain("product_studio_test");
  });

  it("truncates every table", async () => {
    await resetDatabase();
    expect(await prisma.product.count()).toBe(0);
    expect(await prisma.user.count()).toBe(0);
  });

  it("seeds one admin and three products", async () => {
    await resetAndSeed();
    expect(await prisma.user.count()).toBe(1);
    expect(await prisma.product.count()).toBe(3);
    expect(await prisma.product.count({ where: { status: "published" } })).toBe(2);
    expect(await prisma.product.count({ where: { status: "draft" } })).toBe(1);
  });
});
```

- [ ] **Step 6: Run the tests**

```bash
npm test
```

Expected: 3 passing tests. Then confirm the development database was untouched:

```bash
npm run db:seed
```

Expected: still `Seeded 1 user(s) and 3 product(s).`

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Add Vitest harness backed by a separate test database"
```

---

### Task 5: Validation schemas

**Files:**
- Create: `src/lib/validation/product.ts`, `src/lib/validation/errors.ts`, `tests/validation.test.ts`

**Interfaces:**
- Consumes: `zod`
- Produces: `PRODUCT_LIMITS` (`{ description: 1000; seoTitle: 60; seoDescription: 160 }`), `productContentSchema` (Zod object over `description`, `seoTitle`, `seoDescription`, `status`), `type ProductContentInput = { description: string; seoTitle: string; seoDescription: string; status: "draft" | "published" }`, and from `@/lib/validation/errors`: `formatFieldErrors(error: ZodError): Record<string, string[]>`

- [ ] **Step 1: Write the failing tests**

`tests/validation.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { PRODUCT_LIMITS, productContentSchema } from "@/lib/validation/product";
import { formatFieldErrors } from "@/lib/validation/errors";

const valid = {
  description: "Опис товару",
  seoTitle: "SEO заголовок",
  seoDescription: "SEO опис",
  status: "published" as const,
};

describe("productContentSchema", () => {
  it("accepts valid content", () => {
    expect(productContentSchema.safeParse(valid).success).toBe(true);
  });

  it("exposes the limits required by the task", () => {
    expect(PRODUCT_LIMITS).toEqual({ description: 1000, seoTitle: 60, seoDescription: 160 });
  });

  it.each([
    ["description", 1000],
    ["seoTitle", 60],
    ["seoDescription", 160],
  ])("accepts %s at exactly %i characters", (field, max) => {
    const result = productContentSchema.safeParse({ ...valid, [field]: "я".repeat(max) });
    expect(result.success).toBe(true);
  });

  it.each([
    ["description", 1001],
    ["seoTitle", 61],
    ["seoDescription", 161],
  ])("rejects %s at %i characters", (field, length) => {
    const result = productContentSchema.safeParse({ ...valid, [field]: "я".repeat(length) });
    expect(result.success).toBe(false);
  });

  it.each(["description", "seoTitle", "seoDescription"])("rejects an empty %s", (field) => {
    expect(productContentSchema.safeParse({ ...valid, [field]: "" }).success).toBe(false);
  });

  it.each(["description", "seoTitle", "seoDescription"])(
    "rejects a whitespace-only %s",
    (field) => {
      expect(productContentSchema.safeParse({ ...valid, [field]: "   \n\t " }).success).toBe(false);
    },
  );

  it("trims surrounding whitespace before storing", () => {
    const result = productContentSchema.safeParse({ ...valid, description: "  Опис  " });
    expect(result.success && result.data.description).toBe("Опис");
  });

  it("rejects an unknown status", () => {
    expect(productContentSchema.safeParse({ ...valid, status: "archived" }).success).toBe(false);
  });

  it("rejects a missing field", () => {
    const { seoTitle, ...withoutSeoTitle } = valid;
    expect(productContentSchema.safeParse(withoutSeoTitle).success).toBe(false);
  });

  it("ignores attempts to set read-only fields", () => {
    const result = productContentSchema.safeParse({ ...valid, name: "Хакер", id: "x" });
    expect(result.success).toBe(true);
    expect(result.success && "name" in result.data).toBe(false);
  });
});

describe("formatFieldErrors", () => {
  it("groups messages by field name", () => {
    const result = productContentSchema.safeParse({ ...valid, seoTitle: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = formatFieldErrors(result.error);
      expect(errors.seoTitle?.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- tests/validation.test.ts`
Expected: FAIL — cannot resolve `@/lib/validation/product`.

- [ ] **Step 3: Implement `src/lib/validation/product.ts`**

Trimming happens before the length checks, so a field of spaces fails as empty rather than passing on raw length.

```ts
import { z } from "zod";

export const PRODUCT_LIMITS = {
  description: 1000,
  seoTitle: 60,
  seoDescription: 160,
} as const;

function boundedText(max: number, label: string) {
  return z
    .string({ message: `${label}: обов'язкове поле` })
    .transform((value) => value.trim())
    .refine((value) => value.length > 0, { message: `${label}: поле не може бути порожнім` })
    .refine((value) => value.length <= max, {
      message: `${label}: максимум ${max} символів`,
    });
}

export const productStatusSchema = z.enum(["draft", "published"], {
  message: "Статус має бути draft або published",
});

export const productContentSchema = z.object({
  description: boundedText(PRODUCT_LIMITS.description, "Опис"),
  seoTitle: boundedText(PRODUCT_LIMITS.seoTitle, "SEO-заголовок"),
  seoDescription: boundedText(PRODUCT_LIMITS.seoDescription, "SEO-опис"),
  status: productStatusSchema,
});

export type ProductContentInput = z.infer<typeof productContentSchema>;
```

Then create `src/lib/validation/errors.ts`. It is schema-agnostic and deliberately separate, so the auth routes can use it without importing product code:

```ts
import type { ZodError } from "zod";

export function formatFieldErrors(error: ZodError): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    (errors[key] ??= []).push(issue.message);
  }
  return errors;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- tests/validation.test.ts`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add shared Zod validation for product content"
```

---

### Task 6: Password hashing and session management

**Files:**
- Create: `src/lib/auth/password.ts`, `src/lib/auth/session.ts`, `tests/auth.test.ts`
- Modify: `prisma/seed.ts` (use `hashPassword`)

**Interfaces:**
- Consumes: `prisma` from `@/lib/db`, `@node-rs/argon2`
- Produces:
  - `hashPassword(plain: string): Promise<string>`
  - `verifyPassword(hash: string, plain: string): Promise<boolean>`
  - `SESSION_COOKIE = "pcs_session"`, `SESSION_TTL_MS = 86_400_000`
  - `createSession(userId: string): Promise<{ token: string; expiresAt: Date }>`
  - `validateSession(token: string): Promise<{ id: string; email: string } | null>`
  - `revokeSession(token: string): Promise<void>`

- [ ] **Step 1: Write the failing tests**

`tests/auth.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  SESSION_TTL_MS,
  createSession,
  revokeSession,
  validateSession,
} from "@/lib/auth/session";
import { resetAndSeed } from "./helpers/db";

describe("password hashing", () => {
  it("produces an argon2id hash that is not the plaintext", async () => {
    const hash = await hashPassword("Admin12345!");
    expect(hash).toContain("$argon2id$");
    expect(hash).not.toContain("Admin12345!");
  });

  it("verifies the correct password", async () => {
    const hash = await hashPassword("Admin12345!");
    expect(await verifyPassword(hash, "Admin12345!")).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const hash = await hashPassword("Admin12345!");
    expect(await verifyPassword(hash, "wrong")).toBe(false);
  });

  it("returns false rather than throwing on a malformed hash", async () => {
    expect(await verifyPassword("not-a-hash", "Admin12345!")).toBe(false);
  });

  it("salts, so the same password hashes differently each time", async () => {
    expect(await hashPassword("same")).not.toBe(await hashPassword("same"));
  });
});

describe("sessions", () => {
  let userId: string;

  beforeEach(async () => {
    await resetAndSeed();
    const user = await prisma.user.findFirstOrThrow();
    userId = user.id;
  });

  it("creates a session and validates its token", async () => {
    const { token } = await createSession(userId);
    const user = await validateSession(token);
    expect(user?.id).toBe(userId);
  });

  it("stores a hash of the token, never the token itself", async () => {
    const { token } = await createSession(userId);
    const stored = await prisma.session.findFirstOrThrow();
    expect(stored.id).not.toBe(token);
    expect(stored.id).toHaveLength(64);
  });

  it("expires 24 hours after creation", async () => {
    const before = Date.now();
    const { expiresAt } = await createSession(userId);
    const delta = expiresAt.getTime() - before;
    expect(delta).toBeGreaterThan(SESSION_TTL_MS - 5000);
    expect(delta).toBeLessThanOrEqual(SESSION_TTL_MS + 5000);
  });

  it("rejects an unknown token", async () => {
    expect(await validateSession("made-up-token")).toBeNull();
  });

  it("rejects an expired session and deletes it", async () => {
    const { token } = await createSession(userId);
    await prisma.session.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await validateSession(token)).toBeNull();
    expect(await prisma.session.count()).toBe(0);
  });

  it("revokes a session so its token stops working", async () => {
    const { token } = await createSession(userId);
    await revokeSession(token);
    expect(await validateSession(token)).toBeNull();
    expect(await prisma.session.count()).toBe(0);
  });

  it("issues a different token each time", async () => {
    const a = await createSession(userId);
    const b = await createSession(userId);
    expect(a.token).not.toBe(b.token);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- tests/auth.test.ts`
Expected: FAIL — cannot resolve `@/lib/auth/password`.

- [ ] **Step 3: Implement `src/lib/auth/password.ts`**

```ts
import { hash, verify } from "@node-rs/argon2";

export function hashPassword(plain: string): Promise<string> {
  return hash(plain);
}

export async function verifyPassword(storedHash: string, plain: string): Promise<boolean> {
  try {
    return await verify(storedHash, plain);
  } catch {
    // A malformed or truncated hash is an authentication failure, not a crash.
    return false;
  }
}
```

- [ ] **Step 4: Implement `src/lib/auth/session.ts`**

Only the SHA-256 digest of the token is stored, so a database leak does not hand an attacker usable session tokens.

```ts
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";

export const SESSION_COOKIE = "pcs_session";
export const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.session.create({
    data: { id: hashToken(token), userId, expiresAt },
  });

  return { token, expiresAt };
}

export async function validateSession(token: string): Promise<{ id: string; email: string } | null> {
  const id = hashToken(token);
  const session = await prisma.session.findUnique({
    where: { id },
    include: { user: { select: { id: true, email: true } } },
  });

  if (!session) {
    return null;
  }

  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.session.delete({ where: { id } }).catch(() => undefined);
    return null;
  }

  return session.user;
}

export async function revokeSession(token: string): Promise<void> {
  await prisma.session.delete({ where: { id: hashToken(token) } }).catch(() => undefined);
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npm test -- tests/auth.test.ts`
Expected: all tests PASS.

- [ ] **Step 6: Refactor the seed to reuse `hashPassword`**

In `prisma/seed.ts`, replace `import { hash } from "@node-rs/argon2";` with `import { hashPassword } from "../src/lib/auth/password";` and change `const passwordHash = await hash(password);` to `const passwordHash = await hashPassword(password);`.

- [ ] **Step 7: Re-run the whole suite**

Run: `npm test`
Expected: every test still passes.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "Add argon2id password hashing and database-backed sessions"
```

---

### Task 7: Product service layer

**Files:**
- Create: `src/lib/products/service.ts`, `tests/products.service.test.ts`

**Interfaces:**
- Consumes: `prisma` from `@/lib/db`, `ProductContentInput` from `@/lib/validation/product`
- Produces:
  - `type ProductSummary = { id: string; slug: string; name: string; status: "draft" | "published" }`
  - `type ProductDetail = ProductSummary & { description: string; seoTitle: string; seoDescription: string; specs: Array<{ id: string; label: string; value: string }> }`
  - `listPublishedProducts(): Promise<ProductSummary[]>`
  - `getPublishedProductBySlug(slug: string): Promise<ProductDetail | null>`
  - `listAllProducts(): Promise<ProductSummary[]>`
  - `getProductById(id: string): Promise<ProductDetail | null>`
  - `updateProductContent(id: string, input: ProductContentInput): Promise<ProductDetail | null>`

- [ ] **Step 1: Write the failing tests**

`tests/products.service.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import {
  getProductById,
  getPublishedProductBySlug,
  listAllProducts,
  listPublishedProducts,
  updateProductContent,
} from "@/lib/products/service";
import { resetAndSeed } from "./helpers/db";

const DRAFT_SLUG = "chaynyk-thermo-glass";
const PUBLISHED_SLUG = "kavomashyna-barista-pro";

beforeEach(async () => {
  await resetAndSeed();
});

describe("public reads", () => {
  it("lists only published products", async () => {
    const products = await listPublishedProducts();
    expect(products).toHaveLength(2);
    expect(products.every((p) => p.status === "published")).toBe(true);
    expect(products.map((p) => p.slug)).not.toContain(DRAFT_SLUG);
  });

  it("returns a published product with its specs", async () => {
    const product = await getPublishedProductBySlug(PUBLISHED_SLUG);
    expect(product?.name).toBe("Кавомашина Barista Pro");
    expect(product?.specs.length).toBeGreaterThan(0);
  });

  it("returns null for a draft, so the caller can 404", async () => {
    expect(await getPublishedProductBySlug(DRAFT_SLUG)).toBeNull();
  });

  it("returns null for an unknown slug", async () => {
    expect(await getPublishedProductBySlug("does-not-exist")).toBeNull();
  });
});

describe("admin reads", () => {
  it("lists every product regardless of status", async () => {
    const products = await listAllProducts();
    expect(products).toHaveLength(3);
    expect(products.map((p) => p.status)).toContain("draft");
  });

  it("returns a draft by id", async () => {
    const draft = await prisma.product.findUniqueOrThrow({ where: { slug: DRAFT_SLUG } });
    expect((await getProductById(draft.id))?.slug).toBe(DRAFT_SLUG);
  });

  it("returns null for an unknown id", async () => {
    expect(await getProductById("no-such-id")).toBeNull();
  });
});

describe("updateProductContent", () => {
  async function draftId() {
    const draft = await prisma.product.findUniqueOrThrow({ where: { slug: DRAFT_SLUG } });
    return draft.id;
  }

  it("persists the editable fields", async () => {
    const id = await draftId();
    const updated = await updateProductContent(id, {
      description: "Новий опис",
      seoTitle: "Новий SEO заголовок",
      seoDescription: "Новий SEO опис",
      status: "published",
    });

    expect(updated?.description).toBe("Новий опис");

    const reloaded = await prisma.product.findUniqueOrThrow({ where: { id } });
    expect(reloaded.seoTitle).toBe("Новий SEO заголовок");
    expect(reloaded.status).toBe("published");
  });

  it("publishing makes the product visible to the public catalog", async () => {
    const id = await draftId();
    await updateProductContent(id, {
      description: "Опис",
      seoTitle: "Заголовок",
      seoDescription: "Опис для SEO",
      status: "published",
    });
    expect(await listPublishedProducts()).toHaveLength(3);
    expect(await getPublishedProductBySlug(DRAFT_SLUG)).not.toBeNull();
  });

  it("never changes the name or the specs", async () => {
    const id = await draftId();
    const before = await prisma.product.findUniqueOrThrow({
      where: { id },
      include: { specs: true },
    });

    await updateProductContent(id, {
      description: "Опис",
      seoTitle: "Заголовок",
      seoDescription: "Опис для SEO",
      status: "draft",
    });

    const after = await prisma.product.findUniqueOrThrow({
      where: { id },
      include: { specs: true },
    });

    expect(after.name).toBe(before.name);
    expect(after.specs.map((s) => s.value)).toEqual(before.specs.map((s) => s.value));
  });

  it("returns null for an unknown id instead of throwing", async () => {
    const result = await updateProductContent("no-such-id", {
      description: "Опис",
      seoTitle: "Заголовок",
      seoDescription: "Опис для SEO",
      status: "draft",
    });
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- tests/products.service.test.ts`
Expected: FAIL — cannot resolve `@/lib/products/service`.

- [ ] **Step 3: Implement `src/lib/products/service.ts`**

The `select` clauses are the enforcement point for read-only fields: `name` and `specs` are never in any `data` payload.

```ts
import { prisma } from "@/lib/db";
import type { ProductContentInput } from "@/lib/validation/product";

export type ProductStatusValue = "draft" | "published";

export type ProductSummary = {
  id: string;
  slug: string;
  name: string;
  status: ProductStatusValue;
};

export type ProductDetail = ProductSummary & {
  description: string;
  seoTitle: string;
  seoDescription: string;
  specs: Array<{ id: string; label: string; value: string }>;
};

const summarySelect = { id: true, slug: true, name: true, status: true } as const;

const detailSelect = {
  ...summarySelect,
  description: true,
  seoTitle: true,
  seoDescription: true,
  specs: {
    select: { id: true, label: true, value: true },
    orderBy: { position: "asc" },
  },
} as const;

export async function listPublishedProducts(): Promise<ProductSummary[]> {
  return prisma.product.findMany({
    where: { status: "published" },
    select: summarySelect,
    orderBy: { name: "asc" },
  });
}

export async function getPublishedProductBySlug(slug: string): Promise<ProductDetail | null> {
  return prisma.product.findFirst({
    where: { slug, status: "published" },
    select: detailSelect,
  });
}

export async function listAllProducts(): Promise<ProductSummary[]> {
  return prisma.product.findMany({ select: summarySelect, orderBy: { name: "asc" } });
}

export async function getProductById(id: string): Promise<ProductDetail | null> {
  return prisma.product.findUnique({ where: { id }, select: detailSelect });
}

export async function updateProductContent(
  id: string,
  input: ProductContentInput,
): Promise<ProductDetail | null> {
  const existing = await prisma.product.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    return null;
  }

  return prisma.product.update({
    where: { id },
    data: {
      description: input.description,
      seoTitle: input.seoTitle,
      seoDescription: input.seoDescription,
      status: input.status,
    },
    select: detailSelect,
  });
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- tests/products.service.test.ts`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add product service layer with published-only public reads"
```

---

### Task 8: HTTP helpers and the authentication guard

**Files:**
- Create: `src/lib/http/responses.ts`, `src/lib/auth/guard.ts`

**Interfaces:**
- Consumes: `validateSession`, `SESSION_COOKIE` from `@/lib/auth/session`
- Produces:
  - `jsonOk<T>(data: T, status?: number): Response`
  - `jsonError(message: string, status: number, fieldErrors?: Record<string, string[]>): Response`
  - `getCurrentUser(): Promise<{ id: string; email: string } | null>`
  - `setSessionCookie(token: string, expiresAt: Date): Promise<void>`
  - `clearSessionCookie(): Promise<void>`

- [ ] **Step 1: Implement `src/lib/http/responses.ts`**

A single envelope shape keeps the client's error handling simple.

```ts
export function jsonOk<T>(data: T, status = 200): Response {
  return Response.json({ data }, { status });
}

export function jsonError(
  message: string,
  status: number,
  fieldErrors?: Record<string, string[]>,
): Response {
  return Response.json({ error: { message, fieldErrors: fieldErrors ?? null } }, { status });
}
```

- [ ] **Step 2: Implement `src/lib/auth/guard.ts`**

`cookies()` is async in Next.js 16 and must be awaited.

```ts
import { cookies } from "next/headers";
import { SESSION_COOKIE, SESSION_TTL_MS, validateSession } from "@/lib/auth/session";

export async function getCurrentUser(): Promise<{ id: string; email: string } | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  return validateSession(token);
}

export async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
```

- [ ] **Step 3: Verify it typechecks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "Add JSON response helpers and session cookie guard"
```

---

### Task 9: Authentication API routes

**Files:**
- Create: `src/app/api/auth/login/route.ts`, `src/app/api/auth/logout/route.ts`, `src/lib/validation/auth.ts`, `tests/api.auth.test.ts`
- Modify: `vitest.config.ts` if a `next/headers` mock is needed

**Interfaces:**
- Consumes: everything from Tasks 5–8
- Produces: `POST /api/auth/login` → 200 `{ data: { email } }` + `Set-Cookie`, 400 on malformed body, 401 on bad credentials; `POST /api/auth/logout` → 200 and revoked session; `loginSchema` from `@/lib/validation/auth`

**Testing note:** Route handlers call `cookies()` from `next/headers`, which throws outside a request scope. These tests mock `next/headers` with an in-memory cookie store, which keeps them fast and lets us assert on cookie attributes directly. Real cookie round-tripping is covered by the Playwright suite in Task 18.

- [ ] **Step 1: Write the failing tests**

`tests/api.auth.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const cookieStore = new Map<string, { value: string; options: Record<string, unknown> }>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const entry = cookieStore.get(name);
      return entry ? { name, value: entry.value } : undefined;
    },
    set: (name: string, value: string, options: Record<string, unknown>) => {
      cookieStore.set(name, { value, options });
    },
    delete: (name: string) => {
      cookieStore.delete(name);
    },
  }),
}));

const { prisma } = await import("@/lib/db");
const { SESSION_COOKIE } = await import("@/lib/auth/session");
const { POST: login } = await import("@/app/api/auth/login/route");
const { POST: logout } = await import("@/app/api/auth/logout/route");
const { resetAndSeed } = await import("./helpers/db");

const EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@studio.local";
const PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "Admin12345!";

function post(body: unknown) {
  return new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(async () => {
  cookieStore.clear();
  await resetAndSeed();
});

describe("POST /api/auth/login", () => {
  it("accepts correct credentials and sets an httpOnly session cookie", async () => {
    const response = await login(post({ email: EMAIL, password: PASSWORD }));
    expect(response.status).toBe(200);

    const cookie = cookieStore.get(SESSION_COOKIE);
    expect(cookie).toBeDefined();
    expect(cookie?.options.httpOnly).toBe(true);
    expect(cookie?.options.sameSite).toBe("lax");
    expect(await prisma.session.count()).toBe(1);
  });

  it("rejects a wrong password with 401 and creates no session", async () => {
    const response = await login(post({ email: EMAIL, password: "wrong" }));
    expect(response.status).toBe(401);
    expect(cookieStore.has(SESSION_COOKIE)).toBe(false);
    expect(await prisma.session.count()).toBe(0);
  });

  it("rejects an unknown email with 401", async () => {
    const response = await login(post({ email: "nobody@example.com", password: PASSWORD }));
    expect(response.status).toBe(401);
  });

  it("uses the same message for both failures, so emails cannot be enumerated", async () => {
    const wrongPassword = await login(post({ email: EMAIL, password: "wrong" }));
    const unknownEmail = await login(post({ email: "nobody@example.com", password: PASSWORD }));
    const a = await wrongPassword.json();
    const b = await unknownEmail.json();
    expect(a.error.message).toBe(b.error.message);
  });

  it("rejects a malformed body with 400", async () => {
    const response = await login(post({ email: "not-an-email" }));
    expect(response.status).toBe(400);
  });

  it("never returns the password hash", async () => {
    const response = await login(post({ email: EMAIL, password: PASSWORD }));
    expect(JSON.stringify(await response.json())).not.toContain("argon2");
  });
});

describe("POST /api/auth/logout", () => {
  it("revokes the session and clears the cookie", async () => {
    await login(post({ email: EMAIL, password: PASSWORD }));
    expect(await prisma.session.count()).toBe(1);

    const response = await logout();
    expect(response.status).toBe(200);
    expect(await prisma.session.count()).toBe(0);
    expect(cookieStore.has(SESSION_COOKIE)).toBe(false);
  });

  it("succeeds even when no session exists", async () => {
    expect((await logout()).status).toBe(200);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- tests/api.auth.test.ts`
Expected: FAIL — cannot resolve `@/app/api/auth/login/route`.

- [ ] **Step 3: Create `src/lib/validation/auth.ts`**

```ts
import { z } from "zod";

export const loginSchema = z.object({
  email: z.email({ message: "Введіть коректну електронну адресу" }),
  password: z.string().min(1, { message: "Введіть пароль" }),
});

export type LoginInput = z.infer<typeof loginSchema>;
```

In Zod 4 the email validator is the top-level `z.email()`; `z.string().email()` is deprecated.

- [ ] **Step 4: Implement `src/app/api/auth/login/route.ts`**

The identical error message for both failure modes is deliberate — it prevents account enumeration.

```ts
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { setSessionCookie } from "@/lib/auth/guard";
import { jsonError, jsonOk } from "@/lib/http/responses";
import { formatFieldErrors } from "@/lib/validation/errors";
import { loginSchema } from "@/lib/validation/auth";

const INVALID_CREDENTIALS = "Невірна пошта або пароль";

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Некоректний запит", 400);
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Перевірте введені дані", 400, formatFieldErrors(parsed.error));
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || !(await verifyPassword(user.passwordHash, parsed.data.password))) {
    return jsonError(INVALID_CREDENTIALS, 401);
  }

  const { token, expiresAt } = await createSession(user.id);
  await setSessionCookie(token, expiresAt);

  return jsonOk({ email: user.email });
}
```

- [ ] **Step 5: Implement `src/app/api/auth/logout/route.ts`**

```ts
import { cookies } from "next/headers";
import { SESSION_COOKIE, revokeSession } from "@/lib/auth/session";
import { clearSessionCookie } from "@/lib/auth/guard";
import { jsonOk } from "@/lib/http/responses";

export async function POST(): Promise<Response> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;

  if (token) {
    await revokeSession(token);
  }

  await clearSessionCookie();
  return jsonOk({ ok: true });
}
```

- [ ] **Step 6: Run to verify it passes**

Run: `npm test -- tests/api.auth.test.ts`
Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Add login and logout REST endpoints"
```

---

### Task 10: Product API routes

**Files:**
- Create: `src/app/api/admin/products/route.ts`, `src/app/api/admin/products/[id]/route.ts`, `src/app/api/products/route.ts`, `src/app/api/products/[slug]/route.ts`, `tests/api.products.test.ts`

**Interfaces:**
- Consumes: service layer (Task 7), guard and helpers (Task 8)
- Produces: the five product endpoints listed in the spec

**Reminder:** in Next.js 16, the second argument's `params` is a `Promise` and must be awaited.

- [ ] **Step 1: Write the failing tests**

`tests/api.products.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const cookieStore = new Map<string, { value: string; options: Record<string, unknown> }>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const entry = cookieStore.get(name);
      return entry ? { name, value: entry.value } : undefined;
    },
    set: (name: string, value: string, options: Record<string, unknown>) => {
      cookieStore.set(name, { value, options });
    },
    delete: (name: string) => {
      cookieStore.delete(name);
    },
  }),
}));

const { prisma } = await import("@/lib/db");
const { POST: login } = await import("@/app/api/auth/login/route");
const { GET: adminList } = await import("@/app/api/admin/products/route");
const { GET: adminGet, PATCH: adminPatch } = await import(
  "@/app/api/admin/products/[id]/route"
);
const { GET: publicList } = await import("@/app/api/products/route");
const { GET: publicGet } = await import("@/app/api/products/[slug]/route");
const { resetAndSeed } = await import("./helpers/db");

const EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@studio.local";
const PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "Admin12345!";
const DRAFT_SLUG = "chaynyk-thermo-glass";

const VALID_BODY = {
  description: "Оновлений опис товару",
  seoTitle: "Оновлений SEO заголовок",
  seoDescription: "Оновлений SEO опис",
  status: "draft" as const,
};

async function signIn() {
  await login(
    new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    }),
  );
}

async function draftId(): Promise<string> {
  const draft = await prisma.product.findUniqueOrThrow({ where: { slug: DRAFT_SLUG } });
  return draft.id;
}

function patchRequest(body: unknown) {
  return new Request("http://localhost/api/admin/products/x", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(async () => {
  cookieStore.clear();
  await resetAndSeed();
});

describe("public product API", () => {
  it("lists only published products", async () => {
    const payload = await (await publicList()).json();
    expect(payload.data).toHaveLength(2);
    expect(payload.data.map((p: { slug: string }) => p.slug)).not.toContain(DRAFT_SLUG);
  });

  it("returns 404 for a draft, not 403", async () => {
    const response = await publicGet(new Request("http://localhost"), {
      params: Promise.resolve({ slug: DRAFT_SLUG }),
    });
    expect(response.status).toBe(404);
  });

  it("returns 404 for an unknown slug", async () => {
    const response = await publicGet(new Request("http://localhost"), {
      params: Promise.resolve({ slug: "nope" }),
    });
    expect(response.status).toBe(404);
  });

  it("returns a published product", async () => {
    const response = await publicGet(new Request("http://localhost"), {
      params: Promise.resolve({ slug: "kavomashyna-barista-pro" }),
    });
    expect(response.status).toBe(200);
  });
});

describe("admin product API without a session", () => {
  it("rejects the list with 401", async () => {
    expect((await adminList()).status).toBe(401);
  });

  it("rejects a single read with 401", async () => {
    const response = await adminGet(new Request("http://localhost"), {
      params: Promise.resolve({ id: await draftId() }),
    });
    expect(response.status).toBe(401);
  });

  it("rejects PATCH with 401 and leaves the row untouched", async () => {
    const id = await draftId();
    const before = await prisma.product.findUniqueOrThrow({ where: { id } });

    const response = await adminPatch(patchRequest(VALID_BODY), {
      params: Promise.resolve({ id }),
    });

    expect(response.status).toBe(401);
    const after = await prisma.product.findUniqueOrThrow({ where: { id } });
    expect(after.description).toBe(before.description);
  });
});

describe("admin product API with a session", () => {
  beforeEach(signIn);

  it("lists all products including the draft", async () => {
    const payload = await (await adminList()).json();
    expect(payload.data).toHaveLength(3);
  });

  it("saves valid content", async () => {
    const id = await draftId();
    const response = await adminPatch(patchRequest(VALID_BODY), {
      params: Promise.resolve({ id }),
    });

    expect(response.status).toBe(200);
    const reloaded = await prisma.product.findUniqueOrThrow({ where: { id } });
    expect(reloaded.description).toBe(VALID_BODY.description);
  });

  it("rejects an over-long description with 400 and does not write", async () => {
    const id = await draftId();
    const before = await prisma.product.findUniqueOrThrow({ where: { id } });

    const response = await adminPatch(
      patchRequest({ ...VALID_BODY, description: "я".repeat(1001) }),
      { params: Promise.resolve({ id }) },
    );

    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.error.fieldErrors.description).toBeDefined();

    const after = await prisma.product.findUniqueOrThrow({ where: { id } });
    expect(after.description).toBe(before.description);
  });

  it.each([
    ["seoTitle", 61],
    ["seoDescription", 161],
  ])("rejects an over-long %s with 400", async (field, length) => {
    const response = await adminPatch(
      patchRequest({ ...VALID_BODY, [field]: "я".repeat(length) }),
      { params: Promise.resolve({ id: await draftId() }) },
    );
    expect(response.status).toBe(400);
  });

  it("rejects a blank field with 400", async () => {
    const response = await adminPatch(patchRequest({ ...VALID_BODY, seoTitle: "   " }), {
      params: Promise.resolve({ id: await draftId() }),
    });
    expect(response.status).toBe(400);
  });

  it("ignores attempts to rename the product", async () => {
    const id = await draftId();
    const before = await prisma.product.findUniqueOrThrow({ where: { id } });

    await adminPatch(patchRequest({ ...VALID_BODY, name: "Зламана назва" }), {
      params: Promise.resolve({ id }),
    });

    const after = await prisma.product.findUniqueOrThrow({ where: { id } });
    expect(after.name).toBe(before.name);
  });

  it("returns 404 for an unknown id", async () => {
    const response = await adminPatch(patchRequest(VALID_BODY), {
      params: Promise.resolve({ id: "no-such-id" }),
    });
    expect(response.status).toBe(404);
  });

  it("publishing through the API exposes the product publicly", async () => {
    await adminPatch(patchRequest({ ...VALID_BODY, status: "published" }), {
      params: Promise.resolve({ id: await draftId() }),
    });

    const payload = await (await publicList()).json();
    expect(payload.data).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- tests/api.products.test.ts`
Expected: FAIL — cannot resolve the route modules.

- [ ] **Step 3: Implement the public routes**

`src/app/api/products/route.ts`:

```ts
import { listPublishedProducts } from "@/lib/products/service";
import { jsonOk } from "@/lib/http/responses";

export async function GET(): Promise<Response> {
  return jsonOk(await listPublishedProducts());
}
```

`src/app/api/products/[slug]/route.ts`:

```ts
import { getPublishedProductBySlug } from "@/lib/products/service";
import { jsonError, jsonOk } from "@/lib/http/responses";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  const product = await getPublishedProductBySlug(slug);

  // A draft and a non-existent slug are indistinguishable from outside.
  if (!product) {
    return jsonError("Товар не знайдено", 404);
  }

  return jsonOk(product);
}
```

- [ ] **Step 4: Implement the admin routes**

`src/app/api/admin/products/route.ts`:

```ts
import { getCurrentUser } from "@/lib/auth/guard";
import { listAllProducts } from "@/lib/products/service";
import { jsonError, jsonOk } from "@/lib/http/responses";

export async function GET(): Promise<Response> {
  if (!(await getCurrentUser())) {
    return jsonError("Потрібна авторизація", 401);
  }

  return jsonOk(await listAllProducts());
}
```

`src/app/api/admin/products/[id]/route.ts`:

```ts
import { getCurrentUser } from "@/lib/auth/guard";
import { getProductById, updateProductContent } from "@/lib/products/service";
import { jsonError, jsonOk } from "@/lib/http/responses";
import { productContentSchema } from "@/lib/validation/product";
import { formatFieldErrors } from "@/lib/validation/errors";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  if (!(await getCurrentUser())) {
    return jsonError("Потрібна авторизація", 401);
  }

  const { id } = await params;
  const product = await getProductById(id);

  if (!product) {
    return jsonError("Товар не знайдено", 404);
  }

  return jsonOk(product);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  // Authorisation first, so an unauthenticated caller learns nothing about the data.
  if (!(await getCurrentUser())) {
    return jsonError("Потрібна авторизація", 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Некоректний запит", 400);
  }

  // Validation before any write: invalid data must never reach the database.
  const parsed = productContentSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Перевірте введені дані", 400, formatFieldErrors(parsed.error));
  }

  const { id } = await params;
  const updated = await updateProductContent(id, parsed.data);

  if (!updated) {
    return jsonError("Товар не знайдено", 404);
  }

  return jsonOk(updated);
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npm test -- tests/api.products.test.ts`
Expected: all tests PASS.

- [ ] **Step 6: Run the full suite and commit**

```bash
npm test
git add -A
git commit -m "Add public and admin product REST endpoints"
```

---

### Task 11: Shared UI primitives and layout

**Files:**
- Create: `src/components/status-badge.tsx`, `src/components/site-header.tsx`, `src/components/field-error.tsx`, `src/components/alert.tsx`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Consumes: `ProductStatusValue` from `@/lib/products/service`
- Produces: `<StatusBadge status />`, `<SiteHeader adminEmail? />`, `<FieldError messages? />`, `<Alert tone="error" | "success">`

- [ ] **Step 1: Create `src/components/status-badge.tsx`**

```tsx
import type { ProductStatusValue } from "@/lib/products/service";

const LABELS: Record<ProductStatusValue, string> = {
  draft: "Чернетка",
  published: "Опубліковано",
};

const STYLES: Record<ProductStatusValue, string> = {
  draft: "bg-amber-100 text-amber-800",
  published: "bg-emerald-100 text-emerald-800",
};

export function StatusBadge({ status }: { status: ProductStatusValue }) {
  return (
    <span
      className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${STYLES[status]}`}
    >
      {LABELS[status]}
    </span>
  );
}
```

- [ ] **Step 2: Create `src/components/alert.tsx` and `src/components/field-error.tsx`**

`alert.tsx`:

```tsx
const TONES = {
  error: "border-red-300 bg-red-50 text-red-800",
  success: "border-emerald-300 bg-emerald-50 text-emerald-800",
} as const;

export function Alert({
  tone,
  children,
}: {
  tone: keyof typeof TONES;
  children: React.ReactNode;
}) {
  return (
    <div role="alert" className={`rounded-md border px-4 py-3 text-sm ${TONES[tone]}`}>
      {children}
    </div>
  );
}
```

`field-error.tsx`:

```tsx
export function FieldError({ messages }: { messages?: string[] }) {
  if (!messages || messages.length === 0) {
    return null;
  }

  return (
    <p className="mt-1 text-sm text-red-700">
      {messages.join(". ")}
    </p>
  );
}
```

- [ ] **Step 3: Create `src/components/site-header.tsx`**

```tsx
import Link from "next/link";

export function SiteHeader({ children }: { children?: React.ReactNode }) {
  return (
    <header className="border-b border-gray-200">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4">
        <Link href="/" className="text-lg font-semibold">
          Product Content Studio
        </Link>
        <div className="flex items-center gap-4 text-sm">{children}</div>
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Verify it builds**

Run: `npm run build && npm run lint`
Expected: both succeed.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add shared UI primitives"
```

---

### Task 12: Public catalog and product page

**Files:**
- Create: `src/app/products/[slug]/page.tsx`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `listPublishedProducts`, `getPublishedProductBySlug`, `SiteHeader`
- Produces: the two public pages; `generateMetadata` driven by the stored SEO fields

- [ ] **Step 1: Replace `src/app/page.tsx` with the catalog**

```tsx
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { listPublishedProducts } from "@/lib/products/service";

export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  const products = await listPublishedProducts();

  return (
    <>
      <SiteHeader>
        <Link href="/admin/products" className="text-blue-700 hover:underline">
          Адмін-панель
        </Link>
      </SiteHeader>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-semibold">Каталог товарів</h1>

        {products.length === 0 ? (
          <p className="text-gray-600">Наразі немає опублікованих товарів.</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <li key={product.id} className="rounded-lg border border-gray-200 p-4">
                <h2 className="mb-2 font-medium">{product.name}</h2>
                <Link
                  href={`/products/${product.slug}`}
                  className="text-sm text-blue-700 hover:underline"
                >
                  Переглянути картку
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
```

`force-dynamic` matters: without it Next would statically cache the catalog and a newly published product would not appear until a rebuild.

- [ ] **Step 2: Create `src/app/products/[slug]/page.tsx`**

`notFound()` produces a real 404 for drafts. The description renders inside `{}`, which React escapes — no `dangerouslySetInnerHTML`, so stored markup can never execute.

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getPublishedProductBySlug } from "@/lib/products/service";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getPublishedProductBySlug(slug);

  if (!product) {
    return { title: "Товар не знайдено" };
  }

  return {
    title: product.seoTitle,
    description: product.seoDescription,
  };
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;
  const product = await getPublishedProductBySlug(slug);

  if (!product) {
    notFound();
  }

  return (
    <>
      <SiteHeader />

      <main className="mx-auto max-w-3xl px-4 py-8">
        <Link href="/" className="text-sm text-blue-700 hover:underline">
          ← До каталогу
        </Link>

        <h1 className="mt-4 mb-6 text-2xl font-semibold">{product.name}</h1>

        <section className="mb-8">
          <h2 className="mb-3 text-lg font-medium">Характеристики</h2>
          <dl className="divide-y divide-gray-200 border-y border-gray-200">
            {product.specs.map((spec) => (
              <div key={spec.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:gap-4">
                <dt className="text-gray-600 sm:w-1/3">{spec.label}</dt>
                <dd className="sm:w-2/3">{spec.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-medium">Опис</h2>
          <p className="whitespace-pre-line leading-relaxed">{product.description}</p>
        </section>
      </main>
    </>
  );
}
```

- [ ] **Step 3: Verify manually**

```bash
npm run dev
```

Check that `http://localhost:3000/` lists exactly two products, that `http://localhost:3000/products/kavomashyna-barista-pro` renders name, specs, and description, that the browser tab title equals the stored `seoTitle`, and that `http://localhost:3000/products/chaynyk-thermo-glass` returns the 404 page. Stop the server afterwards.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "Add public catalog and product card with SEO metadata"
```

---

### Task 13: Admin login page

**Files:**
- Create: `src/app/admin/login/page.tsx`, `src/app/admin/login/login-form.tsx`

**Interfaces:**
- Consumes: `POST /api/auth/login`, `getCurrentUser`
- Produces: `/admin/login`, redirecting to `/admin/products` on success

- [ ] **Step 1: Create `src/app/admin/login/page.tsx`**

```tsx
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guard";
import { SiteHeader } from "@/components/site-header";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getCurrentUser()) {
    redirect("/admin/products");
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-sm px-4 py-12">
        <h1 className="mb-6 text-2xl font-semibold">Вхід в адмін-панель</h1>
        <LoginForm />
      </main>
    </>
  );
}
```

- [ ] **Step 2: Create `src/app/admin/login/login-form.tsx`**

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/alert";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setError(payload?.error?.message ?? "Не вдалося увійти");
        return;
      }

      router.push("/admin/products");
      router.refresh();
    } catch {
      setError("Немає зв'язку з сервером. Спробуйте ще раз.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error ? <Alert tone="error">{error}</Alert> : null}

      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium">
          Електронна пошта
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2"
        />
      </div>

      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium">
          Пароль
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-blue-700 px-4 py-2 text-white disabled:opacity-60"
      >
        {pending ? "Входимо…" : "Увійти"}
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Verify manually**

Run `npm run dev`, open `/admin/login`, submit wrong credentials and confirm the Ukrainian error appears, then submit the seeded credentials and confirm the redirect to `/admin/products` (which 404s until Task 14 — that is expected).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "Add admin login page"
```

---

### Task 14: Admin product list

**Files:**
- Create: `src/app/admin/products/page.tsx`, `src/app/admin/logout-button.tsx`

**Interfaces:**
- Consumes: `getCurrentUser`, `listAllProducts`, `StatusBadge`
- Produces: `/admin/products`, redirecting unauthenticated visitors to `/admin/login`

- [ ] **Step 1: Create `src/app/admin/logout-button.tsx`**

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/admin/login");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="rounded-md border border-gray-300 px-3 py-1.5 disabled:opacity-60"
    >
      {pending ? "Виходимо…" : "Вийти"}
    </button>
  );
}
```

- [ ] **Step 2: Create `src/app/admin/products/page.tsx`**

The list is a table on desktop and stacked cards on mobile, which is the responsive requirement.

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { StatusBadge } from "@/components/status-badge";
import { getCurrentUser } from "@/lib/auth/guard";
import { listAllProducts } from "@/lib/products/service";
import { LogoutButton } from "../logout-button";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/admin/login");
  }

  const products = await listAllProducts();

  return (
    <>
      <SiteHeader>
        <span className="text-gray-600">{user.email}</span>
        <LogoutButton />
      </SiteHeader>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-semibold">Товари</h1>

        <ul className="space-y-3">
          {products.map((product) => (
            <li
              key={product.id}
              className="flex flex-col gap-3 rounded-lg border border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                <span className="font-medium">{product.name}</span>
                <StatusBadge status={product.status} />
              </div>

              <Link
                href={`/admin/products/${product.id}`}
                className="text-sm text-blue-700 hover:underline"
              >
                Редагувати
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
```

- [ ] **Step 3: Verify manually**

With `npm run dev` running: visit `/admin/products` in a private window and confirm the redirect to `/admin/login`; sign in and confirm all three products appear with correct badges; click "Вийти" and confirm the redirect back to login.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "Add admin product list with logout"
```

---

### Task 15: Product editor

**Files:**
- Create: `src/app/admin/products/[id]/page.tsx`, `src/app/admin/products/[id]/editor-form.tsx`

**Interfaces:**
- Consumes: `getProductById`, `PATCH /api/admin/products/:id`, `PRODUCT_LIMITS`, `Alert`, `FieldError`
- Produces: `/admin/products/[id]`

This task carries the requirements most likely to be checked: explicit save, preserved input on failure, per-field limits, and no success state on error.

- [ ] **Step 1: Create `src/app/admin/products/[id]/page.tsx`**

```tsx
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/auth/guard";
import { getProductById } from "@/lib/products/service";
import { LogoutButton } from "../../logout-button";
import { EditorForm } from "./editor-form";

export const dynamic = "force-dynamic";

export default async function EditorPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/admin/login");
  }

  const { id } = await params;
  const product = await getProductById(id);

  if (!product) {
    notFound();
  }

  return (
    <>
      <SiteHeader>
        <span className="text-gray-600">{user.email}</span>
        <LogoutButton />
      </SiteHeader>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <Link href="/admin/products" className="text-sm text-blue-700 hover:underline">
          ← До списку товарів
        </Link>

        <h1 className="mt-4 mb-2 text-2xl font-semibold">{product.name}</h1>
        <p className="mb-6 text-sm text-gray-600">
          Назву та характеристики змінювати не можна.
        </p>

        <section className="mb-8">
          <h2 className="mb-3 text-lg font-medium">Характеристики</h2>
          <dl className="divide-y divide-gray-200 border-y border-gray-200">
            {product.specs.map((spec) => (
              <div key={spec.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:gap-4">
                <dt className="text-gray-600 sm:w-1/3">{spec.label}</dt>
                <dd className="sm:w-2/3">{spec.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <EditorForm product={product} />
      </main>
    </>
  );
}
```

- [ ] **Step 2: Create `src/app/admin/products/[id]/editor-form.tsx`**

Three behaviours to preserve exactly: form state is never overwritten from a failed response; `saved` is set only inside the `response.ok` branch; and any edit clears a stale success banner.

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/alert";
import { FieldError } from "@/components/field-error";
import type { ProductDetail } from "@/lib/products/service";
import { PRODUCT_LIMITS } from "@/lib/validation/product";

type FormState = {
  description: string;
  seoTitle: string;
  seoDescription: string;
  status: "draft" | "published";
};

export function EditorForm({ product }: { product: ProductDetail }) {
  const router = useRouter();

  const initial: FormState = {
    description: product.description,
    seoTitle: product.seoTitle,
    seoDescription: product.seoDescription,
    status: product.status,
  };

  const [form, setForm] = useState<FormState>(initial);
  const [saved, setSaved] = useState<FormState>(initial);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, setPending] = useState(false);

  const isDirty = JSON.stringify(form) !== JSON.stringify(saved);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setSuccess(false);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setFieldErrors({});
    setSuccess(false);

    try {
      const response = await fetch(`/api/admin/products/${product.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        // Deliberately leaves `form` untouched so the user keeps their edits.
        setError(payload?.error?.message ?? "Не вдалося зберегти зміни");
        setFieldErrors(payload?.error?.fieldErrors ?? {});
        return;
      }

      setSaved(form);
      setSuccess(true);
      router.refresh();
    } catch {
      setError("Немає зв'язку з сервером. Зміни не збережено.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error ? <Alert tone="error">{error}</Alert> : null}
      {success ? <Alert tone="success">Зміни збережено</Alert> : null}

      <div>
        <div className="mb-1 flex items-baseline justify-between">
          <label htmlFor="description" className="text-sm font-medium">
            Опис
          </label>
          <span className="text-xs text-gray-500">
            {form.description.length} / {PRODUCT_LIMITS.description}
          </span>
        </div>
        <textarea
          id="description"
          name="description"
          rows={8}
          value={form.description}
          onChange={(event) => update("description", event.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2"
        />
        <FieldError messages={fieldErrors.description} />
      </div>

      <div>
        <div className="mb-1 flex items-baseline justify-between">
          <label htmlFor="seoTitle" className="text-sm font-medium">
            SEO-заголовок
          </label>
          <span className="text-xs text-gray-500">
            {form.seoTitle.length} / {PRODUCT_LIMITS.seoTitle}
          </span>
        </div>
        <input
          id="seoTitle"
          name="seoTitle"
          type="text"
          value={form.seoTitle}
          onChange={(event) => update("seoTitle", event.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2"
        />
        <FieldError messages={fieldErrors.seoTitle} />
      </div>

      <div>
        <div className="mb-1 flex items-baseline justify-between">
          <label htmlFor="seoDescription" className="text-sm font-medium">
            SEO-опис
          </label>
          <span className="text-xs text-gray-500">
            {form.seoDescription.length} / {PRODUCT_LIMITS.seoDescription}
          </span>
        </div>
        <textarea
          id="seoDescription"
          name="seoDescription"
          rows={3}
          value={form.seoDescription}
          onChange={(event) => update("seoDescription", event.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2"
        />
        <FieldError messages={fieldErrors.seoDescription} />
      </div>

      <div>
        <label htmlFor="status" className="mb-1 block text-sm font-medium">
          Статус
        </label>
        <select
          id="status"
          name="status"
          value={form.status}
          onChange={(event) => update("status", event.target.value as FormState["status"])}
          className="w-full rounded-md border border-gray-300 px-3 py-2 sm:w-64"
        >
          <option value="draft">Чернетка</option>
          <option value="published">Опубліковано</option>
        </select>
        <FieldError messages={fieldErrors.status} />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="submit"
          disabled={pending || !isDirty}
          className="rounded-md bg-blue-700 px-5 py-2 text-white disabled:opacity-60"
        >
          {pending ? "Зберігаємо…" : "Зберегти"}
        </button>

        {isDirty ? (
          <span className="text-sm text-amber-700">Є незбережені зміни</span>
        ) : null}
      </div>
    </form>
  );
}
```

- [ ] **Step 3: Verify manually, including the failure path**

With `npm run dev` running and signed in, open a product editor and check:
- the Save button is disabled until something changes;
- "Є незбережені зміни" appears on edit;
- saving shows "Зміни збережено" and survives a page reload;
- pasting 1001 characters into the description and saving shows a field error, **keeps the typed text**, and shows no success banner;
- switching status to "Чернетка" removes the product from `/`.

- [ ] **Step 4: Run the full suite, lint, and build**

```bash
npm test
npm run lint
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add product editor with explicit save and error preservation"
```

---

### Task 16: End-to-end tests

**Files:**
- Create: `playwright.config.ts`, `e2e/global-setup.ts`, `e2e/auth.spec.ts`, `e2e/editor.spec.ts`, `e2e/visibility.spec.ts`
- Modify: `package.json` (scripts)

**Interfaces:**
- Consumes: the running application and the test database
- Produces: `npm run test:e2e`

- [x] **Step 1: Install Playwright**

```bash
npm install --save-exact --save-dev @playwright/test@1.63.0
npx playwright install chromium
```

- [x] **Step 2: Create `e2e/global-setup.ts`**

```ts
import { resetAndSeed } from "../tests/helpers/db";

export default async function globalSetup(): Promise<void> {
  await resetAndSeed();
}
```

- [x] **Step 3: Create `playwright.config.ts`**

The suite runs against a production build, which is what a reviewer would run. `DATABASE_URL` is already swapped to the test database by `scripts/with-test-db.mjs`, and `webServer` inherits it.

```ts
import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "npm run build && npm run start",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 180000,
  },
});
```

The two projects also satisfy the responsive requirement by running every journey at phone width.

- [x] **Step 4: Add the script to `package.json`**

```json
"test:e2e": "node scripts/with-test-db.mjs playwright test"
```

- [x] **Step 5: Write `e2e/auth.spec.ts`**

```ts
import { expect, test } from "@playwright/test";

const EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@studio.local";
const PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "Admin12345!";

test("rejects wrong credentials and grants no access", async ({ page }) => {
  await page.goto("/admin/login");
  await page.getByLabel("Електронна пошта").fill(EMAIL);
  await page.getByLabel("Пароль").fill("definitely-wrong");
  await page.getByRole("button", { name: "Увійти" }).click();

  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/login/);

  await page.goto("/admin/products");
  await expect(page).toHaveURL(/\/admin\/login/);
});

test("signs in, reaches the product list, and signs out", async ({ page }) => {
  await page.goto("/admin/login");
  await page.getByLabel("Електронна пошта").fill(EMAIL);
  await page.getByLabel("Пароль").fill(PASSWORD);
  await page.getByRole("button", { name: "Увійти" }).click();

  await expect(page).toHaveURL(/\/admin\/products/);
  await expect(page.getByText("Кавомашина Barista Pro")).toBeVisible();

  await page.getByRole("button", { name: "Вийти" }).click();
  await expect(page).toHaveURL(/\/admin\/login/);

  await page.goto("/admin/products");
  await expect(page).toHaveURL(/\/admin\/login/);
});

test("admin API is unreachable without a session", async ({ request }) => {
  expect((await request.get("/api/admin/products")).status()).toBe(401);
});
```

- [x] **Step 6: Write `e2e/editor.spec.ts`**

```ts
import { expect, test, type Page } from "@playwright/test";

const EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@studio.local";
const PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "Admin12345!";

async function signIn(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Електронна пошта").fill(EMAIL);
  await page.getByLabel("Пароль").fill(PASSWORD);
  await page.getByRole("button", { name: "Увійти" }).click();
  await expect(page).toHaveURL(/\/admin\/products/);
}

async function openEditor(page: Page, productName: string) {
  await page
    .locator("li")
    .filter({ hasText: productName })
    .getByRole("link", { name: "Редагувати" })
    .click();
}

test("saves edits and they survive a reload", async ({ page }) => {
  await signIn(page);
  await openEditor(page, "Навушники Aura Silent");

  const description = `Оновлений опис ${Date.now()}`;
  await page.getByLabel("Опис").fill(description);
  await page.getByRole("button", { name: "Зберегти" }).click();

  await expect(page.getByText("Зміни збережено")).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Опис")).toHaveValue(description);
});

test("a rejected save keeps the typed text and shows no success", async ({ page }) => {
  await signIn(page);
  await openEditor(page, "Навушники Aura Silent");

  const tooLong = "я".repeat(1001);
  await page.getByLabel("Опис").fill(tooLong);
  await page.getByRole("button", { name: "Зберегти" }).click();

  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByText("Зміни збережено")).toHaveCount(0);
  await expect(page.getByLabel("Опис")).toHaveValue(tooLong);
});

test("the save button stays disabled until something changes", async ({ page }) => {
  await signIn(page);
  await openEditor(page, "Кавомашина Barista Pro");

  await expect(page.getByRole("button", { name: "Зберегти" })).toBeDisabled();
  await page.getByLabel("SEO-заголовок").fill("Новий заголовок");
  await expect(page.getByRole("button", { name: "Зберегти" })).toBeEnabled();
});
```

- [x] **Step 7: Write `e2e/visibility.spec.ts`**

```ts
import { expect, test, type Page } from "@playwright/test";

const EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@studio.local";
const PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "Admin12345!";
const DRAFT_SLUG = "chaynyk-thermo-glass";

async function signIn(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Електронна пошта").fill(EMAIL);
  await page.getByLabel("Пароль").fill(PASSWORD);
  await page.getByRole("button", { name: "Увійти" }).click();
  await expect(page).toHaveURL(/\/admin\/products/);
}

test("a draft is absent from the catalog and 404s by direct URL", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.getByText("Чайник Thermo Glass")).toHaveCount(0);

  expect((await request.get(`/products/${DRAFT_SLUG}`)).status()).toBe(404);
  expect((await request.get(`/api/products/${DRAFT_SLUG}`)).status()).toBe(404);
});

test("unpublishing removes a product from the public site", async ({ page, request }) => {
  await page.goto("/products/kavomashyna-barista-pro");
  await expect(page.getByRole("heading", { name: "Кавомашина Barista Pro" })).toBeVisible();

  await signIn(page);
  await page
    .locator("li")
    .filter({ hasText: "Кавомашина Barista Pro" })
    .getByRole("link", { name: "Редагувати" })
    .click();

  await page.getByLabel("Статус").selectOption("draft");
  await page.getByRole("button", { name: "Зберегти" }).click();
  await expect(page.getByText("Зміни збережено")).toBeVisible();

  await page.goto("/");
  await expect(page.getByText("Кавомашина Barista Pro")).toHaveCount(0);
  expect((await request.get("/products/kavomashyna-barista-pro")).status()).toBe(404);
});

test("the product page title comes from the stored SEO title", async ({ page }) => {
  await page.goto("/products/navushnyky-aura-silent");
  await expect(page).toHaveTitle("Навушники Aura Silent — бездротові з шумозаглушенням");
});

test("stored markup renders as text and never executes", async ({ page }) => {
  const payload = `<img src=x onerror="window.__xss = true"><script>window.__xss = true</script>`;

  await signIn(page);
  await page
    .locator("li")
    .filter({ hasText: "Навушники Aura Silent" })
    .getByRole("link", { name: "Редагувати" })
    .click();

  await page.getByLabel("Опис").fill(`Безпечний опис ${payload}`);
  await page.getByRole("button", { name: "Зберегти" }).click();
  await expect(page.getByText("Зміни збережено")).toBeVisible();

  await page.goto("/products/navushnyky-aura-silent");

  // The payload must be visible as literal text on the page...
  await expect(page.getByText(payload, { exact: false })).toBeVisible();

  // ...and must not have created an element or run any script.
  expect(await page.locator("img[src='x']").count()).toBe(0);
  expect(
    await page.evaluate(() => (window as unknown as { __xss?: boolean }).__xss),
  ).toBeUndefined();
});
```

This test earns its place by actually attempting the injection through the real editor and then asserting on the rendered public page — a test that only counted a marker attribute would pass even if the application were fully vulnerable.

The visibility suite mutates published state, so it must run after the others; `fullyParallel: false` with `workers: 1` and alphabetical file ordering (`auth`, `editor`, `visibility`) guarantees that.

- [x] **Step 8: Run the end-to-end suite**

```bash
npm run test:e2e
```

Expected: all tests pass in both the `desktop` and `mobile` projects. Re-run `npm run db:seed` afterwards if you want the development database repopulated — it is untouched, but the test database is now in a mutated state, which `globalSetup` resets on the next run.

- [x] **Step 9: Commit**

```bash
git add -A
git commit -m "Add Playwright end-to-end suites for auth, editing and visibility"
```

---

### Task 17: Documentation and final verification

**Files:**
- Create: `README.md`, `AI-WORKLOG.md`

**Interfaces:**
- Consumes: the finished application
- Produces: the two required documents

- [x] **Step 1: Run every check and record the real output**

```bash
npm run lint
npm run format:check
npx tsc --noEmit
npm test
npm run test:e2e
npm run build
```

Copy the actual pass/fail counts — the README must report real results, not aspirational ones.

- [x] **Step 2: Write `README.md`**

It must cover, in Ukrainian or English consistently: prerequisites (Node 22+, PostgreSQL 18); the two `CREATE DATABASE` commands and the role creation; copying `.env.example` to `.env`; `npm install`; `npm run db:generate`; `npm run db:migrate`; `npm run db:seed`; `npm run db:test:deploy`; `npm run dev`; the admin URL and the seeded credentials; `npm test` and `npm run test:e2e`; the technical decisions and why (framework, session-over-JWT, two databases, argon2id, token hashing, 404-not-403); the testing strategy and why two levels; the actual verification results from Step 1; known limitations; and the real time spent.

- [x] **Step 3: Write `AI-WORKLOG.md`**

It must contain the tools and models used and their concrete contribution versus your own; **2–3 specific decisions** about AI-generated code, each naming what was proposed, what you chose, why, and how it was verified, with a link to the relevant commit; and an assessment of the role the automated tests played in checking AI output, including how you judged the quality of AI-written tests. Candidate examples worth writing up: storing the SHA-256 of the session token rather than the token; returning 404 rather than 403 for drafts; keeping form state on a failed save; pinning `prisma` to 7.10.0 because the `latest` tag is a release candidate.

- [ ] **Step 4: Final commit and push**

```bash
git add -A
git commit -m "Add README and AI development worklog"
git push origin main
```

- [ ] **Step 5: Verify the repository is clean**

```bash
git status
git ls-files | grep -E "^\.env$" && echo "FAIL: .env is tracked" || echo "OK: .env is not tracked"
```

Expected: a clean working tree and `OK: .env is not tracked`.

---

## Requirement Traceability

| Requirement | Task |
|---|---|
| Admin can log in and out | 9, 13, 14 |
| Admin data unreachable without auth | 10, 16 |
| Secrets absent from client code and repo | 2, 8, 17 |
| List shows name and status, opens editor | 14 |
| Description, SEO fields, status editable | 15 |
| Name and specs read-only | 7, 10, 15 |
| 1000 / 60 / 160 limits, non-empty | 5, 10, 15 |
| Invalid data rejected including via direct API | 10 |
| Saved only on explicit action, persists | 15, 16 |
| Status governs public availability | 7, 12, 16 |
| Responsive desktop and mobile | 11, 12, 14, 15, 16 |
| Failed save preserves edits, no false success | 15, 16 |
| Catalog lists only published products | 12, 16 |
| Card shows name, specs, description | 12 |
| SEO fields drive page title and description | 12, 16 |
| Draft unreachable by URL and public API | 10, 12, 16 |
| Content cannot execute as script | 1, 12, 16 |
| Tests cover key logic and critical paths | 4–10, 16 |
| Tests reproducible without external services | 2, 4, 16 |
| README and AI-WORKLOG | 17 |
