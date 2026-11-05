// Liquid glass mount: size each pane's filter layer and install its filter.
//
// Vendored from [nikdelvin/liquid-glass](https://github.com/nikdelvin/liquid-glass)
// (MIT, © Nik Delvin), src/components/LiquidGlass.astro. The renderer is the
// library's; the differences are:
//
// - The filter is installed into the document instead of a data URI. A
//   same-document filter stays parsed while the backdrop keeps moving, which
//   measured ~40% cheaper per frame than re-parsing the URI.
// - The radius is clamped to the box (pills declare 999px), and the corner
//   shape follows the computed G2 corner.
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

/** Install (or refresh) this element's filter and return its id. */
function installFilter(el: HTMLElement, markup: string): string {
  const parsed = new DOMParser().parseFromString(markup, "image/svg+xml").querySelector("filter");
  // An empty <filter> is what malformed markup degrades to. Treat it as a
  // failure instead of silently dropping the lens.
  if (!parsed || parsed.children.length === 0) return "";
  const id = el.dataset.filterId ?? `lg-filter-${++filterSeq}`;
  el.dataset.filterId = id;
  const filter = document.importNode(parsed, true);
  filter.id = id;
  document.getElementById(id)?.remove();
  filterDefs.append(filter);
  return id;
}

function setBackdrop(el: HTMLElement, value: string): void {
  el.style.backdropFilter = value;
  el.style.setProperty("-webkit-backdrop-filter", value);
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
    setBackdrop(box, `blur(${width / 10}px) saturate(180%)`);
    return;
  }

  if (reducedTransparency.matches) {
    setBackdrop(box, "none");
    return;
  }

  const signature = `${width}x${height}|${radius}|${depth}|${strength}|${chromaticAberration}|${cornerExponent}`;
  if (box.dataset.filterSignature !== signature) {
    const installed = installFilter(
      box,
      getDisplacementFilterMarkup({ height, width, radius, depth, strength, chromaticAberration, cornerExponent }),
    );
    if (!installed) {
      // The lens failed to install; keep the blur so the pane still reads as glass.
      box.dataset.filterSignature = "";
      setBackdrop(box, `blur(${blurValue / 2}px) blur(${blurValue}px) brightness(${brightness}) saturate(${saturate})`);
      return;
    }
    box.dataset.filterSignature = signature;
  }

  setBackdrop(
    box,
    `blur(${blurValue / 2}px) url(#${box.dataset.filterId}) blur(${blurValue}px) brightness(${brightness}) saturate(${saturate})`,
  );
}

const glasses = (): HTMLElement[] => [...document.querySelectorAll<HTMLElement>(".liquid-glass")];

function initGlass(): void {
  for (const glass of glasses()) {
    if (glass.dataset.glassReady === "1") continue;
    glass.dataset.glassReady = "1";
    redrawGlass(glass);
    // Fonts, language switches, and the popover all resize the pane.
    new ResizeObserver(() => redrawGlass(glass)).observe(glass);
  }
}

reducedTransparency.addEventListener("change", () => {
  for (const glass of glasses()) redrawGlass(glass);
});

/* Glass is an enhancement: the first paint keeps the CSS tint and the rim, and
   the filters rasterize once the page is idle. Building the filters on
   DOMContentLoaded pushed that event by ~500ms under 4x throttling. */
function scheduleGlass(): void {
  if ("requestIdleCallback" in window) requestIdleCallback(initGlass, { timeout: 1000 });
  else setTimeout(initGlass, 200);
}

if (document.readyState === "complete") scheduleGlass();
else addEventListener("load", scheduleGlass, { once: true });
