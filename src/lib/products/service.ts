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
