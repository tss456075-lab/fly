import { fetchBinary, decodeGzip } from './load-data.js';
import { createTrial } from './circuit-core.js';

let graph = null, busy = false, cancelled = false, aborter = null;
const emit = (type, fields = {}) => self.postMessage({ type, ...fields });
const yieldToMessages = () => new Promise(resolve => setTimeout(resolve, 0));

async function loadGraph(manifest) {
  if (graph) return graph;
  const n = manifest.neurons, edges = manifest.connections;
  const offsetsFile = manifest.assets.find(a => a.file === 'offsets.bin.gz');
  const assets = [offsetsFile, ...manifest.edge_chunks.map(c => manifest.assets.find(a => a.file === c.file))];
  const totalBytes = assets.reduce((sum, a) => sum + a.bytes, 0);
  let loaded = 0;
  aborter = new AbortController();
  const get = async asset => {
    if (cancelled) throw new Error('Trial cancelled.');
    const bytes = await fetchBinary(`data/${asset.file}`, {
      signal: aborter.signal,
      onProgress: received => emit('loading', { progress: Math.min(.99, (loaded + received) / totalBytes), message: `Loading connections · ${((loaded + received) / 1e6).toFixed(1)} / ${(totalBytes / 1e6).toFixed(1)} MB` }),
    });
    // Validate stored compressed bytes when HTTP has not decoded them already.
    if (bytes[0] === 0x1f && bytes[1] === 0x8b && self.crypto?.subtle) {
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      const hash = [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, '0')).join('');
      if (hash !== asset.sha256) throw new Error(`Data integrity check failed: ${asset.file}. Please redeploy all files.`);
    }
    loaded += asset.bytes;
    return decodeGzip(bytes);
  };
  const offsets = new Uint32Array(await get(offsetsFile));
  if (offsets.length !== n + 1 || offsets[0] !== 0 || offsets[n] !== edges) throw new Error('The connection index is incomplete. Please include every data file.');
  for (let i = 1; i <= n; i++) if (offsets[i] < offsets[i - 1]) throw new Error('Invalid connection index.');
  const targets = new Uint32Array(edges), weights = new Int16Array(edges);
  let next = 0;
  for (const chunk of manifest.edge_chunks) {
    if (chunk.start !== next) throw new Error('A connection chunk is missing.');
    const asset = manifest.assets.find(a => a.file === chunk.file);
    const raw = new Int32Array(await get(asset));
    if (raw.length !== chunk.count * 2) throw new Error(`Incomplete data: ${chunk.file}.`);
    for (let j = 0; j < chunk.count; j++) {
      const to = raw[j * 2], weight = raw[j * 2 + 1];
      if (to < 0 || to >= n || weight < -32768 || weight > 32767) throw new Error(`Invalid connection in ${chunk.file}.`);
      targets[chunk.start + j] = to; weights[chunk.start + j] = weight;
    }
    next += chunk.count;
    await yieldToMessages();
  }
  if (next !== edges) throw new Error('The connection matrix is incomplete.');
  if (cancelled) throw new Error('Trial cancelled.');
  graph = { n, offsets, targets, weights };
  emit('loaded', { neurons: n, connections: edges });
  return graph;
}

self.onmessage = async ({ data }) => {
  if (data.type === 'cancel') { cancelled = true; aborter?.abort(new Error('Trial cancelled.')); return; }
  if (data.type !== 'run' || busy) return;
  busy = true; cancelled = false;
  try {
    const g = await loadGraph(data.manifest);
    for (let run = 0; run < data.trials.length; run++) {
      const trial = createTrial(g, data.trials[run]);
      let done = false, lastUpdate = -1;
      while (!done) {
        if (cancelled) throw new Error('Trial cancelled.');
        // Keep each worker slice bounded even for a large activated network.
        const until = performance.now() + 30;
        do { done = trial.advance(2); } while (!done && performance.now() < until);
        const percentage = Math.floor(trial.progress * 100);
        if (percentage !== lastUpdate) {
          lastUpdate = percentage;
          emit('progress', { run, progress: trial.progress, overall: (run + trial.progress) / data.trials.length, message: `Running ${run === 0 ? 'control' : 'hypothesis'} · ${percentage}%` });
        }
        await yieldToMessages();
      }
      const result = trial.result();
      emit('result', { run, result });
    }
    emit('done');
  } catch (error) {
    emit(cancelled ? 'cancelled' : 'error', { message: error?.message || String(error) });
  } finally { busy = false; aborter = null; }
};
