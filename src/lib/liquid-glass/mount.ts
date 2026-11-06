// Liquid glass mount: size each pane's filter layer and install its filter.
//
// Vendored from [nikdelvin/liquid-glass](https://github.com/nikdelvin/liquid-glass)
// (MIT, © Nik Delvin), src/components/LiquidGlass.astro. The renderer is the
// library's; the differences are:
//
// - The filter is installed into the document instead of a data URI. A
//   same-document filter stays parsed while the backdrop keeps moving, which
//   measured ~40% cheaper per frame than re-parsing the URI.
// - Filters are shared by geometry and built one per idle callback. Six
//   feature cards use one filter instead of six, and the first paint never
//   parses every filter in a single long task.
// - One ResizeObserver re-measures every pane after fonts or layout change.
// - The radius is clamped to the box (pills declare 999px), and the corner
//   shape follows the computed G2 corner.
// - Chromatic dispersion is disabled in filter.ts, so every filter is the
//   single-pass lens and scrolling no longer swaps filter graphs.
//
// The filter covers the whole pane. Splitting the pane into a blurred centre
// and thin edge strips does not work: the displacement pulls up to `strength`
// pixels of backdrop, and a strip narrower than that has no backdrop left to
// pull from, so its edge shows a dark band.

import { getDisplacementFilterMarkup } from "./filter";

const SVG_NS = "http://www.w3.org/2000/svg";

const supportsBackdropFilterUrl = (() => {
  const testEl = document.createElement("div");
  testEl.style.cssText = "backdrop-filter: url(#test)";
  return testEl.style.backdropFilter === "url(#test)" || testEl.style.backdropFilter === 'url("#test")';
})();

const reducedTransparency = matchMedia("(prefers-reduced-transparency: reduce)");

/* One hidden <svg> holds every filter. */
const filterDefs = (() => {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("width", "0");
  svg.setAttribute("height", "0");
  svg.style.cssText = "position:absolute;width:0;height:0;overflow:hidden;pointer-events:none";
  const defs = document.createElementNS(SVG_NS, "defs");
  svg.append(defs);
  document.body.append(svg);
  return defs;
})();

let filterSeq = 0;

type FilterEntry = {
  id: string;
  filter: SVGFilterElement;
  /** Boxes that reference this filter; the last one releases it. */
  users: Set<HTMLElement>;
};

/** Filters keyed by the geometry that produced them. */
const filters = new Map<string, FilterEntry>();

/** Parse one <filter>; an empty node is what malformed markup degrades to. */
function parseFilterMarkup(markup: string): SVGFilterElement | null {
  const parsed = new DOMParser().parseFromString(markup, "image/svg+xml").querySelector("filter");
  if (!parsed || parsed.children.length === 0) return null;
  return parsed as SVGFilterElement;
}

/** Install one filter geometry. */
function installFilter(markup: string): FilterEntry | null {
  const parsed = parseFilterMarkup(markup);
  if (!parsed) return null;
  const id = `lg-filter-${++filterSeq}`;
  const filter = document.importNode(parsed, true);
  filter.id = id;
  filterDefs.append(filter);
  return { id, filter, users: new Set() };
}

/** Take a reference to a filter for this signature, installing it if needed. */
function acquireFilter(box: HTMLElement, signature: string, markup: string): string {
  const existing = filters.get(signature);
  if (existing && document.getElementById(existing.id)) {
    existing.users.add(box);
    return existing.id;
  }
  const entry = installFilter(markup);
  if (!entry) return "";
  entry.users.add(box);
  filters.set(signature, entry);
  return entry.id;
}

/** Drop this box's reference; remove the filter when nobody uses it. */
function releaseFilter(box: HTMLElement): void {
  const signature = box.dataset.filterSignature;
  if (signature) {
    const entry = filters.get(signature);
    if (entry) {
      entry.users.delete(box);
      if (entry.users.size === 0) {
        entry.filter.remove();
        filters.delete(signature);
      }
    }
  }
  delete box.dataset.filterSignature;
  delete box.dataset.filterId;
}

function setBackdrop(el: HTMLElement, value: string): void {
  el.style.backdropFilter = value;
  el.style.setProperty("-webkit-backdrop-filter", value);
}

/** The backdrop chain around one displacement filter. */
function backdropValue(id: string, blur: number, brightness: number, saturate: number): string {
  return `blur(${blur / 2}px) url(#${id}) blur(${blur}px) brightness(${brightness}) saturate(${saturate})`;
}

function redrawGlass(glass: HTMLElement): void {
  // :scope with direct children: a glass button nested inside a glass pane has
  // its own .glass-box and .lg-content, and an unscoped query would grab the
  // nested one first, leaving the outer pane without a filter.
  const box = glass.querySelector<HTMLElement>(":scope > .lg-filter-layer > .glass-box");
  const content = glass.querySelector<HTMLElement>(":scope > .lg-content");
  if (!box || !content) return;

  const rect = content.getBoundingClientRect();
  const width = Math.round(rect.width);
  const height = Math.round(rect.height);
  if (width < 1 || height < 1) return;

  const blurValue = Number.parseFloat(box.dataset.blur ?? "0");
  // Kept for the commented-out dispersion graph; the glass components no
  // longer pass the prop, so this reads 0.
  const chromaticAberration = Number.parseFloat(box.dataset.cab ?? "0");
  const depth = Number.parseFloat(box.dataset.depth ?? "10");
  const strength = Number.parseFloat(box.dataset.strength ?? "100");
  const saturate = Number.parseFloat(box.dataset.saturate ?? "1.5");
  const brightness = Number.parseFloat(box.dataset.brightness ?? "1.1");
  // Clamp the authored radius to the box, the way the browser draws a pill.
  // An unclamped 999px would push the map's edge gradients off the shape.
  const radius = Math.min(Number.parseFloat(glass.style.borderRadius) || 0, width / 2, height / 2);
  // The lens follows the pane's G2 corner: CSS squircle computes to
  // superellipse(2), whose curve is the exponent-4 superellipse.
  const cornerShape = getComputedStyle(glass).getPropertyValue("corner-shape");
  const cornerParam = /superellipse\(([\d.]+)\)/.exec(cornerShape);
  const cornerExponent = cornerParam ? Math.pow(2, Math.min(Number.parseFloat(cornerParam[1]), 4)) : 2;

  box.style.left = "0";
  box.style.top = "0";
  box.style.width = `${width}px`;
  box.style.height = `${height}px`;

  if (!supportsBackdropFilterUrl) {
    // Safari without url() filters: keep a frosted pane rather than a flat one.
    releaseFilter(box);
    setBackdrop(box, `blur(${width / 10}px) saturate(180%)`);
    return;
  }

  if (reducedTransparency.matches) {
    releaseFilter(box);
    setBackdrop(box, "none");
    return;
  }

  const signature = `${width}x${height}|${radius}|${depth}|${strength}|${chromaticAberration}|${cornerExponent}`;
  if (box.dataset.filterSignature !== signature) {
    // Let go of the previous geometry before taking the next one; a shared
    // filter survives while any other box still references it.
    releaseFilter(box);
    const installed = acquireFilter(
      box,
      signature,
      getDisplacementFilterMarkup({ height, width, radius, depth, strength, chromaticAberration, cornerExponent }),
    );
    if (!installed) {
      // The lens failed to install; keep the blur so the pane still reads as glass.
      setBackdrop(box, `blur(${blurValue / 2}px) blur(${blurValue}px) brightness(${brightness}) saturate(${saturate})`);
      return;
    }
    box.dataset.filterSignature = signature;
    box.dataset.filterId = installed;
  }

  const filterId = box.dataset.filterId;
  if (!filterId) return;
  setBackdrop(box, backdropValue(filterId, blurValue, brightness, saturate));
}

const glasses = (): HTMLElement[] => [...document.querySelectorAll<HTMLElement>(".liquid-glass")];

/* One observer for every pane: resizing the window must not run a separate
   layout pass per glass. The next frame coalesces a font swap, a media query,
   and the language popover into one batch. */
const pendingRedraw = new Set<HTMLElement>();
let redrawFrame = 0;

function scheduleRedraw(glass: HTMLElement): void {
  pendingRedraw.add(glass);
  if (redrawFrame !== 0) return;
  redrawFrame = requestAnimationFrame(() => {
    redrawFrame = 0;
    const batch = [...pendingRedraw];
    pendingRedraw.clear();
    for (const pane of batch) redrawGlass(pane);
  });
}

const resizeObserver = new ResizeObserver((entries) => {
  for (const entry of entries) {
    if (entry.target instanceof HTMLElement) scheduleRedraw(entry.target);
  }
});

function initGlass(glass: HTMLElement): void {
  if (glass.dataset.glassReady === "1") return;
  glass.dataset.glassReady = "1";
  redrawGlass(glass);
  resizeObserver.observe(glass);
}

reducedTransparency.addEventListener("change", () => {
  for (const glass of glasses()) scheduleRedraw(glass);
});

/* Glass is an enhancement: the first paint keeps the CSS tint and the rim, and
   the filters rasterize once the page is idle. One filter per idle callback
   keeps that work out of a single long task; building all of them on
   DOMContentLoaded pushed that event by ~500ms under 4x throttling. */
function scheduleGlass(): void {
  const queue = glasses().filter((glass) => glass.dataset.glassReady !== "1");
  let index = 0;

  const run = (): void => {
    const glass = queue[index++];
    if (glass) initGlass(glass);
    if (index < queue.length) schedule(run);
  };

  const schedule = (callback: () => void): void => {
    if ("requestIdleCallback" in window) requestIdleCallback(callback, { timeout: 100 });
    else setTimeout(callback, 50);
  };

  if (queue.length > 0) schedule(run);
}

if (document.readyState === "complete") scheduleGlass();
else addEventListener("load", scheduleGlass, { once: true });
