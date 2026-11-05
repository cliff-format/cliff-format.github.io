// Print document offsets for layout landmarks.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const playwrightPath =
  process.env.PLAYWRIGHT_PATH ??
  "D:/Projects/cliff-format/cliff-js/node_modules/.pnpm/playwright@1.64.1/node_modules/playwright";
const { chromium } = require(playwrightPath);

const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
await page.goto(`http://127.0.0.1:${process.env.PORT ?? 4174}/?t=dark&static=1`, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(300);
const boxes = await page.evaluate(() => {
  const selectors = [".hero", ".hero-visual", ".code-card", ".metrics", ".features", ".lifecycle", ".cta", ".site-foot", ".feature", ".step-grid", ".metric-grid"];
  const out = {};
  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    out[selector] = [Math.round(r.top + scrollY), Math.round(r.height)];
  }
  out.total = document.body.scrollHeight;
  return out;
});
console.log(JSON.stringify(boxes, null, 1));
await browser.close();
