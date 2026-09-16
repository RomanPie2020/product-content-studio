import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { SESSION_TTL_MS, createSession, revokeSession, validateSession } from "@/lib/auth/session";
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
