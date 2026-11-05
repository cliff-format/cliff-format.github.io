// Capture a page of the built site with the local Edge channel.
// Usage: node scripts/capture.mjs <route> <output> [width] [height] [full] [scale]
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const playwrightPath =
  process.env.PLAYWRIGHT_PATH ??
  "D:/Projects/cliff-format/cliff-js/node_modules/.pnpm/playwright@1.64.1/node_modules/playwright";
const { chromium } = require(playwrightPath);

const [route = "/", output = "shot.png", width = "1440", height = "900", full = "0", scale = "1"] =
  process.argv.slice(2);

const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({
  viewport: { width: Number(width), height: Number(height) },
  deviceScaleFactor: Number(scale),
});

const errors = [];
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});
page.on("pageerror", (error) => errors.push(`PAGEERROR ${error.message}`));

await page.goto(`http://127.0.0.1:${process.env.PORT ?? 4173}${route}`, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(450);
await page.screenshot({ path: output, fullPage: full === "1" });

const meta = await page.evaluate(() => ({
  scrollHeight: document.body.scrollHeight,
  scrollWidth: document.documentElement.scrollWidth,
  theme: document.documentElement.dataset.theme,
  title: document.title,
}));
console.log(JSON.stringify({ errors, meta }));
await browser.close();
