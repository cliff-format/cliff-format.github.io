// Measure the idle cost of the page: browser CPU per wall second while the
// background drift runs. This is the regression check for the drift sampling
// and the glass filters; load timings live in perf-probe.mjs.
//
// The server must already be running (pnpm preview or a static server):
//
//   PORT=4174 node scripts/perf-idle.mjs
//   PORT=4174 ROUTE="/en/?t=light" SECONDS=10 node scripts/perf-idle.mjs
//
// The numbers are headless Edge on this machine, so use them for before/after
// comparisons rather than as absolute budgets.

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const playwrightPath =
  process.env.PLAYWRIGHT_PATH ??
  "D:/Projects/cliff-format/cliff-js/node_modules/.pnpm/playwright@1.64.1/node_modules/playwright";
const { chromium } = require(playwrightPath);

const port = process.env.PORT ?? "4174";
const route = process.env.ROUTE ?? "/?t=dark";
const seconds = Number(process.env.SECONDS ?? 6);
const [width, height] = (process.env.VIEWPORT ?? "1440x900").split("x").map(Number);
const dpr = Number(process.env.DPR ?? 1);

const browser = await chromium.launch({ channel: "msedge", headless: true });
const browserCdp = await browser.newBrowserCDPSession();
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: dpr });
const cdp = await page.context().newCDPSession(page);
await cdp.send("Performance.enable");
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

await page.goto("http://127.0.0.1:" + port + route, { waitUntil: "load", timeout: 120000 });
// Fonts and the chunked filter mount settle before the sample window.
await page.waitForTimeout(2500);

const readProcesses = async () => (await browserCdp.send("SystemInfo.getProcessInfo")).processInfo;
const proc0 = await readProcesses();
const metrics0 = await cdp.send("Performance.getMetrics");
const started = Date.now();
await page.waitForTimeout(seconds * 1000);
const proc1 = await readProcesses();
const metrics1 = await cdp.send("Performance.getMetrics");
const elapsed = (Date.now() - started) / 1000;

const m0 = Object.fromEntries(metrics0.metrics.map((m) => [m.name, m.value]));
const m1 = Object.fromEntries(metrics1.metrics.map((m) => [m.name, m.value]));
const elapsedMetric = (name) => +(m1[name] - m0[name]).toFixed(3);

const byType = {};
let total = 0;
for (const process of proc1) {
  const before = proc0.find((p) => p.id === process.id);
  if (!before) continue;
  const delta = process.cpuTime - before.cpuTime;
  byType[process.type] = +((byType[process.type] ?? 0) + delta).toFixed(3);
  total += delta;
}

const pageInfo = await page.evaluate(() => {
  const nav = performance.getEntriesByType("navigation")[0];
  return {
    nodes: document.getElementsByTagName("*").length,
    filters: document.querySelectorAll("filter[id^='lg-filter']").length,
    dcl: Math.round(nav.domContentLoadedEventEnd),
    load: Math.round(nav.loadEventEnd),
    lcp: window.__lcp,
    longTasks: window.__longTasks,
  };
});

console.log(
  JSON.stringify(
    {
      route,
      viewport: width + "x" + height + "@" + dpr + "x",
      seconds: +elapsed.toFixed(2),
      cpuPerSec: +(total / elapsed).toFixed(2),
      byType,
      mainThread: {
        task: elapsedMetric("TaskDuration"),
        script: elapsedMetric("ScriptDuration"),
        layout: elapsedMetric("LayoutDuration"),
        recalcStyle: elapsedMetric("RecalcStyleDuration"),
      },
      page: pageInfo,
    },
    null,
    1,
  ),
);

await browser.close();
