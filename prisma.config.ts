import "dotenv/config";
import { defineConfig } from "prisma/config";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env and fill it in.");
}

// The `pcs_app` role has no CREATEDB privilege, so `migrate dev` cannot spin up its own
// throwaway shadow database. Reuse the already-provisioned test database as the shadow
// database instead; `migrate dev` only needs it to be empty, and it clears the schema
// itself. This only applies when migrating the main database — `db:test:deploy` swaps
// DATABASE_URL to TEST_DATABASE_URL and runs plain `migrate deploy`, which never touches
// the shadow-db codepath, so guard against pointing the shadow db at itself.
const shadowDatabaseUrl =
  process.env.TEST_DATABASE_URL && process.env.TEST_DATABASE_URL !== connectionString
    ? process.env.TEST_DATABASE_URL
    : undefined;

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: connectionString,
    shadowDatabaseUrl,
  },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
