// Optics for the reference displacement filter. `depth` is the visible
// thickness of the glass edge; `strength` is the displacement scale. Blur is 0:
// the reference glass is clear, so the bent dot field stays visible on both axes.

import type { GlassOptics } from "./glass-filter";

export type PaneKind = "header" | "footer" | "card" | "code" | "cta" | "menu";

export const PANE_OPTICS: Record<PaneKind, GlassOptics> = {
  header: { depth: 16, strength: 90, blur: 0, saturate: 1, brightness: 1 },
  footer: { depth: 20, strength: 120, blur: 0, saturate: 1, brightness: 1 },
  card: { depth: 20, strength: 120, blur: 0, saturate: 1, brightness: 1 },
  code: { depth: 20, strength: 120, blur: 0, saturate: 1, brightness: 1 },
  cta: { depth: 22, strength: 130, blur: 0, saturate: 1, brightness: 1 },
  menu: { depth: 0, strength: 0, blur: 0, saturate: 1, brightness: 1 },
};

export function kindOf(pane: Element): PaneKind {
  if (pane.closest(".head-pane")) return "header";
  if (pane.closest(".foot-pane")) return "footer";
  if (pane.closest(".code-card")) return "code";
  if (pane.closest(".cta-panel")) return "cta";
  if (pane.closest(".lang-pane")) return "menu";
  return "card";
}
