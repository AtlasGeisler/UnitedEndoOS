import { test, expect, type Page } from "@playwright/test";

// Smoke tests for the six phase checkpoint flows, end to end through the UI.

async function login(page: Page, email = "provider@ue.demo") {
  await page.goto("/");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await expect(page.getByText("Good morning", { exact: true })).toBeVisible({ timeout: 15000 });
}

test("Phase 0, sign in and the command palette", async ({ page }) => {
  await login(page);
  // The morning huddle is the landing.
  await expect(page.getByText("Huddle brief")).toBeVisible();
  // Open the command palette and jump to Patients.
  await page.keyboard.press("Meta+k");
  await expect(page.getByPlaceholder(/Jump to a module/)).toBeVisible();
  await page.getByPlaceholder(/Jump to a module/).fill("Patients");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Patients" })).toBeVisible();
});

test("Phase 1, the image-first chart and Quick Look", async ({ page }) => {
  await login(page);
  await page.goto("/patients");
  await page.locator("table tbody tr:first-child a").click();
  // The chart shows the images badge and the imaging grid.
  await expect(page.getByText(/images/).first()).toBeVisible();
  const tile = page.locator("main button img").first();
  await tile.click();
  // Quick Look opens with its control bar.
  await expect(page.getByText(/of/).first()).toBeVisible();
  await page.keyboard.press("Escape");
});

test("Phase 2, the visit workspace cockpit", async ({ page }) => {
  await login(page);
  await page.goto("/clinical");
  const row = page.locator("a[href^='/visits/']").first();
  await row.click();
  await expect(page.getByText("Canal documentation")).toBeVisible();
  await expect(page.getByText("Radiograph sequence")).toBeVisible();
});

test("Phase 3, the schedule with emergency holds", async ({ page }) => {
  await login(page, "manager@ue.demo");
  await page.goto("/schedule");
  await expect(page.getByText("Op 1")).toBeVisible();
  await expect(page.getByRole("button", { name: /Release slots/ })).toBeVisible();
});

test("Phase 4, the referrals pipeline and the portal", async ({ page }) => {
  await login(page, "manager@ue.demo");
  await page.goto("/referrals");
  await expect(page.getByText("Received")).toBeVisible();
  await expect(page.getByText("Closed")).toBeVisible();
});

test("Phase 5, billing and the kiosk", async ({ page }) => {
  await login(page, "manager@ue.demo");
  await page.goto("/billing");
  await expect(page.getByRole("heading", { name: "Billing" })).toBeVisible();
  // The kiosk is public.
  await page.goto("/kiosk");
  await expect(page.getByText("Check in for your appointment")).toBeVisible();
});

test("Phase 6, analytics and the admin AI audit log", async ({ page }) => {
  await login(page, "manager@ue.demo");
  await page.goto("/analytics");
  await expect(page.getByText(/Revenue, last six months/)).toBeVisible();
  await page.goto("/admin");
  await expect(page.getByText(/PHI redacted/).first()).toBeVisible();
});
