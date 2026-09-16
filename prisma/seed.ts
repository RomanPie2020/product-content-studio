import "dotenv/config";
import { fileURLToPath } from "node:url";
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
    const specsWithPosition = specs.map((spec, position) => ({ ...spec, position }));
    await prisma.product.upsert({
      where: { slug: product.slug },
      update: fields,
      create: { ...fields, specs: { create: specsWithPosition } },
    });
  }
}

async function main() {
  await seedDatabase();
  const [users, products] = await Promise.all([prisma.user.count(), prisma.product.count()]);
  console.log(`Seeded ${users} user(s) and ${products} product(s).`);
}

// Only run as a script (`prisma db seed`, `tsx prisma/seed.ts`). Other modules import
// `seedDatabase` directly (e.g. the Vitest harness), and must not trigger this as a
// side effect of that import.
const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

if (isMainModule) {
  main()
    .catch((error) => {
      console.error(error);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
