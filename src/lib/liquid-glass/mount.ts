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

type FilterMode = "full" | "scroll";

type FilterEntry = {
  id: string;
  filter: SVGFilterElement;
  /** The three-pass primitives and their one-pass scroll twin. */
  fullNodes: Node[];
  scrollNodes: Node[];
  /** Target scales of the three displacement passes, and their cab-0 value. */
  targetScales: number[];
  baseScale: number;
  /** The displacement maps currently mounted in the full form. */
  maps: Element[];
  /** Boxes that reference this filter; the last one releases it. */
  users: Set<HTMLElement>;
  mode: FilterMode;
};

/** Filters keyed by the geometry that produced them. */
const filters = new Map<string, FilterEntry>();
let filterMode: FilterMode = "full";
let restoreFrame = 0;
const RESTORE_MS = 480;

/** Parse one <filter>; an empty node is what malformed markup degrades to. */
function parseFilterMarkup(markup: string): SVGFilterElement | null {
  const parsed = new DOMParser().parseFromString(markup, "image/svg+xml").querySelector("filter");
  if (!parsed || parsed.children.length === 0) return null;
  return parsed as SVGFilterElement;
}

/** Install the rest and scroll forms of one filter geometry. */
function installFilter(fullMarkup: string, scrollMarkup: string): FilterEntry | null {
  const full = parseFilterMarkup(fullMarkup);
  const scroll = parseFilterMarkup(scrollMarkup);
  if (!full || !scroll) return null;
  const id = `lg-filter-${++filterSeq}`;
  const scales = [...full.querySelectorAll("feDisplacementMap")].map((map) =>
    Number(map.getAttribute("scale")),
  );
  const baseScale = scales.length > 0 ? Math.min(...scales) : 0;
  const filter = document.importNode(full, true);
  filter.id = id;
  // Insert at cab 0 so a filter arriving during the restore never flashes the
  // target dispersion before the first animation frame.
  if (filterMode === "full" && restoreFrame !== 0) {
    for (const map of filter.querySelectorAll("feDisplacementMap")) {
      map.setAttribute("scale", String(baseScale));
    }
  }
  filterDefs.append(filter);
  const entry: FilterEntry = {
    id,
    filter,
    fullNodes: [...full.children].map((node) => node.cloneNode(true)),
    scrollNodes: [...scroll.children].map((node) => node.cloneNode(true)),
    targetScales: scales,
    baseScale,
    maps: [],
    users: new Set(),
    mode: "full",
  };
  if (filterMode === "scroll") {
    filter.replaceChildren(...entry.scrollNodes.map((node) => node.cloneNode(true)));
    entry.mode = "scroll";
  } else {
    entry.maps = [...filter.querySelectorAll("feDisplacementMap")];
  }
  return entry;
}

/** Clone the full graph with its displacement scales at cab 0. */
function fullNodesAtBase(entry: FilterEntry): { nodes: Node[]; maps: Element[] } {
  const nodes = entry.fullNodes.map((node) => node.cloneNode(true));
  const maps: Element[] = [];
  for (const node of nodes) {
    if (node.nodeType !== 1) continue;
    const element = node as Element;
    if (element.tagName.toLowerCase() === "fedisplacementmap") {
      element.setAttribute("scale", String(entry.baseScale));
      maps.push(element);
    }
  }
  return { nodes, maps };
}

/** Take a reference to a filter for this signature, installing it if needed. */
function acquireFilter(box: HTMLElement, signature: string, fullMarkup: string, scrollMarkup: string): string {
  const existing = filters.get(signature);
  if (existing && document.getElementById(existing.id)) {
    existing.users.add(box);
    return existing.id;
  }
  const entry = installFilter(fullMarkup, scrollMarkup);
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

/** Fade the three dispersion scales in after the scroll ends. A cab-0
    three-pass filter renders exactly like the one-pass scroll form, so the
    transition starts without a pop and only the R/B fringe fades in. */
function animateRestore(): void {
  const started = performance.now();
  const step = (now: number): void => {
    const t = Math.min((now - started) / RESTORE_MS, 1);
    // Smoothstep spreads the color fringe over the whole 480 ms; an ease-out
    // cubic put ~90% of the change in the first half and read as a snap.
    const eased = t * t * (3 - 2 * t);
    for (const entry of filters.values()) {
      if (entry.mode !== "full" || entry.maps.length !== 3) continue;
      for (let i = 0; i < 3; i++) {
        const target = entry.targetScales[i] ?? entry.baseScale;
        const scale = entry.baseScale + (target - entry.baseScale) * eased;
        entry.maps[i].setAttribute("scale", scale.toFixed(2));
      }
    }
    if (t < 1) {
      restoreFrame = requestAnimationFrame(step);
      return;
    }
    restoreFrame = 0;
    for (const entry of filters.values()) {
      if (entry.mode !== "full") continue;
      entry.maps.forEach((map, i) => map.setAttribute("scale", String(entry.targetScales[i] ?? entry.baseScale)));
    }
  };
  restoreFrame = requestAnimationFrame(step);
}

/** Swap every installed filter between the rest and scroll forms. */
function setFilterMode(mode: FilterMode): void {
  if (filterMode === mode) return;
  filterMode = mode;

  if (mode === "scroll") {
    if (restoreFrame !== 0) {
      cancelAnimationFrame(restoreFrame);
      restoreFrame = 0;
    }
    for (const entry of filters.values()) {
      if (entry.mode === "scroll") continue;
      entry.filter.replaceChildren(...entry.scrollNodes.map((node) => node.cloneNode(true)));
      entry.mode = "scroll";
      entry.maps = [];
    }
    return;
  }

  // Restore the full graph at cab 0, then ease the dispersion back in. The
  // base scales are set before the nodes enter the document, so the target
  // dispersion is never painted for a frame.
  for (const entry of filters.values()) {
    if (entry.mode === "full") continue;
    const { nodes, maps } = fullNodesAtBase(entry);
    entry.filter.replaceChildren(...nodes);
    entry.mode = "full";
    entry.maps = maps;
  }
  if (restoreFrame === 0) animateRestore();
}

document.addEventListener("lg-scroll", (event) => {
  setFilterMode((event as CustomEvent<boolean>).detail ? "scroll" : "full");
});

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
    // Install both forms together: the three-pass rest material and the
    // one-pass scroll twin. The twins share the filter id and only swap their
    // primitives, so the compositor can keep the pane's layer.
    const installed = acquireFilter(
      box,
      signature,
      getDisplacementFilterMarkup({ height, width, radius, depth, strength, chromaticAberration, cornerExponent }),
      getDisplacementFilterMarkup({ height, width, radius, depth, strength, chromaticAberration: 0, cornerExponent }),
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
