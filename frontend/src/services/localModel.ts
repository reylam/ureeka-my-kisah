import type { ClassLabel, ScreeningAnalysis } from '@/types/domain';
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

/* ── Public API ────────────────────────────────────────────────────────── */

/** Class probabilities for one image, straight from the network. */
export async function classifyImage(image: Blob): Promise<{
  probabilities: Record<ClassLabel, number>;
  model: { name: string; version: string; backbone: string };
}> {
  if (!localModelSupported()) {
    throw new Error('This browser cannot run the screening model.');
  }
  const { ort, session, meta } = await ensureLoaded();

  const { data, width, height } = await decode(image);
  const rgb = resizeRgb(data, width, height, meta.imageSize);
  const input = new ort.Tensor('float32', toTensorData(rgb, meta.imageSize, meta), [
    1,
    3,
    meta.imageSize,
    meta.imageSize,
  ]);

  const inputName = session.inputNames[0]!;
  const outputName = session.outputNames[0]!;
  const outputs = await session.run({ [inputName]: input });
  const scores = softmax(outputs[outputName]!.data as Float32Array);

  const probabilities = {} as Record<ClassLabel, number>;
  CLASS_LABELS.forEach((label, index) => {
    probabilities[label] = scores[index] ?? 0;
  });
  return {
    probabilities,
    model: { name: 'tb_student.onnx', version: meta.version, backbone: meta.backbone },
  };
}

/** Run the model on an image and describe the result as a screening analysis. */
export async function analyseImageLocally(image: Blob): Promise<ScreeningAnalysis> {
  const { probabilities, model } = await classifyImage(image);
  return analysisFromProbabilities(probabilities, model);
}
