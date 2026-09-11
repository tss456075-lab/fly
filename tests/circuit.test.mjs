import test from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { createTrial, advanceVoltage } from '../dist/circuit-core.js';
import { decodeGzip, fetchBinary } from '../dist/load-data.js';

const graph = { n: 2, offsets: Uint32Array.of(0, 1, 1), targets: Uint32Array.of(1), weights: Int16Array.of(400) };
const settings = { input: [0], targets: [], duration: 200, rate: 150, seed: 42, gain: 1 };
function run(config = settings, network = graph) { const trial = createTrial(network, config); while (!trial.advance(100)); return trial.result(); }

test('resting network remains silent without input', () => {
  const r = run({ ...settings, input: [] });
  assert.equal(r.total, 0); assert.equal(r.responding, 0);
});
test('zero-frequency input remains silent', () => assert.equal(run({ ...settings, rate: 0 }).total, 0));
test('same seed and neutral intervention reproduce identical activity', () => {
  const control = run(); const neutral = run({ ...settings, targets: [0, 1], gain: 1 });
  assert.deepEqual(control.counts, neutral.counts); assert.deepEqual(control.bins, neutral.bins);
  assert.ok(control.counts[0] > 0); assert.ok(control.counts[1] > 0);
  assert.equal(control.total, [...control.bins].reduce((a,b) => a+b, 0));
});
test('silencing source output blocks downstream activity while preserving input spikes', () => {
  const control = run(); const silenced = run({ ...settings, targets: [0], gain: 0 });
  assert.equal(control.counts[0], silenced.counts[0]); assert.equal(silenced.counts[1], 0);
});
test('inhibitory contact sign is preserved', () => {
  const r = run(settings, { ...graph, weights: Int16Array.of(-400) });
  assert.ok(r.counts[0] > 0); assert.equal(r.counts[1], 0);
});
test('linear voltage update agrees with the passive membrane solution', () => {
  const [v,g] = advanceVoltage(-45, 0, 20);
  assert.ok(Math.abs(v - (-52 + 7 / Math.E)) < 1e-12); assert.equal(g, 0);
});
test('invalid settings fail before allocating or running', () => {
  assert.throws(() => run({ ...settings, seed: NaN }), /seed/);
  assert.throws(() => run({ ...settings, gain: -1 }), /strength/);
  assert.throws(() => run({ ...settings, input: [2] }), /invalid cell/);
});
test('asset decoder handles both raw gzip and HTTP-decoded bytes', async () => {
  const text = new TextEncoder().encode('{"loaded":true}');
  for (const bytes of [text, gzipSync(text)]) {
    assert.equal(new TextDecoder().decode(await decodeGzip(bytes)), '{"loaded":true}');
  }
});
test('missing network assets report a useful error', async () => {
  const saved = globalThis.fetch;
  globalThis.fetch = async () => new Response('Missing', { status: 404 });
  try { await assert.rejects(fetchBinary('missing.bin.gz'), /HTTP 404/); }
  finally { globalThis.fetch = saved; }
});
test('hung asset request times out instead of loading forever', async () => {
  const saved = globalThis.fetch;
  globalThis.fetch = async (_, { signal }) => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
  try { await assert.rejects(fetchBinary('hung.bin.gz', { timeoutMs: 10 }), /timed out/); }
  finally { globalThis.fetch = saved; }
});
