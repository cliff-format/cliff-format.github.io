// Capture a 2x region by CSS selector.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const playwrightPath =
  process.env.PLAYWRIGHT_PATH ??
  "D:/Projects/cliff-format/cliff-js/node_modules/.pnpm/playwright@1.64.1/node_modules/playwright";
const { chromium } = require(playwrightPath);

const [selector = "body", output = "shots/region.png"] = process.argv.slice(2);
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await page.goto(`http://127.0.0.1:${process.env.PORT ?? 4174}/?t=${process.env.THEME ?? "dark"}&static=1`, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
const element = page.locator(selector).first();
await element.scrollIntoViewIfNeeded();
await page.waitForTimeout(250);
await element.screenshot({ path: output });
await browser.close();
