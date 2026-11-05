// The ghost button is a small liquid lens over the page. The primary is a
// filled control, so it does not get a backdrop filter.

import type { GlassOptics } from "./glass-filter";

export const BUTTON_OPTICS: GlassOptics = {
  depth: 8,
  strength: 40,
  blur: 0,
  saturate: 1,
  brightness: 1,
};
