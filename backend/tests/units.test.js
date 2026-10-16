import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../src/config/env.js';
import { toAnalysis, zoneFor, createInferenceClient } from '../src/services/inferenceService.js';
import { readImageSize } from '../src/services/imageInfo.js';
import { sanitizeSearch, toRange, pageMeta } from '../src/utils/pagination.js';
import { sniffImage } from '../src/middleware/upload.js';
import { fromDbError, ApiError } from '../src/utils/ApiError.js';
import { TEST_ENV } from './helpers/fakeGateway.js';

describe('configuration', () => {
  test('reads a valid environment', () => {
    const config = loadConfig({ ...TEST_ENV, FRONTEND_ORIGIN: 'http://a.test/, http://b.test' });
    assert.deepEqual(config.frontendOrigins, ['http://a.test', 'http://b.test']);
    assert.equal(config.inference.url, null);
    assert.equal(config.storage.maxUploadBytes, 15 * 1024 * 1024);
  });

  test('stops with a readable message when a variable is missing', () => {
    assert.throws(
      () => loadConfig({ ...TEST_ENV, SUPABASE_SERVICE_ROLE_KEY: undefined }),
      /SUPABASE_SERVICE_ROLE_KEY/,
    );
  });
});

// Shape of predict() in train/tb-train/tb_ai/infer.py
const MODEL_REPLY = {
  image: 'film.png',
  prediction: 'TB',
  probabilities: { Healthy: 0.04, 'Sick-non-TB': 0.11, TB: 0.85 },
  model: { classifier: 'densenet121-tbx11k', backbone: 'densenet121' },
  disclaimer: 'Research use only.',
  detection: {
    n_lesions: 2,
    boxes: [
      { box_xyxy: [100, 40, 220, 160], score: 0.91 },
      { box_xyxy: [600, 400, 700, 520], score: 0.72 },
    ],
    score_threshold: 0.6,
    skipped: false,
    reason: null,
  },
};

describe('model response mapping', () => {
  test('maps the service reply to the frontend analysis shape', () => {
    const analysis = toAnalysis(MODEL_REPLY, { width: 800, height: 600 }, new Date('2026-03-01T00:00:00Z'));
    assert.equal(analysis.predictedLabel, 'TB');
    assert.equal(analysis.outcome, 'flagged-for-review');
    assert.equal(analysis.simulated, false);
    assert.equal(analysis.model.validation, null, 'no performance claim without a real evaluation');
    assert.deepEqual(analysis.probabilities, MODEL_REPLY.probabilities);
    assert.equal(analysis.regions.length, 2);
    const box = analysis.regions[0].box;
    for (const [key, expected] of Object.entries({ x: 0.125, y: 40 / 600, width: 0.15, height: 0.2 })) {
      assert.ok(Math.abs(box[key] - expected) < 1e-9, key);
    }
    assert.equal(analysis.analysedAt, '2026-03-01T00:00:00.000Z');
  });

  test('reports no alert for a confident healthy reading and inconclusive for a weak one', () => {
    const healthy = toAnalysis(
      { ...MODEL_REPLY, prediction: 'Healthy', probabilities: { Healthy: 0.97, 'Sick-non-TB': 0.02, TB: 0.01 }, detection: { skipped: true, reason: 'not TB', boxes: [] } },
      { width: 800, height: 600 },
    );
    assert.equal(healthy.outcome, 'no-alert');
    assert.equal(healthy.regions.length, 0);
    assert.equal(healthy.detectionNote, 'not TB');

    const weak = toAnalysis(
      { ...MODEL_REPLY, probabilities: { Healthy: 0.34, 'Sick-non-TB': 0.33, TB: 0.33 }, prediction: 'Healthy' },
      { width: 800, height: 600 },
    );
    assert.equal(weak.outcome, 'inconclusive');
  });

  test('refuses a reply that is not in the expected format instead of repairing it', () => {
    assert.throws(() => toAnalysis({ prediction: 'TB' }, null), (e) => e.code === 'MODEL_BAD_RESPONSE');
    assert.throws(
      () => toAnalysis({ ...MODEL_REPLY, probabilities: { Healthy: 2, 'Sick-non-TB': 0, TB: 0 } }, null),
      (e) => e.code === 'MODEL_BAD_RESPONSE',
    );
  });

  test('zones follow radiograph convention (patient right is picture left)', () => {
    assert.equal(zoneFor({ x: 0.05, y: 0.05, width: 0.2, height: 0.2 }), 'right upper zone');
    assert.equal(zoneFor({ x: 0.7, y: 0.7, width: 0.2, height: 0.2 }), 'left lower zone');
  });

  test('the client answers "not connected" without a URL, and never calls out', async () => {
    const client = createInferenceClient({ url: null, timeoutMs: 1000 }, () => assert.fail('no request'));
    assert.equal(client.configured, false);
    await assert.rejects(client.analyze({ bytes: Buffer.alloc(1), mime: 'image/png' }), (e) => e.code === 'MODEL_NOT_CONNECTED');
  });

  test('a failing or unreachable service becomes a 502, not a crash', async () => {
    const down = createInferenceClient({ url: 'http://x.test/predict', timeoutMs: 100 }, async () => {
      throw new Error('ECONNREFUSED');
    });
    await assert.rejects(down.analyze({ bytes: Buffer.alloc(1), mime: 'image/png' }), (e) => e.status === 502 && e.code === 'MODEL_UNREACHABLE');
    const broken = createInferenceClient({ url: 'http://x.test/predict', timeoutMs: 100 }, async () => ({ ok: false }));
    await assert.rejects(broken.analyze({ bytes: Buffer.alloc(1), mime: 'image/png' }), (e) => e.code === 'MODEL_ERROR');
  });
});

describe('real model output', () => {
  test('the reply recorded from tb_ai.serve maps cleanly and exposes no server path', async () => {
    const { readFileSync } = await import('node:fs');
    const raw = JSON.parse(readFileSync(new URL('./fixtures/model-reply.real.json', import.meta.url), 'utf8'));
    const analysis = toAnalysis(raw, { width: 1024, height: 1024 });
    assert.equal(analysis.simulated, false);
    assert.equal(analysis.predictedLabel, raw.prediction);
    assert.equal(analysis.model.name, 'tb_cls.pt');
    assert.equal(analysis.model.version, raw.model.version);
    assert.equal(analysis.model.validation, null);
    assert.doesNotMatch(JSON.stringify(analysis), /[A-Za-z]:\\|\/Users\//);
  });

  test('a path in the model name is reduced to the file name', () => {
    const reply = { ...MODEL_REPLY, model: { classifier: 'C:\\secret\\dir\\tb_cls.pt', backbone: 'densenet121' } };
    assert.equal(toAnalysis(reply, { width: 10, height: 10 }).model.name, 'tb_cls.pt');
  });

  test('the API key is sent as a Bearer token', async () => {
    let seen;
    const client = createInferenceClient({ url: 'http://x.test/predict', timeoutMs: 100, apiKey: 'k'.repeat(20) }, async (_url, init) => {
      seen = init.headers;
      return { ok: true, json: async () => ({}) };
    });
    await client.analyze({ bytes: Buffer.alloc(1), mime: 'image/png' });
    assert.equal(seen.Authorization, 'Bearer ' + 'k'.repeat(20));
  });
});

describe('image handling', () => {
  test('identifies images from content, not from names', () => {
    assert.equal(sniffImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]))?.mime, 'image/jpeg');
    assert.equal(sniffImage(Buffer.from('GIF89a......'))?.mime, undefined);
    assert.equal(sniffImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')), null);
  });

  test('reads PNG dimensions', () => {
    const png = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]),
      Buffer.from([0, 0, 0x03, 0x20, 0, 0, 0x02, 0x58]),
      Buffer.alloc(8),
    ]);
    assert.deepEqual(readImageSize(png), { width: 800, height: 600 });
  });

  test('reads JPEG dimensions from the frame header', () => {
    const jpeg = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x4a, 0x46, // APP0 (length 4)
      0xff, 0xc0, 0x00, 0x11, 0x08, 0x01, 0x80, 0x02, 0x00, 0x03, // SOF0: 384 high, 512 wide
      0, 0, 0, 0, 0, 0, 0, 0,
    ]);
    assert.deepEqual(readImageSize(jpeg), { width: 512, height: 384 });
  });

  test('returns null for garbage', () => {
    assert.equal(readImageSize(Buffer.alloc(40)), null);
  });
});

describe('helpers', () => {
  test('pagination ranges and metadata', () => {
    assert.deepEqual(toRange({ page: 3, pageSize: 20 }), { from: 40, to: 59 });
    assert.deepEqual(pageMeta({ page: 1, pageSize: 20 }, 0), { page: 1, pageSize: 20, total: 0, pageCount: 1 });
  });

  test('search text loses filter syntax', () => {
    assert.equal(sanitizeSearch(' a,b(c)*d%e\\f:"g\' '), 'a b c d e f g');
  });

  test('database error mapping', () => {
    assert.equal(fromDbError({ code: 'PGRST116' }).status, 404);
    assert.equal(fromDbError({ code: '23505' }).status, 409);
    assert.equal(fromDbError({ code: '42501', message: 'permission denied for table x' }).message, 'You do not have access to this resource.');
    assert.equal(fromDbError({ code: 'XX000' }), null);
    assert.ok(fromDbError(ApiError.notFound()) instanceof ApiError);
  });
});
