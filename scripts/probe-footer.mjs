// Measure the site footer with the same metrics used on astro.build.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const playwrightPath =
  process.env.PLAYWRIGHT_PATH ??
  "D:/Projects/cliff-format/cliff-js/node_modules/.pnpm/playwright@1.64.1/node_modules/playwright";
const { chromium } = require(playwrightPath);

const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await page.goto(`http://127.0.0.1:${process.env.PORT ?? 4174}/?t=dark&static=1`, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
const info = await page.evaluate(() => {
  const footer = document.querySelector("footer");
  const nav = footer?.querySelector("nav");
  const heading = footer?.querySelector(".foot-col-title");
  const link = footer?.querySelector("section ul a");
  const cs = (el) => {
    if (!el) return null;
    const s = getComputedStyle(el);
    return {
      fontSize: s.fontSize,
      fontWeight: s.fontWeight,
      lineHeight: s.lineHeight,
      paddingTop: s.paddingTop,
      paddingBottom: s.paddingBottom,
      gap: s.gap,
    };
  };
  return {
    footerHeight: Math.round(footer.getBoundingClientRect().height),
    nav: cs(nav),
    heading: cs(heading),
    link: cs(link),
    container: Math.round(footer.querySelector("div").getBoundingClientRect().width),
    sectionTop: Math.round(document.querySelector(".cta").getBoundingClientRect().left),
    footerLeft: Math.round(footer.querySelector("nav").getBoundingClientRect().left),
  };
});
console.log(JSON.stringify(info, null, 1));
await browser.close();
