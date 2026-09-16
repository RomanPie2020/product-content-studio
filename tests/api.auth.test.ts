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
