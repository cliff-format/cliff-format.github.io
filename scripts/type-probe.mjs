// Report computed type for specific landmarks.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const playwrightPath =
  process.env.PLAYWRIGHT_PATH ??
  "D:/Projects/cliff-format/cliff-js/node_modules/.pnpm/playwright@1.64.1/node_modules/playwright";
const { chromium } = require(playwrightPath);

const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${process.env.PORT ?? 4174}/?t=dark&static=1`, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
const result = await page.evaluate(() => {
  const pick = (selector) => {
    const el = document.querySelector(selector);
    if (!el) return selector + " MISSING";
    const s = getComputedStyle(el);
    return `${s.fontSize} / ${s.fontWeight} / ${s.fontFamily.split(",")[0]}`;
  };
  return {
    "footer col title": pick(".foot-col-title"),
    "footer col link": pick("footer section ul li a"),
    "footer lead": pick("footer nav > div > p"),
    "hero h1": pick("h1"),
    "hero lede": pick(".lede"),
    "feature h3": pick(".feature h3"),
    "feature p": pick(".feature p"),
    "nav link": pick(".site-nav a"),
    "btn": pick(".btn"),
    "m-v": pick(".m-v"),
  };
});
console.log(JSON.stringify(result, null, 1));
await browser.close();
