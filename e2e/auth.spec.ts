import { expect, test } from "@playwright/test";

const EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@studio.local";
const PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "Admin12345!";

test("rejects wrong credentials and grants no access", async ({ page }) => {
  await page.goto("/admin/login");
  await page.getByLabel("Електронна пошта").fill(EMAIL);
  await page.getByLabel("Пароль").fill("definitely-wrong");
  await page.getByRole("button", { name: "Увійти" }).click();

  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/login/);

  await page.goto("/admin/products");
  await expect(page).toHaveURL(/\/admin\/login/);
});

test("signs in, reaches the product list, and signs out", async ({ page }) => {
  await page.goto("/admin/login");
  await page.getByLabel("Електронна пошта").fill(EMAIL);
  await page.getByLabel("Пароль").fill(PASSWORD);
  await page.getByRole("button", { name: "Увійти" }).click();

  await expect(page).toHaveURL(/\/admin\/products/);
  await expect(page.getByText("Кавомашина Barista Pro")).toBeVisible();

  await page.getByRole("button", { name: "Вийти" }).click();
  await expect(page).toHaveURL(/\/admin\/login/);

  await page.goto("/admin/products");
  await expect(page).toHaveURL(/\/admin\/login/);
});

test("admin API is unreachable without a session", async ({ request }) => {
  expect((await request.get("/api/admin/products")).status()).toBe(401);
});
