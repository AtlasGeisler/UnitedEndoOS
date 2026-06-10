import { chromium } from "playwright";
import fs from "node:fs";
const BASE = "http://localhost:5173";
const PTOK = fs.readFileSync("/tmp/ptok2.txt", "utf8").trim().replace("PTOK=", "");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });

await page.goto(`${BASE}/kiosk`, { waitUntil: "networkidle" });
await page.waitForTimeout(700);
await page.screenshot({ path: "/tmp/ueos-19-kiosk.png" });

await page.goto(`${BASE}/my?token=${PTOK}`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await page.screenshot({ path: "/tmp/ueos-20-patientportal.png" });

await page.goto(BASE, { waitUntil: "networkidle" });
await page.fill('input[type="email"]', "manager@ue.demo");
await page.fill('input[type="password"]', "demo1234");
await page.click('button[type="submit"]');
await page.waitForTimeout(1000);
await page.goto(`${BASE}/billing`, { waitUntil: "networkidle" });
await page.waitForTimeout(900);
await page.screenshot({ path: "/tmp/ueos-21-billing.png" });
await page.goto(`${BASE}/messages`, { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
await page.screenshot({ path: "/tmp/ueos-22-messages.png" });
await browser.close();
console.log("done");
