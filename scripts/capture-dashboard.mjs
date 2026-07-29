import { chromium } from "playwright";

const BASE = process.env.APP_URL ?? "http://localhost:3000";
const EMAIL = process.env.TEST_EMAIL ?? "opt-test-20260725180842@mail.test";
const PASSWORD = process.env.TEST_PASSWORD ?? "TestPass123!";
const OUT = process.env.SCREENSHOT_OUT ?? "dashboard-screenshot.png";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 60_000 });
  await page.fill("#email", EMAIL);
  await page.fill("#password", PASSWORD);
  await Promise.all([
    page.waitForURL("**/dashboard", { timeout: 30_000 }),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForSelector("text=Your library", { timeout: 30_000 }).catch(() =>
    page.waitForSelector("text=Library", { timeout: 10_000 }),
  );
  await page.waitForTimeout(1500);
  await page.screenshot({ path: OUT, fullPage: true });
  console.log(`Saved ${OUT} at ${page.url()}`);
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
