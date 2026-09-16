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
