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
const { GET: adminGet, PATCH: adminPatch } = await import("@/app/api/admin/products/[id]/route");
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
