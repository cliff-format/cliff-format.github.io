// Displacement map and filter for the liquid glass effect.
//
// Vendored from [nikdelvin/liquid-glass](https://github.com/nikdelvin/liquid-glass)
// (MIT, © Nik Delvin), src/utils/liquidGlass.ts. The maths is unchanged: a
// neutral response map, an inset rounded rectangle for the untouched centre,
// and three feDisplacementMap passes that split R, G, and B for dispersion.
//
// One addition: `cornerExponent` carries the pane's G2 corner shape into the
// map. CSS `corner-shape: squircle` computes to `superellipse(2)`, which is a
// superellipse of exponent 2^2; the default exponent 2 is the circular corner
// the library draws with rx/ry, so untouched callers keep upstream output.

type DisplacementOptions = {
  height: number;
  width: number;
  radius: number;
  depth: number;
  strength?: number;
  chromaticAberration?: number;
  /** Superellipse exponent of the corners; 2 is circular, 4 is a squircle. */
  cornerExponent?: number;
};

const CORNER_STEPS = 16;

/** Rounded rectangle with superellipse corners, as an SVG path. A circular
    corner is the same curve at exponent 2, so one builder covers both. */
const superellipseRect = (
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  exponent: number,
): string => {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  if (r === 0) return `M${x} ${y} h${width} v${height} h${-width} Z`;

  const right = x + width;
  const bottom = y + height;
  // Corner point at parameter t: centre + u * r * sin^(2/n) + v * r * cos^(2/n).
  // u points along the edge the curve leaves on, v along the edge it enters.
  const corner = (cx: number, cy: number, ux: number, uy: number, vx: number, vy: number): string => {
    let out = "";
    for (let i = 1; i <= CORNER_STEPS; i++) {
      const angle = (i / CORNER_STEPS) * (Math.PI / 2);
      const s = Math.pow(Math.sin(angle), 2 / exponent);
      const c = Math.pow(Math.cos(angle), 2 / exponent);
      const px = cx + r * (ux * s + vx * c);
      const py = cy + r * (uy * s + vy * c);
      out += `L${px.toFixed(2)} ${py.toFixed(2)}`;
    }
    return out;
  };

  return (
    `M${x + r} ${y} L${right - r} ${y}` +
    corner(right - r, y + r, 1, 0, 0, -1) +
    `L${right} ${bottom - r}` +
    corner(right - r, bottom - r, 0, 1, 1, 0) +
    `L${x + r} ${bottom}` +
    corner(x + r, bottom - r, -1, 0, 0, 1) +
    `L${x} ${y + r}` +
    corner(x + r, y + r, 0, -1, -1, 0) +
    "Z"
  );
};

export const getDisplacementMap = ({
  height,
  width,
  radius,
  depth,
  cornerExponent = 2,
}: Omit<DisplacementOptions, "chromaticAberration" | "strength">) =>
  `<svg height="${height}" width="${width}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <style>
        .mix { mix-blend-mode: screen; }
    </style>
    <defs>
        <linearGradient 
          id="Y" 
          x1="0" 
          x2="0" 
          y1="${Math.ceil((radius / height) * 15)}%" 
          y2="${Math.floor(100 - (radius / height) * 15)}%">
            <stop offset="0%" stop-color="#0F0" />
            <stop offset="100%" stop-color="#000" />
        </linearGradient>
        <linearGradient 
          id="X" 
          x1="${Math.ceil((radius / width) * 15)}%" 
          x2="${Math.floor(100 - (radius / width) * 15)}%"
          y1="0" 
          y2="0">
            <stop offset="0%" stop-color="#F00" />
            <stop offset="100%" stop-color="#000" />
        </linearGradient>
    </defs>

    <rect x="0" y="0" height="${height}" width="${width}" fill="#808080" />
    <g filter="blur(2px)">
      <rect x="0" y="0" height="${height}" width="${width}" fill="#000080" />
      <rect
          x="0"
          y="0"
          height="${height}"
          width="${width}"
          fill="url(#Y)"
          class="mix"
      />
      <rect
          x="0"
          y="0"
          height="${height}"
          width="${width}"
          fill="url(#X)"
          class="mix"
      />
      ${
        cornerExponent === 2
          ? `<rect
          x="${depth}"
          y="${depth}"
          height="${height - 2 * depth}"
          width="${width - 2 * depth}"
          fill="#808080"
          rx="${radius}"
          ry="${radius}"
          filter="blur(${depth}px)"
      />`
          : `<path
          d="${superellipseRect(depth, depth, width - 2 * depth, height - 2 * depth, radius, cornerExponent)}"
          fill="#808080"
          filter="blur(${depth}px)"
      />`
      }
    </g>
</svg>`;

/** The filter as SVG markup. The mount installs it into the document: a data
    URI is re-parsed every time the backdrop is sampled. With zero chromatic
    aberration the filter collapses to one displacement pass; the scroll
    material uses that form to keep the lens without the dispersion cost. */
export const getDisplacementFilterMarkup = ({
  height,
  width,
  radius,
  depth,
  strength = 100,
  chromaticAberration = 0,
  cornerExponent = 2,
}: DisplacementOptions) => {
  const image = `<feImage x="0" y="0" height="${height}" width="${width}" href="data:image/svg+xml;utf8,${encodeURIComponent(
    getDisplacementMap({ height, width, radius, depth, cornerExponent }),
  )}" result="displacementMap" />`;

  const singlePass = `${image}
            <feDisplacementMap
                in="SourceGraphic"
                in2="displacementMap"
                scale="${strength}"
                xChannelSelector="R"
                yChannelSelector="G"
            />`;

  const dispersed = `${image}
            <feDisplacementMap
                transform-origin="center"
                in="SourceGraphic"
                in2="displacementMap"
                scale="${strength + chromaticAberration * 2}"
                xChannelSelector="R"
                yChannelSelector="G"
            />
            <feColorMatrix
            type="matrix"
            values="1 0 0 0 0
                    0 0 0 0 0
                    0 0 0 0 0
                    0 0 0 1 0"
            result="displacedR"
                    />
            <feDisplacementMap
                in="SourceGraphic"
                in2="displacementMap"
                scale="${strength + chromaticAberration}"
                xChannelSelector="R"
                yChannelSelector="G"
            />
            <feColorMatrix
            type="matrix"
            values="0 0 0 0 0
                    0 1 0 0 0
                    0 0 0 0 0
                    0 0 0 1 0"
            result="displacedG"
                    />
            <feDisplacementMap
                    in="SourceGraphic"
                    in2="displacementMap"
                    scale="${strength}"
                    xChannelSelector="R"
                    yChannelSelector="G"
                />
                <feColorMatrix
                type="matrix"
                values="0 0 0 0 0
                        0 0 0 0 0
                        0 0 1 0 0
                        0 0 0 1 0"
                result="displacedB"
                        />
              <feBlend in="displacedR" in2="displacedG" mode="screen"/>
              <feBlend in2="displacedB" mode="screen"/>`;

  return `<svg height="${height}" width="${width}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
        <filter id="displace" color-interpolation-filters="sRGB">
            ${chromaticAberration > 0 ? dispersed : singlePass}
        </filter>
    </defs>
</svg>`;
};

/** Upstream's data-URI form, kept for callers that cannot share a filter. */
export const getDisplacementFilter = (options: DisplacementOptions) =>
  "data:image/svg+xml;utf8," + encodeURIComponent(getDisplacementFilterMarkup(options)) + "#displace";
