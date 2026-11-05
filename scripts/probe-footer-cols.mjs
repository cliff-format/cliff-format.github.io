import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const playwrightPath =
  process.env.PLAYWRIGHT_PATH ??
  "D:/Projects/cliff-format/cliff-js/node_modules/.pnpm/playwright@1.64.1/node_modules/playwright";
const { chromium } = require(playwrightPath);
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(`http://127.0.0.1:${process.env.PORT ?? 4174}/?t=dark&static=1`, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
const info = await page.evaluate(() => {
  const nav = document.querySelector("footer nav");
  const grid = nav.lastElementChild;
  const sections = [...grid.children];
  const r = (el) => {
    const b = el.getBoundingClientRect();
    return [Math.round(b.left), Math.round(b.right), Math.round(b.width)];
  };
  return {
    nav: r(nav),
    grid: r(grid),
    cols: sections.map((s) => r(s)),
    firstLink: r(sections[3].querySelector("a")),
    wrap: r(document.querySelector("footer .wrap")),
  };
});
console.log(JSON.stringify(info, null, 1));
await browser.close();
