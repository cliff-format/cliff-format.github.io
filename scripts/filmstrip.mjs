// Capture the page-load sequence as a filmstrip.
//
// Pauses the CSS entrance animations, seeks them to fixed timestamps, and writes
// one frame per step so the choreography can be reviewed without re-recording.
//
//   node scripts/filmstrip.mjs shots/film
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const playwrightPath =
  process.env.PLAYWRIGHT_PATH ??
  "D:/Projects/cliff-format/cliff-js/node_modules/.pnpm/playwright@1.64.1/node_modules/playwright";
const { chromium } = require(playwrightPath);

const prefix = process.argv[2] ?? "shots/film";
const theme = process.env.THEME ?? "dark";
const frames = [0, 120, 240, 400, 700, 1100];

const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
await page.goto(`http://127.0.0.1:${process.env.PORT ?? 4321}/?t=${theme}`, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.evaluate(() => {
  for (const animation of document.getAnimations()) {
    animation.pause();
    animation.currentTime = 0;
  }
});
for (const time of frames) {
  await page.evaluate((t) => {
    for (const animation of document.getAnimations()) animation.currentTime = t;
  }, time);
  await page.waitForTimeout(60);
  await page.screenshot({ path: `${prefix}-${String(time).padStart(4, "0")}.png` });
}
await browser.close();
console.log("frames written");
