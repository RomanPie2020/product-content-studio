import { expect, test, type Page } from "@playwright/test";

const EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@studio.local";
const PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "Admin12345!";

async function signIn(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Електронна пошта").fill(EMAIL);
  await page.getByLabel("Пароль").fill(PASSWORD);
  await page.getByRole("button", { name: "Увійти" }).click();
  await expect(page).toHaveURL(/\/admin\/products/);
}

async function openEditor(page: Page, productName: string) {
  await page
    .locator("li")
    .filter({ hasText: productName })
    .getByRole("link", { name: "Редагувати" })
    .click();
}

test("saves edits and they survive a reload", async ({ page }) => {
  await signIn(page);
  await openEditor(page, "Навушники Aura Silent");

  const description = `Оновлений опис ${Date.now()}`;
  await page.getByLabel("Опис", { exact: true }).fill(description);
  await page.getByRole("button", { name: "Зберегти" }).click();

  await expect(page.getByText("Зміни збережено")).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Опис", { exact: true })).toHaveValue(description);
});

test("a rejected save keeps the typed text and shows no success", async ({ page }) => {
  await signIn(page);
  await openEditor(page, "Навушники Aura Silent");

  const tooLong = "я".repeat(1001);
  await page.getByLabel("Опис", { exact: true }).fill(tooLong);
  await page.getByRole("button", { name: "Зберегти" }).click();

  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByText("Зміни збережено")).toHaveCount(0);
  await expect(page.getByLabel("Опис", { exact: true })).toHaveValue(tooLong);
});

test("the save button stays disabled until something changes", async ({ page }) => {
  await signIn(page);
  await openEditor(page, "Кавомашина Barista Pro");

  await expect(page.getByRole("button", { name: "Зберегти" })).toBeDisabled();
  await page.getByLabel("SEO-заголовок").fill("Новий заголовок");
  await expect(page.getByRole("button", { name: "Зберегти" })).toBeEnabled();
});
