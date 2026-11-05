// Render a weight specimen in the site's own font stack and capture it.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const playwrightPath =
  process.env.PLAYWRIGHT_PATH ??
  "D:/Projects/cliff-format/cliff-js/node_modules/.pnpm/playwright@1.64.1/node_modules/playwright";
const { chromium } = require(playwrightPath);

const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 900, height: 700 }, deviceScaleFactor: 2 });
await page.goto(`http://127.0.0.1:${process.env.PORT ?? 4174}/?t=dark&static=1`, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.evaluate(() => {
  const host = document.createElement("div");
  host.id = "specimen";
  host.style.cssText =
    "position:fixed;inset:0;z-index:99999;background:#101112;color:#f2f3f2;padding:28px 36px;font-family:var(--font-ui);";
  host.innerHTML = [300, 400, 500, 600, 700, 800]
    .map(
      (w) =>
        `<div style="display:flex;align-items:baseline;gap:18px;margin-bottom:10px">
           <span style="font-family:var(--font-mono);font-size:12px;color:#8c9296;width:44px">${w}</span>
           <span style="font-size:30px;font-weight:${w}">上下文就是格式</span>
           <span style="font-size:30px;font-weight:${w}">CLIFF 1.1</span>
         </div>`,
    )
    .join("");
  document.body.append(host);
});
await page.waitForTimeout(200);
const host = page.locator("#specimen");
await host.screenshot({ path: "shots/type-specimen.png" });
await browser.close();
