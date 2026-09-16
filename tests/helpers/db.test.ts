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
