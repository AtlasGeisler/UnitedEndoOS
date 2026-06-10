import { chromium } from "playwright";

// Captures a few screenshots so the Mac-native UI can be eyeballed: the login
// card, the patient directory, and the image-first patient chart in both light
// and dark mode.
const BASE = process.env.BASE ?? "http://localhost:5173";
const OUT = process.env.OUT ?? "/tmp";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();

await page.goto(BASE, { waitUntil: "networkidle" });
await page.screenshot({ path: `${OUT}/ueos-01-login.png` });

await page.fill('input[type="email"]', "provider@ue.demo");
await page.fill('input[type="password"]', "demo1234");
await page.click('button[type="submit"]');
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}/ueos-02-today.png` });

await page.goto(`${BASE}/patients`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/ueos-03-patients.png` });

// Open the first patient row.
await page.click("table tbody tr:first-child a");
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/ueos-04-chart.png` });

// Open Quick Look on the first image tile.
const tile = page.locator("main button img").first();
if (await tile.count()) {
  await tile.click();
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/ueos-05-quicklook.png` });
  await page.keyboard.press("Escape");
}

// Tooth chart tab.
await page.getByRole("button", { name: "Tooth Chart" }).click();
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/ueos-06-toothchart.png` });

await browser.close();
console.log("screenshots written to", OUT);
