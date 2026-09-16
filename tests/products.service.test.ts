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
