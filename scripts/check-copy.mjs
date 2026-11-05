// Exercise the footer copy button and report state changes.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const playwrightPath =
  process.env.PLAYWRIGHT_PATH ??
  "D:/Projects/cliff-format/cliff-js/node_modules/.pnpm/playwright@1.64.1/node_modules/playwright";
const { chromium } = require(playwrightPath);

const browser = await chromium.launch({ channel: "msedge", headless: true });
const context = await browser.newContext({ permissions: ["clipboard-read", "clipboard-write"] });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
await page.goto(`http://127.0.0.1:${process.env.PORT ?? 4174}/?static=1`, { waitUntil: "networkidle" });
const button = page.locator("[data-copy]");
await button.scrollIntoViewIfNeeded();
await button.click();
await page.waitForTimeout(150);
const state = await button.evaluate((el) => el.dataset.copied ?? null);
const clip = await page.evaluate(() => navigator.clipboard.readText());
console.log(JSON.stringify({ copied: state, clipboard: clip, errors }));
await browser.close();
