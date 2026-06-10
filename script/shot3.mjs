import { chromium } from "playwright";
import fs from "node:fs";
const BASE = "http://localhost:5173";
const vid = fs.readFileSync("/tmp/vwith.txt", "utf8").trim();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await page.goto(BASE, { waitUntil: "networkidle" });
await page.fill('input[type="email"]', "provider@ue.demo");
await page.fill('input[type="password"]', "demo1234");
await page.click('button[type="submit"]');
await page.waitForTimeout(1000);
await page.goto(`${BASE}/visits/${vid}`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
const analyze = page.getByRole("button", { name: "Analyze" });
if (await analyze.count()) { await analyze.click(); await page.waitForTimeout(1000); }
await page.screenshot({ path: "/tmp/ueos-10-workspace-ai.png" });

// Open Quick Look from the radiograph sequence and toggle compare.
await page.goto(`${BASE}/patients/11`, { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
const tile = page.locator("main button img").first();
if (await tile.count()) {
  await tile.click();
  await page.waitForTimeout(700);
  const cmp = page.getByRole("button", { name: /Compare|Side by side/ });
  if (await cmp.count()) { await cmp.click(); await page.waitForTimeout(700); await page.screenshot({ path: "/tmp/ueos-11-compare.png" }); }
}
await browser.close();
console.log("done");
