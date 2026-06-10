import { chromium } from "playwright";
const BASE = "http://localhost:5173";
const TOKEN = "gp_8_1474f7c6018eaf28";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });

// Portal is public, capture first.
await page.goto(`${BASE}/portal?token=${TOKEN}`, { waitUntil: "networkidle" });
await page.waitForTimeout(900);
await page.screenshot({ path: "/tmp/ueos-15-portal.png" });

// App pages.
await page.goto(BASE, { waitUntil: "networkidle" });
await page.fill('input[type="email"]', "manager@ue.demo");
await page.fill('input[type="password"]', "demo1234");
await page.click('button[type="submit"]');
await page.waitForTimeout(1000);
await page.goto(`${BASE}/referrals`, { waitUntil: "networkidle" });
await page.waitForTimeout(900);
await page.screenshot({ path: "/tmp/ueos-16-referrals.png" });
await page.goto(`${BASE}/referring-doctors`, { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
await page.screenshot({ path: "/tmp/ueos-17-crm.png" });
// Plans: pick a patient.
await page.goto(`${BASE}/plans`, { waitUntil: "networkidle" });
await page.fill('input[placeholder*="Find a patient"]', "Ab");
await page.waitForTimeout(900);
const first = page.locator("button:has-text(',')").first();
if (await first.count()) { await first.click(); await page.waitForTimeout(700); }
await page.screenshot({ path: "/tmp/ueos-18-plans.png" });
await browser.close();
console.log("done");
