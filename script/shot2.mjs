import { chromium } from "playwright";
const BASE = "http://localhost:5173";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await page.goto(BASE, { waitUntil: "networkidle" });
await page.fill('input[type="email"]', "provider@ue.demo");
await page.fill('input[type="password"]', "demo1234");
await page.click('button[type="submit"]');
await page.waitForTimeout(1000);
await page.goto(`${BASE}/clinical`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await page.screenshot({ path: "/tmp/ueos-07-clinical.png" });
await page.goto(`${BASE}/visits/155`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await page.screenshot({ path: "/tmp/ueos-08-workspace.png" });
// trigger analyze for the pin overlay
const analyzeBtn = page.getByRole("button", { name: "Analyze" });
if (await analyzeBtn.count()) { await analyzeBtn.click(); await page.waitForTimeout(900); await page.screenshot({ path: "/tmp/ueos-09-analysis.png" }); }
await browser.close();
console.log("done");
