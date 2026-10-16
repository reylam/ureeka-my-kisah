// One-off generator for the synthetic chest radiograph shown on the homepage.
//
// It is NOT a real radiograph and it is NOT drawn from a patient. It is a
// synthetic illustration assembled from anatomical masks and layered noise,
// rendered to a raster so it reads as a film rather than a vector drawing.
//
// The output is written to public/icons/radiograph-synthetic.png. The React
// component `RadiographArt` falls back to the older SVG illustration if the
// PNG is missing, so the build never depends on this script having been run.
//
//   npm install --no-save pngjs
//   node scripts/generate-radiograph.mjs
//
// The script is deterministic: same seed, same image.
import { writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';

const WIDTH = 768;
const HEIGHT = 768;
const SEED = 20261015;
const OUT = 'public/icons/radiograph-synthetic.png';

/* ── Deterministic RNG (mulberry32) ─────────────────────────────────────── */
let rngState = SEED;
function rand() {
  rngState |= 0;
  rngState = (rngState + 0x6d2b79f5) | 0;
  let t = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/* ── Value noise with bilinear interpolation and octaves ────────────────── */
function makeNoiseLayer(gridW, gridH, scale = 1) {
  const cols = Math.ceil(WIDTH / gridW) + 2;
  const rows = Math.ceil(HEIGHT / gridH) + 2;
  const grid = new Float32Array(cols * rows);
  for (let i = 0; i < grid.length; i += 1) grid[i] = rand();
  return { cols, rows, grid, gridW, gridH, scale };
}

function sampleNoise(layer, x, y) {
  const gx = (x / layer.gridW) * layer.scale;
  const gy = (y / layer.gridH) * layer.scale;
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const fx = gx - x0;
  const fy = gy - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const i00 = layer.grid[y0 * layer.cols + x0];
  const i10 = layer.grid[y0 * layer.cols + x0 + 1];
  const i01 = layer.grid[(y0 + 1) * layer.cols + x0];
  const i11 = layer.grid[(y0 + 1) * layer.cols + x0 + 1];
  const a = i00 + (i10 - i00) * sx;
  const b = i01 + (i11 - i01) * sx;
  return a + (b - a) * sy; // 0..1
}

function fbm(layers, x, y) {
  let sum = 0;
  let amp = 1;
  let total = 0;
  for (const layer of layers) {
    sum += sampleNoise(layer, x, y) * amp;
    total += amp;
    amp *= 0.5;
  }
  return sum / total; // 0..1
}

/* ── Pixel field ────────────────────────────────────────────────────────── */
const pixels = new Float32Array(WIDTH * HEIGHT).fill(0.03);

// Noise layers: coarse = broad density, fine = film grain.
const coarse = makeNoiseLayer(48, 48, 0.9);
const coarse2 = makeNoiseLayer(96, 96, 1.1);
const fine = makeNoiseLayer(12, 12, 1.4);
const speckle = makeNoiseLayer(3, 3, 1.8);

const noiseLayers = [coarse, coarse2, fine];

/* ── Anatomical masks ───────────────────────────────────────────────────── */
function inEllipse(cx, cy, rx, ry, x, y) {
  const dx = (x - cx) / rx;
  const dy = (y - cy) / ry;
  return dx * dx + dy * dy;
}

function gaussian(value, sigma) {
  return Math.exp(-(value * value) / (2 * sigma * sigma));
}

// Left/right hemithorax, mirrored.
function lungMask(x, y) {
  // Lungs occupy roughly y 90..600, widening then tapering to the costophrenic
  // angles. Slight left/right asymmetry.
  const cy = y - 330;
  const half = Math.abs(x - 384);
  const upper = 90 + 40 * Math.max(0, (330 - y) / 240);
  const outerLeft = 118 - 20 * Math.cos((y - 90) / 510 * Math.PI) + 8 * Math.sin(y / 90);
  const outerRight = 118 - 20 * Math.cos((y - 90) / 510 * Math.PI) - 6 * Math.sin(y / 80);
  const outer = x < 384 ? outerLeft : outerRight;
  const inner = 96 + 14 * Math.cos((y - 110) / 490 * Math.PI);
  const inX = half >= inner && half <= outer;
  const inY = y >= 92 && y <= 612;
  const fade = gaussian(Math.max(0, half - (outer - 26)), 26) * gaussian(Math.max(0, inner - half), 22);
  const vertFade = gaussian(Math.max(0, y - 600), 20) * gaussian(Math.max(0, 92 - y), 16);
  return inX && inY ? fade * vertFade : 0;
}

function mediastinumMask(x, y) {
  // Central column containing trachea, aortic knob, heart.
  const half = Math.abs(x - 384);
  const spine = half < 26 && y > 60 && y < 610;
  const heartLeft = y > 300 && y < 560 && x < 400 && x > 384 - (98 - (y - 300) * 0.12);
  const heartRight = y > 330 && y < 540 && x > 384 && x < 384 + (82 - (y - 330) * 0.1);
  const aorticKnob = inEllipse(360, 250, 26, 34, x, y) < 1;
  const upperMedi = half < 44 && y > 60 && y < 320;
  const mask = spine || heartLeft || heartRight || aorticKnob || upperMedi;
  const edge = gaussian(Math.abs(x - 384) - 44, 12) * gaussian(Math.abs(y - 310) - 260, 18);
  return mask ? 1 : edge * 0.4;
}

function diaphragmMask(x, y) {
  // Dome of the diaphragm, higher on the right.
  const domeL = 560 - 30 * Math.cos((x - 384) / 260 * Math.PI * 0.6);
  const domeR = 548 - 34 * Math.cos((x - 384) / 260 * Math.PI * 0.6);
  const dome = x < 384 ? domeL : domeR;
  const below = y > dome;
  const edge = gaussian(y - dome, 16);
  return below ? 1 : edge * 0.55;
}

function boneBase(x, y) {
  // Broad shoulder/soft-tissue frame.
  const shoulder = inEllipse(384, 240, 330, 250, x, y) < 1;
  const neck = inEllipse(384, 40, 120, 90, x, y) < 1;
  return shoulder || neck ? 0.16 : 0.03;
}

/* ── Bone structures ────────────────────────────────────────────────────── */
function clavicleMask(x, y, side) {
  // Slightly curved clavicles.
  const s = side === 'left' ? -1 : 1;
  const cx = 384 + s * 150;
  const cy = 118 + 26 * Math.cos(s * (x - 384) / 300 * Math.PI * 0.5);
  const dy = y - cy;
  const along = Math.abs(x - cx) < 130;
  return along && Math.abs(dy) < 9 ? gaussian(dy, 4) : 0;
}

function ribMask(x, y) {
  // Ribs as arcs sloping down from spine to lateral chest wall.
  // Each rib i has centreline y = y0 + slope * half, where slope increases
  // inferiorly, mimicking real rib obliquity.
  const half = Math.abs(x - 384);
  const spine = 384;
  let intensity = 0;
  for (let i = 0; i < 9; i += 1) {
    const y0 = 118 + i * 52;
    const lateral = 96 + i * 22;
    const slope = 0.34 + i * 0.012;
    const arcY = y0 + slope * half;
    const dy = y - arcY;
    const width = 3.6 + i * 0.15;
    const near = Math.abs(dy) < width;
    const within = half > 34 && half < lateral;
    if (near && within) intensity = Math.max(intensity, gaussian(dy, 1.8));
  }
  return intensity;
}

function scapulaMask(x, y, side) {
  const s = side === 'left' ? -1 : 1;
  const cx = 384 + s * 150;
  const cy = 150;
  const dx = x - cx;
  const dy = y - cy;
  const inTri = dy > 0 && dy < 150 && Math.abs(dx) < 60 - dy * 0.25;
  const edge = gaussian(Math.abs(dx) - (60 - dy * 0.25), 6) * gaussian(dy, 14);
  return inTri ? 1 : edge * 0.5;
}

function spineMask(x, y) {
  const half = Math.abs(x - 384);
  if (y < 60 || y > 610) return 0;
  const verte = 12 + 3 * Math.sin(y / 26);
  const body = half < verte ? 1 : gaussian(half - verte, 3);
  const spinous = half < 4 ? 0.8 : 0;
  return Math.max(body, spinous);
}

/* ── Radiographic noise / texture ───────────────────────────────────────── */
function boneTexture(x, y, base) {
  // Trabecular/cortical texture: speckle plus streaks.
  const streak = sampleNoise(speckle, x * 0.8 + base * 50, y * 0.5);
  const speck = sampleNoise(speckle, x * 1.6, y * 1.6);
  return (streak * 0.55 + speck * 0.45) * 0.22;
}

function lungTexture(x, y) {
  // Bronchovascular markings: fine striations radiating from hila.
  const hilumL = inEllipse(330, 300, 60, 90, x, y);
  const hilumR = inEllipse(438, 300, 60, 90, x, y);
  const hilum = Math.min(hilumL, hilumR);
  const streak = sampleNoise(fine, x * 0.7, y * 0.7);
  const radial = sampleNoise(fine, x * 0.3 + 200, y * 0.3);
  const markings = (streak * 0.5 + radial * 0.5) * (0.18 + 0.5 * gaussian(Math.sqrt(hilum), 1.1));
  return markings;
}

/* ── Compose ────────────────────────────────────────────────────────────── */
for (let y = 0; y < HEIGHT; y += 1) {
  for (let x = 0; x < WIDTH; x += 1) {
    // Slight rotation/translation distortion for a natural acquisition feel.
    const cx = x - 384;
    const cy = y - 330;
    const rot = -0.012;
    const dx = cx * Math.cos(rot) - cy * Math.sin(rot) + 384 + 2.5;
    const dy = cx * Math.sin(rot) + cy * Math.cos(rot) + 330 - 1.5;

    let intensity = boneBase(dx, dy);

    // Lung fields are dark (air), with bronchovascular markings.
    const lung = lungMask(dx, dy);
    intensity += lung * (0.42 + lungTexture(dx, dy));
    intensity -= lung * 0.34; // keep lungs radiolucent

    // Mediastinum and diaphragm are soft-tissue bright.
    intensity += mediastinumMask(dx, dy) * 0.5;
    intensity += diaphragmMask(dx, dy) * 0.55;

    // Bones.
    intensity += clavicleMask(dx, dy, 'left') * 0.62;
    intensity += clavicleMask(dx, dy, 'right') * 0.62;
    intensity += ribMask(dx, dy) * 0.6;
    intensity += spineMask(dx, dy) * 0.5;
    intensity += scapulaMask(dx, dy, 'left') * 0.28;
    intensity += scapulaMask(dx, dy, 'right') * 0.28;

    // Calcific/bone texture modulated by where bone already is.
    const boneLevel = Math.max(0, intensity - 0.45);
    intensity += boneLevel * boneTexture(dx, dy, boneLevel);

    // Coarse density variation (patient habitus, exposure falloff).
    intensity += (fbm(noiseLayers, dx, dy) - 0.5) * 0.2;

    // Vignette so edges fall to black like a real film.
    const vignette = 1 - Math.pow((cx / 384) * (cx / 384) + (cy / 330) * (cy / 330), 1.1) * 0.55;
    intensity *= vignette;

    // Film grain.
    intensity += (sampleNoise(fine, x, y) - 0.5) * 0.05;
    intensity += (sampleNoise(speckle, x * 2.1, y * 2.1) - 0.5) * 0.025;

    pixels[y * WIDTH + x] = Math.max(0, Math.min(1, intensity));
  }
}

/* ── Output: PNG with slight film-tone curve ────────────────────────────── */
function filmCurve(value) {
  // Lift blacks slightly, compress highlights, add subtle warm tint.
  const lifted = Math.pow(value, 0.92);
  const r = lifted * 255;
  const g = lifted * 253;
  const b = lifted * 248;
  return [r, g, b];
}

const png = new PNG({ width: WIDTH, height: HEIGHT });
for (let y = 0; y < HEIGHT; y += 1) {
  for (let x = 0; x < WIDTH; x += 1) {
    const [r, g, b] = filmCurve(pixels[y * WIDTH + x]);
    const i = (y * WIDTH + x) * 4;
    png.data[i] = r;
    png.data[i + 1] = g;
    png.data[i + 2] = b;
    png.data[i + 3] = 255;
  }
}

writeFileSync(OUT, PNG.sync.write(png));
console.log(`wrote ${OUT} (${WIDTH}x${HEIGHT})`);
