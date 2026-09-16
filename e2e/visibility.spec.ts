import { expect, test, type Page } from "@playwright/test";
import { resetAndSeed } from "../tests/helpers/db";

const EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@studio.local";
const PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "Admin12345!";
const DRAFT_SLUG = "chaynyk-thermo-glass";

// This suite mutates publication state (unpublishing a product). `globalSetup` seeds the
// database only once for the whole run, but the desktop and mobile projects both execute this
// file against that same database, so the second project would otherwise see state left over
// by the first. Reseed here so each project run starts from the same known state.
test.beforeAll(async () => {
  await resetAndSeed();
});

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

  await page.getByLabel("Опис", { exact: true }).fill(`Безпечний опис ${payload}`);
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
