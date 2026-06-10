import sharp from "sharp";

// Programmatic synthetic radiographs. No real images, ever. Each frame is built
// from simple shapes so an AI-finding demo has something to point at: dark film
// backgrounds, lighter tooth and root silhouettes, a bright root-filling line on
// post-op shots, and an optional dark periapical halo. Exposure and grain vary by
// seed, and a small SYNTHETIC watermark is burned into every file.

// A tiny deterministic PRNG so a given seed always yields the same image.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type RadiographType =
  | "periapical"
  | "bitewing"
  | "panoramic"
  | "cbct"
  | "intraoral_photo"
  | "extraoral_photo"
  | "document_scan";

export interface RadiographSpec {
  type: RadiographType;
  seed: number;
  toothNumber?: number;
  // pre_op, working_length, master_cone, post_op, recall, or none.
  sequenceRole?: string | null;
  hasHalo?: boolean;
}

const SIZES: Record<string, { w: number; h: number }> = {
  periapical: { w: 560, h: 760 },
  bitewing: { w: 760, h: 560 },
  panoramic: { w: 1440, h: 620 },
  cbct: { w: 720, h: 720 },
  intraoral_photo: { w: 900, h: 675 },
  extraoral_photo: { w: 900, h: 675 },
  document_scan: { w: 850, h: 1100 },
};

function watermark(w: number, h: number, dark: boolean): string {
  const fill = dark ? "rgba(255,255,255,0.32)" : "rgba(0,0,0,0.3)";
  return `<text x="${w - 12}" y="${h - 12}" text-anchor="end" font-family="monospace" font-size="16" font-weight="700" fill="${fill}" letter-spacing="2">SYNTHETIC</text>`;
}

// One tooth: a crown blob with one to three tapering roots, optionally with a
// bright canal filling line and a dark periapical halo at an apex.
function tooth(
  cx: number,
  topY: number,
  scale: number,
  roots: number,
  rng: () => number,
  filled: boolean,
  halo: boolean,
): string {
  const crownW = 86 * scale;
  const crownH = 70 * scale;
  const rootLen = (150 + rng() * 60) * scale;
  const enamel = `hsl(95, 8%, ${68 + rng() * 12}%)`;
  const dentin = `hsl(95, 10%, ${52 + rng() * 10}%)`;
  let s = "";

  // Crown.
  s += `<path d="M ${cx - crownW / 2} ${topY} Q ${cx} ${topY - crownH * 0.5} ${cx + crownW / 2} ${topY} L ${cx + crownW / 2} ${topY + crownH} Q ${cx} ${topY + crownH * 1.15} ${cx - crownW / 2} ${topY + crownH} Z" fill="${enamel}"/>`;

  const spread = roots > 1 ? crownW * 0.34 : 0;
  for (let r = 0; r < roots; r++) {
    const rx = cx + (roots === 1 ? 0 : (r - (roots - 1) / 2) * spread);
    const apexY = topY + crownH + rootLen * (0.9 + rng() * 0.2);
    const rootW = 24 * scale;
    s += `<path d="M ${rx - rootW / 2} ${topY + crownH} Q ${rx - rootW * 0.2} ${apexY} ${rx} ${apexY + 6} Q ${rx + rootW * 0.2} ${apexY} ${rx + rootW / 2} ${topY + crownH} Z" fill="${dentin}"/>`;
    if (filled) {
      // The radiopaque obturation: a thin bright line down the canal.
      s += `<path d="M ${rx} ${topY + crownH + 6} L ${rx} ${apexY - 4}" stroke="hsl(90,12%,90%)" stroke-width="${4 * scale}" stroke-linecap="round" opacity="0.92"/>`;
    }
    if (halo && r === Math.floor(roots / 2)) {
      // The periapical radiolucency: a soft dark halo at the apex.
      s += `<circle cx="${rx}" cy="${apexY + 4}" r="${20 * scale}" fill="url(#halo)"/>`;
    }
  }
  return s;
}

function periapicalSvg(spec: RadiographSpec): string {
  const { w, h } = SIZES.periapical;
  const rng = mulberry32(spec.seed);
  const exposure = 0.82 + rng() * 0.3; // darker or brighter film
  const filled =
    spec.sequenceRole === "master_cone" ||
    spec.sequenceRole === "post_op" ||
    spec.sequenceRole === "recall";
  const halo =
    spec.hasHalo ??
    (spec.sequenceRole === "pre_op" || spec.sequenceRole == null
      ? rng() > 0.55
      : false);

  const roots = pickRoots(spec.toothNumber, rng);
  const teeth = [
    tooth(w * 0.3, h * 0.22, 1, Math.max(1, roots - 1), rng, false, false),
    tooth(w * 0.55, h * 0.18, 1.15, roots, rng, filled, halo),
    tooth(w * 0.8, h * 0.24, 0.95, Math.max(1, roots - 1), rng, false, false),
  ].join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <radialGradient id="film" cx="50%" cy="42%" r="75%">
      <stop offset="0%" stop-color="#2a2c2a"/>
      <stop offset="100%" stop-color="#0c0d0c"/>
    </radialGradient>
    <radialGradient id="halo" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="rgba(8,9,8,0.9)"/>
      <stop offset="70%" stop-color="rgba(12,13,12,0.5)"/>
      <stop offset="100%" stop-color="rgba(20,22,20,0)"/>
    </radialGradient>
    <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope="0.06"/></feComponentTransfer><feComposite operator="over" in2="SourceGraphic"/></filter>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#film)"/>
  <g opacity="${exposure}">
    <rect x="${w * 0.12}" y="${h * 0.1}" width="${w * 0.76}" height="${h * 0.82}" rx="14" fill="rgba(40,42,40,0.35)"/>
    ${teeth}
  </g>
  <rect width="${w}" height="${h}" filter="url(#grain)" opacity="0.5"/>
  ${watermark(w, h, true)}
</svg>`;
}

function panoramicSvg(spec: RadiographSpec): string {
  const { w, h } = SIZES.panoramic;
  const rng = mulberry32(spec.seed);
  let arch = "";
  const n = 16;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const x = w * (0.08 + t * 0.84);
    const y = h * (0.4 + Math.sin(t * Math.PI) * 0.28);
    arch += tooth(x, y - 40, 0.5 + rng() * 0.12, rng() > 0.5 ? 2 : 1, rng, false, false);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs><radialGradient id="film" cx="50%" cy="40%" r="80%"><stop offset="0%" stop-color="#262826"/><stop offset="100%" stop-color="#0b0c0b"/></radialGradient></defs>
  <rect width="${w}" height="${h}" fill="#0c0d0c"/>
  <rect width="${w}" height="${h}" fill="url(#film)" opacity="0.8"/>
  <g opacity="0.9">${arch}</g>
  ${watermark(w, h, true)}
</svg>`;
}

function cbctSvg(spec: RadiographSpec): string {
  const { w, h } = SIZES.cbct;
  const rng = mulberry32(spec.seed);
  const cx = w / 2 + (rng() - 0.5) * 60;
  const cy = h / 2 + (rng() - 0.5) * 60;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="#101210"/>
  <rect x="2" y="2" width="${w - 4}" height="${h - 4}" fill="none" stroke="#2e332e" stroke-width="2"/>
  <ellipse cx="${cx}" cy="${cy}" rx="${120 + rng() * 40}" ry="${150 + rng() * 40}" fill="hsl(95,6%,30%)" opacity="0.6"/>
  <ellipse cx="${cx}" cy="${cy}" rx="60" ry="80" fill="hsl(95,8%,46%)" opacity="0.7"/>
  <line x1="${cx}" y1="0" x2="${cx}" y2="${h}" stroke="#3a7d44" stroke-width="1" opacity="0.5"/>
  <line x1="0" y1="${cy}" x2="${w}" y2="${cy}" stroke="#3a7d44" stroke-width="1" opacity="0.5"/>
  <text x="14" y="26" font-family="monospace" font-size="14" fill="#7CB68A">CBCT axial</text>
  ${watermark(w, h, true)}
</svg>`;
}

function photoSvg(spec: RadiographSpec): string {
  const { w, h } = SIZES.intraoral_photo;
  const rng = mulberry32(spec.seed);
  let teeth = "";
  for (let i = 0; i < 6; i++) {
    const x = w * (0.12 + i * 0.14);
    teeth += `<rect x="${x}" y="${h * 0.3}" width="${w * 0.1}" height="${h * 0.34}" rx="8" fill="hsl(45, 30%, ${82 + rng() * 8}%)"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="hsl(350, 35%, 42%)"/>
  <rect x="0" y="${h * 0.62}" width="${w}" height="${h * 0.38}" fill="hsl(350, 40%, 36%)"/>
  <rect x="0" y="0" width="${w}" height="${h * 0.26}" fill="hsl(350, 38%, 50%)"/>
  ${teeth}
  ${watermark(w, h, false)}
</svg>`;
}

function documentSvg(spec: RadiographSpec): string {
  const { w, h } = SIZES.document_scan;
  let lines = "";
  const rng = mulberry32(spec.seed);
  for (let i = 0; i < 22; i++) {
    const y = 120 + i * 40;
    lines += `<rect x="80" y="${y}" width="${300 + rng() * 380}" height="10" rx="4" fill="#d8dad6"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="#f3f1ec"/>
  <rect x="60" y="48" width="320" height="22" rx="6" fill="#1E3A28"/>
  ${lines}
  ${watermark(w, h, false)}
</svg>`;
}

function pickRoots(toothNumber: number | undefined, rng: () => number): number {
  if (toothNumber == null) return rng() > 0.5 ? 2 : 1;
  // Molars (universal 1 to 3, 14 to 19, 30 to 32) get more roots.
  const molars = [1, 2, 3, 14, 15, 16, 17, 18, 19, 30, 31, 32];
  if (molars.includes(toothNumber)) return 3;
  const premolars = [4, 5, 12, 13, 20, 21, 28, 29];
  if (premolars.includes(toothNumber)) return 2;
  return 1;
}

function svgFor(spec: RadiographSpec): { svg: string; w: number; h: number } {
  switch (spec.type) {
    case "panoramic":
      return { svg: panoramicSvg(spec), ...SIZES.panoramic };
    case "cbct":
      return { svg: cbctSvg(spec), ...SIZES.cbct };
    case "intraoral_photo":
    case "extraoral_photo":
      return { svg: photoSvg(spec), ...SIZES.intraoral_photo };
    case "document_scan":
      return { svg: documentSvg(spec), ...SIZES.document_scan };
    case "bitewing":
    case "periapical":
    default:
      return { svg: periapicalSvg(spec), ...SIZES.periapical };
  }
}

// Renders the full image and a thumbnail. Returns PNG buffers and dimensions.
export async function renderRadiograph(spec: RadiographSpec): Promise<{
  original: Buffer;
  thumbnail: Buffer;
  width: number;
  height: number;
}> {
  const { svg, w, h } = svgFor(spec);
  const buf = Buffer.from(svg);
  const original = await sharp(buf).png().toBuffer();
  const thumbnail = await sharp(buf)
    .resize({ width: 360 })
    .png({ quality: 80 })
    .toBuffer();
  return { original, thumbnail, width: w, height: h };
}
