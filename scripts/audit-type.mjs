// Report visible text whose computed font-size falls below the site floor.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const playwrightPath =
  process.env.PLAYWRIGHT_PATH ??
  "D:/Projects/cliff-format/cliff-js/node_modules/.pnpm/playwright@1.64.1/node_modules/playwright";
const { chromium } = require(playwrightPath);

const floor = Number(process.env.FLOOR ?? 12);
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await page.goto(`http://127.0.0.1:${process.env.PORT ?? 4174}/?t=dark&static=1`, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
const small = await page.evaluate((floor) => {
  const out = new Map();
  for (const el of document.querySelectorAll("body *")) {
    const box = el.getBoundingClientRect();
    if (!box.width || !box.height) continue;
    const text = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!text) continue;
    const size = parseFloat(getComputedStyle(el).fontSize);
    if (size >= floor) continue;
    const key = `${el.tagName.toLowerCase()}.${el.className.toString().slice(0, 60)} @ ${size}px`;
    out.set(key, (out.get(key) ?? 0) + 1);
  }
  return [...out.entries()];
}, floor);
console.log(JSON.stringify({ floor, violations: small }, null, 1));
await browser.close();
