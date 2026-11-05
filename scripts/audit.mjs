// Audit the type system and layout of a rendered page.
//
// Reports every distinct font size, weight, and family used, the type applied to
// named roles, any element that overflows the viewport, and the layout offsets of
// the page landmarks. Run it against the dev or preview server:
//
//   node scripts/audit.mjs [url]
//
// Add ?t=light to audit the light theme, ?static=1 to disable motion.
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const playwrightPath =
  process.env.PLAYWRIGHT_PATH ??
  "D:/Projects/cliff-format/cliff-js/node_modules/.pnpm/playwright@1.64.1/node_modules/playwright";
const { chromium } = require(playwrightPath);

const url = process.argv[2] ?? `http://127.0.0.1:${process.env.PORT ?? 4321}/?t=dark&static=1`;

const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (error) => errors.push(String(error)));
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});
await page.goto(url, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(300);

const report = await page.evaluate(() => {
  const visible = (el) => {
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden";
  };
  const own = (el) =>
    [...el.childNodes].some((node) => node.nodeType === 3 && node.textContent.trim().length > 0);

  const sizes = new Map();
  const weights = new Map();
  const families = new Map();
  for (const el of document.querySelectorAll("body *")) {
    if (!visible(el) || !own(el)) continue;
    const style = getComputedStyle(el);
    const key = `${style.fontSize} / ${style.lineHeight}`;
    sizes.set(key, (sizes.get(key) ?? 0) + 1);
    weights.set(style.fontWeight, (weights.get(style.fontWeight) ?? 0) + 1);
    const family = style.fontFamily.split(",")[0].replace(/["']/g, "").trim();
    families.set(family, (families.get(family) ?? 0) + 1);
  }

  const roles = [
    ["h1", ".hero-title"],
    ["h2", ".section-head h2"],
    ["lede", ".lede"],
    ["section lede", ".section-lede"],
    ["body copy", ".feature p"],
    ["card title", ".feature h3"],
    ["nav", ".site-nav a"],
    ["button", ".btn"],
    ["meta", ".proof"],
    ["stat", ".m-v"],
    ["code", ".code-body code"],
    ["footer link", ".foot-col a"],
  ].map(([name, selector]) => {
    const el = document.querySelector(selector);
    if (!el) return [name, "missing"];
    const style = getComputedStyle(el);
    return [
      name,
      `${style.fontSize} ${style.fontWeight} ${style.fontFamily.split(",")[0]} lh ${style.lineHeight}`,
    ];
  });

  const overflow = [...document.querySelectorAll("body *")]
    .filter((el) => {
      const rect = el.getBoundingClientRect();
      return rect.right > innerWidth + 1 || rect.left < -1;
    })
    .slice(0, 8)
    .map((el) => `${el.tagName.toLowerCase()}.${[...el.classList].join(".")} @ ${Math.round(el.getBoundingClientRect().left)}–${Math.round(el.getBoundingClientRect().right)}`);

  const landmarks = {};
  for (const selector of [".site-head", ".hero", ".code-card", ".metrics", ".features", ".lifecycle", ".cta", ".site-foot"]) {
    const el = document.querySelector(selector);
    if (el) {
      const rect = el.getBoundingClientRect();
      landmarks[selector] = [Math.round(rect.top + scrollY), Math.round(rect.height)];
    }
  }

  return {
    sizes: [...sizes.entries()].sort(),
    weights: [...weights.entries()],
    families: [...families.entries()],
    roles,
    overflow,
    landmarks,
    height: document.body.scrollHeight,
    width: document.documentElement.scrollWidth,
  };
});

console.log(JSON.stringify({ errors, ...report }, null, 1));
await browser.close();
