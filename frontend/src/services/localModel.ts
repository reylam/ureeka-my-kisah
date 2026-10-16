import type { ClassLabel, LesionRegion, ScreeningAnalysis } from '@/types/domain';
import { CLASS_LABELS, analysisFromProbabilities } from '@/lib/screeningAnalysis';

/**
 * The screening model, running in the browser.
 *
 * The network (`public/models/tb_student.onnx`, exported from the checkpoint in
 * `model/` by `inference/export_onnx.py`) runs on ONNX Runtime Web's WebAssembly
 * backend. The image never leaves the device, and nothing here needs a server or
 * a Python process, so the whole screening step ships as static files.
 *
 * Everything heavy loads on first use: the runtime and the 6 MB model are
 * dynamic imports and fetches, so a visitor who never opens the demo or runs a
 * screening downloads none of it. `preloadLocalModel()` lets a page start that
 * early.
 *
 * Preprocessing must match what the network was trained and exported with, or
 * its scores drift. It is the same as `inference/serve.py`: RGB, resized to
 * 224 x 224 with a bilinear filter that averages over the source pixels it
 * covers (the Pillow behaviour, not the browser's canvas scaling), ImageNet
 * mean and standard deviation. The sizes and constants are read from the JSON
 * written next to the model, so the exporter and this file cannot drift apart.
 */

interface ModelMeta {
  labels: ClassLabel[];
  imageSize: number;
  mean: [number, number, number];
  std: [number, number, number];
  backbone: string;
  source: string;
  version: string;
}

type Ort = typeof import('onnxruntime-web/wasm');
type Session = import('onnxruntime-web/wasm').InferenceSession;

interface Loaded {
  ort: Ort;
  session: Session;
  meta: ModelMeta;
}

const MODEL_URL = '/models/tb_student.onnx';
const META_URL = '/models/tb_student.json';

/** Whether this browser can run the model at all. */
export function localModelSupported(): boolean {
  return (
    typeof WebAssembly !== 'undefined' &&
    typeof createImageBitmap === 'function' &&
    typeof document !== 'undefined'
  );
}

let loading: Promise<Loaded> | null = null;

async function loadModel(): Promise<Loaded> {
  const [ort, wasm, metaResponse] = await Promise.all([
    import('onnxruntime-web/wasm'),
    import('onnxruntime-web/ort-wasm-simd-threaded.wasm?url'),
    fetch(META_URL),
  ]);
  if (!metaResponse.ok) throw new Error('Model description could not be downloaded.');
  const meta = (await metaResponse.json()) as ModelMeta;
  if (meta.labels.join('|') !== CLASS_LABELS.join('|')) {
    // The scores are mapped to labels by position, so a reordered export would
    // quietly swap what they mean. Refuse rather than guess.
    throw new Error('The model was exported with a different label order than this app expects.');
  }

  // Vite fingerprints the runtime's WebAssembly file, so say where it ended up.
  ort.env.wasm.wasmPaths = { wasm: wasm.default };
  // Threads need cross-origin isolation headers, which a static host does not
  // send by default. One thread is plenty for a 2-million-parameter network.
  ort.env.wasm.numThreads = 1;

  const modelResponse = await fetch(`${MODEL_URL}?v=${encodeURIComponent(meta.version)}`);
  if (!modelResponse.ok) throw new Error('The model file could not be downloaded.');
  const bytes = new Uint8Array(await modelResponse.arrayBuffer());

  const session = await ort.InferenceSession.create(bytes, { executionProviders: ['wasm'] });
  return { ort, session, meta };
}

function ensureLoaded(): Promise<Loaded> {
  if (!loading) {
    loading = loadModel().catch((cause: unknown) => {
      // A failed load should be retryable (a dropped connection, say), not
      // remembered for the rest of the session.
      loading = null;
      throw cause;
    });
  }
  return loading;
}

/** Start downloading the runtime and model without waiting for them. */
export function preloadLocalModel(): void {
  if (localModelSupported()) void ensureLoaded().catch(() => undefined);
}

/* ── Preprocessing ─────────────────────────────────────────────────────── */

async function decode(blob: Blob): Promise<{ data: Uint8ClampedArray; width: number; height: number }> {
  let bitmap: ImageBitmap;
  try {
    // No EXIF rotation and no colour-profile conversion, matching a plain
    // Pillow `open().convert("RGB")`.
    bitmap = await createImageBitmap(blob, { imageOrientation: 'none', colorSpaceConversion: 'none' });
  } catch {
    throw new Error('The image could not be read. It may be corrupt or not a JPEG or PNG.');
  }
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    bitmap.close();
    throw new Error('This browser did not provide a 2D canvas.');
  }
  context.drawImage(bitmap, 0, 0);
  const { width, height } = bitmap;
  bitmap.close();
  return { data: context.getImageData(0, 0, width, height).data, width, height };
}

interface Kernel {
  /** First source index and tap count for each output sample. */
  first: Int32Array;
  count: Int32Array;
  /** `maxTaps` weights per output sample, already normalised. */
  weights: Float32Array;
  maxTaps: number;
}

/**
 * Bilinear (triangle) filter coefficients, laid out the way Pillow computes
 * them: when shrinking, the filter is stretched by the scale factor so every
 * source pixel under an output pixel contributes.
 */
function buildKernel(inSize: number, outSize: number): Kernel {
  const scale = inSize / outSize;
  const filterScale = Math.max(scale, 1);
  const support = filterScale; // the bilinear filter's radius is 1
  const maxTaps = Math.ceil(support) * 2 + 1;

  const first = new Int32Array(outSize);
  const count = new Int32Array(outSize);
  const weights = new Float32Array(outSize * maxTaps);

  for (let out = 0; out < outSize; out += 1) {
    const center = (out + 0.5) * scale;
    const lo = Math.max(0, Math.trunc(center - support + 0.5));
    const hi = Math.min(inSize, Math.trunc(center + support + 0.5));
    let total = 0;
    for (let tap = 0; tap < hi - lo; tap += 1) {
      const distance = Math.abs((tap + lo - center + 0.5) / filterScale);
      const weight = distance < 1 ? 1 - distance : 0;
      weights[out * maxTaps + tap] = weight;
      total += weight;
    }
    if (total > 0) for (let tap = 0; tap < hi - lo; tap += 1) weights[out * maxTaps + tap]! /= total;
    first[out] = lo;
    count[out] = hi - lo;
  }
  return { first, count, weights, maxTaps };
}

const clamp8 = (value: number): number => (value <= 0 ? 0 : value >= 255 ? 255 : Math.round(value));

/**
 * RGBA pixels to a size x size RGB image. Horizontal pass first and rounded to
 * 8 bits in between, as Pillow does, so the result lands within a level or two
 * of what the Python service sees.
 */
function resizeRgb(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  size: number,
): Uint8Array {
  const across = buildKernel(width, size);
  const down = buildKernel(height, size);

  const middle = new Uint8Array(size * height * 3);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * width * 4;
    for (let x = 0; x < size; x += 1) {
      const lo = across.first[x]!;
      const taps = across.count[x]!;
      const base = x * across.maxTaps;
      let r = 0;
      let g = 0;
      let b = 0;
      for (let tap = 0; tap < taps; tap += 1) {
        const weight = across.weights[base + tap]!;
        const at = rowStart + (lo + tap) * 4;
        r += rgba[at]! * weight;
        g += rgba[at + 1]! * weight;
        b += rgba[at + 2]! * weight;
      }
      const to = (y * size + x) * 3;
      middle[to] = clamp8(r);
      middle[to + 1] = clamp8(g);
      middle[to + 2] = clamp8(b);
    }
  }

  const output = new Uint8Array(size * size * 3);
  for (let y = 0; y < size; y += 1) {
    const lo = down.first[y]!;
    const taps = down.count[y]!;
    const base = y * down.maxTaps;
    for (let x = 0; x < size; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let tap = 0; tap < taps; tap += 1) {
        const weight = down.weights[base + tap]!;
        const at = ((lo + tap) * size + x) * 3;
        r += middle[at]! * weight;
        g += middle[at + 1]! * weight;
        b += middle[at + 2]! * weight;
      }
      const to = (y * size + x) * 3;
      output[to] = clamp8(r);
      output[to + 1] = clamp8(g);
      output[to + 2] = clamp8(b);
    }
  }
  return output;
}

/** Interleaved RGB bytes to a normalised channel-first float tensor. */
function toTensorData(rgb: Uint8Array, size: number, meta: ModelMeta): Float32Array {
  const plane = size * size;
  const data = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i += 1) {
    for (let c = 0; c < 3; c += 1) {
      data[c * plane + i] = (rgb[i * 3 + c]! / 255 - meta.mean[c]!) / meta.std[c]!;
    }
  }
  return data;
}

function softmax(logits: ArrayLike<number>): number[] {
  const peak = Math.max(...Array.from(logits));
  const exps = Array.from(logits, (value) => Math.exp(value - peak));
  const total = exps.reduce((sum, value) => sum + value, 0);
  return exps.map((value) => value / total);
}

/* ── Running the network ───────────────────────────────────────────────── */

async function logitsFor({ ort, session, meta }: Loaded, data: Float32Array): Promise<number[]> {
  const input = new ort.Tensor('float32', data, [1, 3, meta.imageSize, meta.imageSize]);
  const outputs = await session.run({ [session.inputNames[0]!]: input });
  return Array.from(outputs[session.outputNames[0]!]!.data as Float32Array);
}

async function scoresFor(loaded: Loaded, data: Float32Array): Promise<number[]> {
  return softmax(await logitsFor(loaded, data));
}

/**
 * Log-odds of one class against the other two. Unlike the probability, it
 * keeps moving when the model is very sure: a TB score of 0.9999 hardly
 * changes when an area is covered, its log-odds do.
 */
function logOdds(logits: number[], index: number): number {
  const others = logits.filter((_, i) => i !== index);
  const peak = Math.max(...others);
  const rest = peak + Math.log(others.reduce((sum, value) => sum + Math.exp(value - peak), 0));
  return logits[index]! - rest;
}

function toProbabilities(scores: number[]): Record<ClassLabel, number> {
  const probabilities = {} as Record<ClassLabel, number>;
  CLASS_LABELS.forEach((label, index) => {
    probabilities[label] = scores[index] ?? 0;
  });
  return probabilities;
}

function identity(meta: ModelMeta) {
  return { name: 'tb_student.onnx', version: meta.version, backbone: meta.backbone };
}

async function prepare(image: Blob, meta: ModelMeta): Promise<Uint8Array> {
  const { data, width, height } = await decode(image);
  return resizeRgb(data, width, height, meta.imageSize);
}

/* ── Localisation (occlusion) ──────────────────────────────────────────── */

/**
 * Where the network looked, worked out from the network itself.
 *
 * The model is a classifier: it returns three scores and no boxes. To show
 * which part of the film drove a score, each patch of the 224 x 224 input is
 * covered in turn with a blurred copy of itself and the network is run again.
 * Where covering an area makes the leading class's log-odds fall, that area
 * was carrying the score. The fall, averaged over every patch that covers a
 * pixel, is the heat map; the boxes are the connected areas of high heat, and
 * each box is grounded to the class whose score it carried. A box's score is
 * its weight against the strongest area, 1 for the strongest.
 *
 * So a box means "the score depends on this area", not "a lesion is here". It
 * is the model's evidence, which a reader can check against the film, not a
 * finding. Blurring rather than painting grey keeps the brightness of the area,
 * so what is removed is the structure in it, not the fact that it is lung.
 */

const PATCH = 44;
const STRIDE = 20;
const BLUR_RADIUS = 10;
/** A fall in log-odds smaller than this is treated as noise. */
const MIN_DROP = 0.15;
/** Heat above this share of the peak belongs to a box. */
const BOX_CUT = 0.5;
/** Areas smaller than this share of the image are not boxed. */
const MIN_AREA = 0.008;
const MAX_REGIONS = 3;

/** Two passes of a separable box blur, which is close to a Gaussian. */
function blurRgb(rgb: Uint8Array, size: number, radius: number): Uint8Array {
  let source = rgb;
  for (let pass = 0; pass < 2; pass += 1) {
    const across = new Uint8Array(source.length);
    const down = new Uint8Array(source.length);
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const lo = Math.max(0, x - radius);
        const hi = Math.min(size - 1, x + radius);
        for (let c = 0; c < 3; c += 1) {
          let total = 0;
          for (let k = lo; k <= hi; k += 1) total += source[(y * size + k) * 3 + c]!;
          across[(y * size + x) * 3 + c] = Math.round(total / (hi - lo + 1));
        }
      }
    }
    for (let y = 0; y < size; y += 1) {
      const lo = Math.max(0, y - radius);
      const hi = Math.min(size - 1, y + radius);
      for (let x = 0; x < size; x += 1) {
        for (let c = 0; c < 3; c += 1) {
          let total = 0;
          for (let k = lo; k <= hi; k += 1) total += across[(k * size + x) * 3 + c]!;
          down[(y * size + x) * 3 + c] = Math.round(total / (hi - lo + 1));
        }
      }
    }
    source = down;
  }
  return source;
}

/**
 * Smooth a single-channel field. The averaged occlusion map steps every
 * STRIDE pixels; this takes the grid out of it before it is cut into boxes.
 */
function smoothField(field: Float32Array, size: number, radius: number): Float32Array {
  let source = field;
  for (let pass = 0; pass < 2; pass += 1) {
    const across = new Float32Array(source.length);
    const down = new Float32Array(source.length);
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const lo = Math.max(0, x - radius);
        const hi = Math.min(size - 1, x + radius);
        let total = 0;
        for (let k = lo; k <= hi; k += 1) total += source[y * size + k]!;
        across[y * size + x] = total / (hi - lo + 1);
      }
    }
    for (let y = 0; y < size; y += 1) {
      const lo = Math.max(0, y - radius);
      const hi = Math.min(size - 1, y + radius);
      for (let x = 0; x < size; x += 1) {
        let total = 0;
        for (let k = lo; k <= hi; k += 1) total += across[k * size + x]!;
        down[y * size + x] = total / (hi - lo + 1);
      }
    }
    source = down;
  }
  return source;
}

/** Patch origins along one axis, ending flush with the edge. */
function origins(size: number): number[] {
  const out: number[] = [];
  for (let at = 0; at + PATCH <= size; at += STRIDE) out.push(at);
  if (out[out.length - 1] !== size - PATCH) out.push(size - PATCH);
  return out;
}

/**
 * Plain-language position on the film. Radiographs are viewed as if facing the
 * patient, so the patient's right is the left of the picture. Mirrors
 * `zoneFor` in the API.
 */
export function zoneFor(box: LesionRegion['box']): string {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const side = cx < 0.5 ? 'kanan' : 'kiri';
  const level = cy < 1 / 3 ? 'atas' : cy < 2 / 3 ? 'tengah' : 'bawah';
  return `zona ${side} ${level}`;
}

interface Component {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  area: number;
  peak: number;
}

/** Connected areas of `mask` (4-neighbour), as boxes with their peak heat. */
function components(mask: Uint8Array, heat: Float32Array, size: number): Component[] {
  const seen = new Uint8Array(mask.length);
  const stack = new Int32Array(mask.length);
  const found: Component[] = [];

  for (let start = 0; start < mask.length; start += 1) {
    if (!mask[start] || seen[start]) continue;
    let top = 0;
    stack[top++] = start;
    seen[start] = 1;
    const box: Component = { x0: size, y0: size, x1: 0, y1: 0, area: 0, peak: 0 };
    while (top > 0) {
      const at = stack[--top]!;
      const x = at % size;
      const y = (at - x) / size;
      box.area += 1;
      box.peak = Math.max(box.peak, heat[at]!);
      box.x0 = Math.min(box.x0, x);
      box.y0 = Math.min(box.y0, y);
      box.x1 = Math.max(box.x1, x);
      box.y1 = Math.max(box.y1, y);
      const neighbours = [
        x > 0 ? at - 1 : -1,
        x < size - 1 ? at + 1 : -1,
        y > 0 ? at - size : -1,
        y < size - 1 ? at + size : -1,
      ];
      for (const n of neighbours) {
        if (n >= 0 && mask[n] && !seen[n]) {
          seen[n] = 1;
          stack[top++] = n;
        }
      }
    }
    found.push(box);
  }
  return found;
}

/** The heat map as a translucent amber image, for laying over the film. */
function heatmapImage(heat: Float32Array, size: number, peak: number): string | null {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) return null;
  const pixels = context.createImageData(size, size);
  for (let i = 0; i < heat.length; i += 1) {
    const share = Math.min(1, Math.max(0, heat[i]!) / peak);
    pixels.data[i * 4] = 245;
    pixels.data[i * 4 + 1] = 158;
    pixels.data[i * 4 + 2] = 11;
    pixels.data[i * 4 + 3] = Math.round(share * share * 190);
  }
  context.putImageData(pixels, 0, 0);
  return canvas.toDataURL('image/png');
}

const nextTask = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function abortError(): Error {
  return new DOMException('The analysis was cancelled.', 'AbortError');
}

interface Localisation {
  regions: LesionRegion[];
  heatmapUrl: string | null;
}

async function localise(
  loaded: Loaded,
  rgb: Uint8Array,
  target: ClassLabel,
  { onProgress, signal }: { onProgress?: (share: number) => void; signal?: AbortSignal },
): Promise<Localisation> {
  const { meta } = loaded;
  const size = meta.imageSize;
  const plane = size * size;
  const targetIndex = CLASS_LABELS.indexOf(target);

  const sharp = toTensorData(rgb, size, meta);
  const baseline = logOdds(await logitsFor(loaded, sharp), targetIndex);
  const blurred = toTensorData(blurRgb(rgb, size, BLUR_RADIUS), size, meta);

  const sum = new Float32Array(plane);
  const count = new Uint16Array(plane);
  const xs = origins(size);
  const ys = origins(size);
  const total = xs.length * ys.length;
  let done = 0;

  for (const oy of ys) {
    for (const ox of xs) {
      if (signal?.aborted) throw abortError();
      const data = sharp.slice();
      for (let c = 0; c < 3; c += 1) {
        for (let y = oy; y < oy + PATCH; y += 1) {
          const row = c * plane + y * size;
          data.set(blurred.subarray(row + ox, row + ox + PATCH), row + ox);
        }
      }
      const drop = baseline - logOdds(await logitsFor(loaded, data), targetIndex);
      for (let y = oy; y < oy + PATCH; y += 1) {
        for (let x = ox; x < ox + PATCH; x += 1) {
          sum[y * size + x]! += drop;
          count[y * size + x]! += 1;
        }
      }
      done += 1;
      onProgress?.(done / total);
      // Let the page paint the progress bar between runs.
      if (done % 4 === 0) await nextTask();
    }
  }

  const averaged = new Float32Array(plane);
  for (let i = 0; i < plane; i += 1) averaged[i] = count[i] ? sum[i]! / count[i]! : 0;
  const heat = smoothField(averaged, size, STRIDE / 2);
  let peak = 0;
  for (let i = 0; i < plane; i += 1) peak = Math.max(peak, heat[i]!);
  if (peak < MIN_DROP) return { regions: [], heatmapUrl: null };

  const cut = Math.max(peak * BOX_CUT, MIN_DROP);
  const mask = new Uint8Array(plane);
  for (let i = 0; i < plane; i += 1) mask[i] = heat[i]! >= cut ? 1 : 0;

  const regions = components(mask, heat, size)
    .filter((found) => found.area >= MIN_AREA * plane)
    .sort((a, b) => b.peak - a.peak)
    .slice(0, MAX_REGIONS)
    .map((found, index): LesionRegion => {
      // The input was stretched to a square, so shares of it map straight back
      // onto the original image whatever its aspect.
      const box = {
        x: found.x0 / size,
        y: found.y0 / size,
        width: (found.x1 - found.x0 + 1) / size,
        height: (found.y1 - found.y0 + 1) / size,
      };
      return {
        id: `occ-${index + 1}`,
        box,
        score: Math.min(1, found.peak / peak),
        zone: zoneFor(box),
        label: target,
      };
    });

  return { regions, heatmapUrl: heatmapImage(heat, size, peak) };
}

/* ── Public API ────────────────────────────────────────────────────────── */

/** Class probabilities for one image, straight from the network. */
export async function classifyImage(image: Blob): Promise<{
  probabilities: Record<ClassLabel, number>;
  model: { name: string; version: string; backbone: string };
}> {
  if (!localModelSupported()) {
    throw new Error('This browser cannot run the screening model.');
  }
  const loaded = await ensureLoaded();
  const rgb = await prepare(image, loaded.meta);
  const scores = await scoresFor(loaded, toTensorData(rgb, loaded.meta.imageSize, loaded.meta));
  return { probabilities: toProbabilities(scores), model: identity(loaded.meta) };
}

export interface LocalScreening {
  analysis: ScreeningAnalysis;
  /** Heat map behind the boxes, stretched to the image, when there are any. */
  heatmapUrl: string | null;
}

/**
 * Run the model on an image and describe the result as a screening analysis.
 *
 * When the leading class is not "Healthy" (TB, or sick but not TB), the areas
 * that carried that score are found by occlusion and returned as regions, each
 * grounded to that class. A "Healthy" result gets no boxes: there is nothing
 * it would be pointing at.
 */
export async function screenImageLocally(
  image: Blob,
  {
    onStage,
    onProgress,
    signal,
  }: {
    onStage?: (stage: 'analyse' | 'localise') => void;
    onProgress?: (share: number) => void;
    signal?: AbortSignal;
  } = {},
): Promise<LocalScreening> {
  if (!localModelSupported()) {
    throw new Error('This browser cannot run the screening model.');
  }
  onStage?.('analyse');
  const loaded = await ensureLoaded();
  const rgb = await prepare(image, loaded.meta);
  const scores = await scoresFor(loaded, toTensorData(rgb, loaded.meta.imageSize, loaded.meta));
  const analysis = analysisFromProbabilities(toProbabilities(scores), identity(loaded.meta));
  const target = analysis.predictedLabel;

  if (target === 'Healthy') {
    return {
      analysis: {
        ...analysis,
        detectionNote: 'Kelas teratas adalah Sehat, jadi tidak ada area yang ditandai.',
      },
      heatmapUrl: null,
    };
  }

  if (signal?.aborted) throw abortError();
  onStage?.('localise');
  const found = await localise(loaded, rgb, target, { onProgress, signal });
  return {
    analysis: {
      ...analysis,
      regions: found.regions,
      detectionNote: found.regions.length
        ? null
        : 'Menutup bagian mana pun hampir tidak mengubah score kelas ini, jadi model tidak bertumpu pada satu area tertentu dan tidak ada kotak yang digambar.',
    },
    heatmapUrl: found.heatmapUrl,
  };
}
