// Check horizontal overflow and footer geometry across viewports.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const playwrightPath =
  process.env.PLAYWRIGHT_PATH ??
  "D:/Projects/cliff-format/cliff-js/node_modules/.pnpm/playwright@1.64.1/node_modules/playwright";
const { chromium } = require(playwrightPath);

const browser = await chromium.launch({ channel: "msedge", headless: true });
const widths = [390, 768, 1024, 1280, 1440, 1920];
const rows = [];
for (const width of widths) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${process.env.PORT ?? 4174}/?t=dark&static=1`, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  const row = await page.evaluate(() => {
    const footer = document.querySelector("footer");
    return {
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth,
      footerHeight: Math.round(footer.getBoundingClientRect().height),
      footerLeft: Math.round(footer.querySelector(".wrap").getBoundingClientRect().left),
    };
  });
  rows.push({ width, ...row, errors });
  await page.close();
}
console.log(JSON.stringify(rows, null, 1));
await browser.close();
