// Crop a 2x view of the footer columns to inspect weight contrast.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const playwrightPath =
  process.env.PLAYWRIGHT_PATH ??
  "D:/Projects/cliff-format/cliff-js/node_modules/.pnpm/playwright@1.64.1/node_modules/playwright";
const { chromium } = require(playwrightPath);

const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await page.goto(`http://127.0.0.1:${process.env.PORT ?? 4174}/?t=dark&static=1`, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
const columns = page.locator("footer nav").first();
await columns.scrollIntoViewIfNeeded();
await page.waitForTimeout(300);
const box = await columns.boundingBox();
await page.screenshot({
  path: "shots/footer-2x.png",
  clip: { x: 780, y: box.y - 20, width: 560, height: 300 },
});
const weights = await page.evaluate(() => {
  const pick = (selector) => {
    const el = document.querySelector(selector);
    return el ? { size: getComputedStyle(el).fontSize, weight: getComputedStyle(el).fontWeight, family: getComputedStyle(el).fontFamily.slice(0, 40) } : null;
  };
  return {
    title: pick(".foot-col-title"),
    link: pick("footer nav a"),
    heading: pick("footer p"),
  };
});
console.log(JSON.stringify(weights));
await browser.close();
