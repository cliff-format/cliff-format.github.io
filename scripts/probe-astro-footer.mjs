// Measure the reference footer on astro.build at a 1440 viewport.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const playwrightPath =
  process.env.PLAYWRIGHT_PATH ??
  "D:/Projects/cliff-format/cliff-js/node_modules/.pnpm/playwright@1.64.1/node_modules/playwright";
const { chromium } = require(playwrightPath);

const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
await page.goto("https://astro.build/", { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(2500);
const footer = page.locator("footer").first();
await footer.scrollIntoViewIfNeeded();
await page.waitForTimeout(800);

const info = await page.evaluate(() => {
  const footer = document.querySelector("footer");
  if (!footer) return { error: "no footer" };
  const nav = footer.querySelector("nav");
  const heading = footer.querySelector("nav section h2");
  const link = footer.querySelector("nav section ul a");
  const legal = footer.querySelectorAll("nav")[1];
  const cs = (el) => {
    if (!el) return null;
    const s = getComputedStyle(el);
    return {
      fontSize: s.fontSize,
      fontWeight: s.fontWeight,
      lineHeight: s.lineHeight,
      letterSpacing: s.letterSpacing,
      textTransform: s.textTransform,
      color: s.color,
      paddingTop: s.paddingTop,
      paddingBottom: s.paddingBottom,
      gap: s.gap,
      marginBottom: s.marginBottom,
    };
  };
  const sections = [...footer.querySelectorAll("nav section")];
  const rows = sections.length
    ? [...sections[0].querySelectorAll("li")].slice(0, 3).map((li) => Math.round(li.getBoundingClientRect().height))
    : [];
  return {
    footerHeight: Math.round(footer.getBoundingClientRect().height),
    footerWidth: Math.round(footer.getBoundingClientRect().width),
    nav: cs(nav),
    heading: cs(heading),
    link: cs(link),
    legal: cs(legal),
    linkRowHeights: rows,
    containerWidth: Math.round(footer.querySelector("div").getBoundingClientRect().width),
  };
});
console.log(JSON.stringify(info, null, 1));
await footer.screenshot({ path: "shots/astro-footer-1440.png" });
await browser.close();
