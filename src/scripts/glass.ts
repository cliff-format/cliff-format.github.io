// Liquid glass is the reference component's data-URI SVG displacement filter
// applied directly to the pane's backdrop-filter. The pane keeps its CSS tint,
// blur, sheen, and shadow; the filter bends the actual page behind it, so the
// lens follows scrolling content on both the X and Y edges.
//
// Inline SVG filters referenced by id do not render here; the filter and its
// displacement map are both data URIs, exactly as in nikdelvin/liquid-glass.
// Chromium renders this path; Safari and Firefox keep the CSS fallback.

import { backdropFilterValue, type GlassOptics } from "./glass-filter";
import { BUTTON_OPTICS } from "./glass-buttons";
import { kindOf, PANE_OPTICS } from "./glass-panes";

const supportsBackdropUrl =
  typeof CSS !== "undefined" &&
  typeof CSS.supports === "function" &&
  CSS.supports("backdrop-filter", "url(#glass)");

const isChromium = (() => {
  const ua = navigator.userAgent;
  return /Chrome\/|Chromium\/|Edg\//.test(ua) && !/OPR\/|Firefox\//.test(ua);
})();

const reducedTransparency =
  typeof matchMedia === "function" ? matchMedia("(prefers-reduced-transparency: reduce)") : null;

interface Applied {
  width: number;
  height: number;
  radius: number;
}

const applied = new WeakMap<Element, Applied>();

function opticsFor(glass: Element): GlassOptics | null {
  if (glass.classList.contains("btn-ghost")) return BUTTON_OPTICS;
  if (glass.classList.contains("btn")) return null;
  const kind = kindOf(glass);
  if (kind === "menu") return null;
  return PANE_OPTICS[kind];
}

function apply(glass: HTMLElement): void {
  const optics = opticsFor(glass);
  if (!optics || optics.depth <= 0 || optics.strength <= 0) return;

  const rect = glass.getBoundingClientRect();
  if (rect.width < 4 || rect.height < 4) return;

  const width = Math.round(rect.width);
  const height = Math.round(rect.height);
  const style = getComputedStyle(glass);
  const radius = Math.min(height / 2, width / 2, parseFloat(style.borderTopLeftRadius) || 0);
  const depth = Math.max(2, Math.min(optics.depth, Math.floor(Math.min(width, height) / 3)));
  const previous = applied.get(glass);
  if (
    previous &&
    glass.dataset.glass === "refract" &&
    previous.width === width &&
    previous.height === height &&
    previous.radius === radius
  ) {
    return;
  }

  const value = backdropFilterValue({ width, height, radius, ...optics, depth });
  glass.style.setProperty("-webkit-backdrop-filter", value);
  glass.style.setProperty("backdrop-filter", value);
  glass.dataset.glass = "refract";
  applied.set(glass, { width, height, radius });
}

export function initGlass(): void {
  if (!supportsBackdropUrl || !isChromium || reducedTransparency?.matches) return;

  const targets = [...document.querySelectorAll<HTMLElement>(".pane, .btn-ghost")];
  if (targets.length === 0) return;

  const pending = new Set<HTMLElement>();
  let timer = 0;
  const flush = (): void => {
    timer = 0;
    for (const glass of pending) {
      try {
        apply(glass);
      } catch {
        // A failed filter leaves the CSS glass intact.
      }
    }
    pending.clear();
  };
  const schedule = (glass: HTMLElement): void => {
    pending.add(glass);
    if (timer === 0) timer = window.setTimeout(flush, 90);
  };

  if (typeof ResizeObserver === "function") {
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target instanceof HTMLElement) schedule(entry.target);
      }
    });
    for (const glass of targets) observer.observe(glass);
  }

  for (const glass of targets) {
    try {
      apply(glass);
    } catch {
      // Keep the CSS fallback for this surface.
    }
  }

  const clear = (): void => {
    for (const glass of targets) {
      glass.style.removeProperty("-webkit-backdrop-filter");
      glass.style.removeProperty("backdrop-filter");
      delete glass.dataset.glass;
      applied.delete(glass);
    }
  };

  reducedTransparency?.addEventListener("change", () => {
    if (reducedTransparency.matches) clear();
    else for (const glass of targets) schedule(glass);
  });
}
