// One-off asset step: lift the mascot off its white background and crop it to
// its own bounds, so it can sit on the near-black page without a white tile
// around it.
//
// A plain "make every near-white pixel transparent" pass would also eat the
// mascot's own highlights, which are nearly white: the trachea and the
// airways. So this flood-fills inward from the image border instead, and only
// clears background that is actually connected to the edge.
//
// Kept in the repo so the provenance of `mascot-cutout.png` is traceable and
// the crop can be redone if the artwork changes. It is not part of the build
// and `pngjs` is not a project dependency:
//
//   npm install --no-save pngjs
//   node scripts/prepare-mascot.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';

// Writes a new file rather than overwriting, so the original artwork stays
// where it is and this can be re-run with different thresholds.
const SOURCE = 'public/icons/mascot.png';
const TARGET = 'public/icons/mascot-cutout.png';

const png = PNG.sync.read(readFileSync(SOURCE));
const { width, height, data } = png;
const at = (x, y) => (y * width + x) * 4;

// Report what we started with, so the decision is visible in the log.
const corner = at(0, 0);
console.log(
  `source ${width}x${height}, corner rgba(${data[corner]}, ${data[corner + 1]}, ${data[corner + 2]}, ${data[corner + 3]})`,
);

// Background test: bright and barely tinted. The mascot is distinctly blue
// even in its palest areas, so a saturation floor separates the two better
// than brightness alone.
const isBackground = (index) => {
  const r = data[index];
  const g = data[index + 1];
  const b = data[index + 2];
  const a = data[index + 3];
  if (a === 0) return true;
  const min = Math.min(r, g, b);
  const max = Math.max(r, g, b);
  return min > 236 && max - min < 10;
};

// Flood fill from every border pixel.
const cleared = new Uint8Array(width * height);
const stack = [];
for (let x = 0; x < width; x += 1) {
  stack.push([x, 0], [x, height - 1]);
}
for (let y = 0; y < height; y += 1) {
  stack.push([0, y], [width - 1, y]);
}

let removed = 0;
while (stack.length) {
  const [x, y] = stack.pop();
  if (x < 0 || y < 0 || x >= width || y >= height) continue;
  const flat = y * width + x;
  if (cleared[flat]) continue;
  const index = at(x, y);
  if (!isBackground(index)) continue;
  cleared[flat] = 1;
  data[index + 3] = 0;
  removed += 1;
  stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
}

console.log(`cleared ${removed} background pixels (${((removed / (width * height)) * 100).toFixed(1)}%)`);

// Soften the cut edge: any kept pixel touching a cleared one gets its alpha
// pulled down a little, which stops the silhouette looking stamped out.
const alphaCopy = new Uint8Array(width * height);
for (let i = 0; i < width * height; i += 1) alphaCopy[i] = data[i * 4 + 3];
for (let y = 1; y < height - 1; y += 1) {
  for (let x = 1; x < width - 1; x += 1) {
    const flat = y * width + x;
    if (cleared[flat] || alphaCopy[flat] === 0) continue;
    const touching =
      cleared[flat - 1] || cleared[flat + 1] || cleared[flat - width] || cleared[flat + width];
    if (touching) data[flat * 4 + 3] = Math.round(alphaCopy[flat] * 0.55);
  }
}

// Crop to content, with a small breathing margin.
let minX = width;
let minY = height;
let maxX = -1;
let maxY = -1;
for (let y = 0; y < height; y += 1) {
  for (let x = 0; x < width; x += 1) {
    if (data[at(x, y) + 3] > 8) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
}

const pad = 8;
minX = Math.max(0, minX - pad);
minY = Math.max(0, minY - pad);
maxX = Math.min(width - 1, maxX + pad);
maxY = Math.min(height - 1, maxY + pad);

const outWidth = maxX - minX + 1;
const outHeight = maxY - minY + 1;
console.log(`cropping to ${outWidth}x${outHeight} at (${minX}, ${minY})`);

const cropped = new PNG({ width: outWidth, height: outHeight });
for (let y = 0; y < outHeight; y += 1) {
  for (let x = 0; x < outWidth; x += 1) {
    const from = at(minX + x, minY + y);
    const to = (y * outWidth + x) * 4;
    cropped.data[to] = data[from];
    cropped.data[to + 1] = data[from + 1];
    cropped.data[to + 2] = data[from + 2];
    cropped.data[to + 3] = data[from + 3];
  }
}

// Downscale. The mascot is never shown wider than 128 CSS pixels, so 1 254px
// of source is about ten times more than any screen needs, and it was costing
// 420 kB on a page that only uses it as decoration.
//
// Box filter, averaging in premultiplied alpha. Averaging straight RGBA
// instead would pull the colour of fully transparent pixels into the edge and
// leave a dark fringe around the whole silhouette.
const MAX_WIDTH = 384;
const scale = Math.min(1, MAX_WIDTH / outWidth);
const finalWidth = Math.max(1, Math.round(outWidth * scale));
const finalHeight = Math.max(1, Math.round(outHeight * scale));

const out = new PNG({ width: finalWidth, height: finalHeight });
for (let y = 0; y < finalHeight; y += 1) {
  const y0 = Math.floor((y * outHeight) / finalHeight);
  const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * outHeight) / finalHeight));
  for (let x = 0; x < finalWidth; x += 1) {
    const x0 = Math.floor((x * outWidth) / finalWidth);
    const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * outWidth) / finalWidth));

    let r = 0;
    let g = 0;
    let b = 0;
    let a = 0;
    let n = 0;
    for (let sy = y0; sy < y1; sy += 1) {
      for (let sx = x0; sx < x1; sx += 1) {
        const i = (sy * outWidth + sx) * 4;
        const alpha = cropped.data[i + 3] / 255;
        r += cropped.data[i] * alpha;
        g += cropped.data[i + 1] * alpha;
        b += cropped.data[i + 2] * alpha;
        a += alpha;
        n += 1;
      }
    }

    const to = (y * finalWidth + x) * 4;
    const meanAlpha = a / n;
    out.data[to + 3] = Math.round(meanAlpha * 255);
    if (a > 0) {
      out.data[to] = Math.min(255, Math.round(r / a));
      out.data[to + 1] = Math.min(255, Math.round(g / a));
      out.data[to + 2] = Math.min(255, Math.round(b / a));
    }
  }
}

writeFileSync(TARGET, PNG.sync.write(out));
console.log(`wrote ${TARGET} at ${finalWidth}x${finalHeight}`);
