import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const playwrightPath =
  process.env.PLAYWRIGHT_PATH ??
  "D:/Projects/cliff-format/cliff-js/node_modules/.pnpm/playwright@1.64.1/node_modules/playwright";
const { chromium } = require(playwrightPath);
const cpu = Number(process.env.CPU ?? 1);
const route = process.env.ROUTE ?? "/?t=dark&static=1";
const port = process.env.PORT ?? "4173";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const cdp = await page.context().newCDPSession(page);
await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpu });
await page.addInitScript(() => {
  window.__longTasks = [];
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) window.__longTasks.push(Math.round(entry.duration));
  }).observe({ type: "longtask", buffered: true });
  window.__lcp = 0;
  new PerformanceObserver((list) => {
    const entries = list.getEntries();
    const last = entries[entries.length - 1];
    if (last) window.__lcp = Math.round(last.startTime);
  }).observe({ type: "largest-contentful-paint", buffered: true });
});
const t0 = Date.now();
await page.goto(`http://127.0.0.1:${port}${route}`, { waitUntil: "load", timeout: 120000 });
const loadWall = Date.now() - t0;
await page.waitForTimeout(1000);
const data = await page.evaluate(() => {
  const nav = performance.getEntriesByType("navigation")[0];
  const paints = Object.fromEntries(performance.getEntriesByType("paint").map(p => [p.name, Math.round(p.startTime)]));
  const resources = performance.getEntriesByType("resource").map(r => ({ name: r.name.split("/").slice(-2).join("/"), type: r.initiatorType, transfer: r.transferSize, duration: Math.round(r.duration) }));
  return {
    nodes: document.getElementsByTagName("*").length,
    scripts: document.scripts.length,
    nav: { dcl: Math.round(nav.domContentLoadedEventEnd), load: Math.round(nav.loadEventEnd), responseEnd: Math.round(nav.responseEnd), transfer: nav.transferSize, encoded: nav.encodedBodySize, decoded: nav.decodedBodySize },
    paints,
    lcp: window.__lcp,
    longTasks: window.__longTasks,
    resources,
    heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize/1048576) : null,
  };
});
console.log(JSON.stringify({ cpu, route, loadWall, ...data }, null, 1));
await browser.close();
