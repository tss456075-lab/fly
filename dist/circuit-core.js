// Shiu-style LIF dynamics in mV and ms, adapted to a browser.
// This is a circuit intervention model, not a pharmacological model.
export const PARAMETERS = Object.freeze({
  dt: 0.1, resting: -52, reset: -52, threshold: -45,
  membraneTau: 20, synapticTau: 5, refractory: 2.2,
  delay: 1.8, weightPerContact: 0.275, inputWeight: 68.75,
  binMs: 10,
});

export function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function advanceVoltage(voltage, drive, dt = PARAMETERS.dt) {
  const em = Math.exp(-dt / PARAMETERS.membraneTau);
  const eg = Math.exp(-dt / PARAMETERS.synapticTau);
  const coupling = PARAMETERS.synapticTau / (PARAMETERS.synapticTau - PARAMETERS.membraneTau) * (eg - em);
  return [PARAMETERS.resting + (voltage - PARAMETERS.resting) * em + drive * coupling, drive * eg];
}

function checkIndices(indices, n, name) {
  if (!Array.isArray(indices) && !ArrayBuffer.isView(indices)) throw new Error(`${name} must be a list of cells.`);
  const result = [...new Set(indices)];
  if (result.some(i => !Number.isInteger(i) || i < 0 || i >= n)) throw new Error(`${name} contains an invalid cell index.`);
  return result;
}

export function validateTrial(config, n) {
  const { duration, rate, seed, gain = 1, input = [], targets = [] } = config;
  if (!Number.isFinite(duration) || duration <= 0 || duration > 1000 || !Number.isInteger(duration * 10)) throw new Error('Trial length must be between 0.1 and 1,000 ms.');
  if (!Number.isFinite(rate) || rate < 0 || rate > 150) throw new Error('Input rate must be between 0 and 150 Hz.');
  if (!Number.isInteger(seed) || seed < 1 || seed > 2147483647) throw new Error('Random seed must be a whole number from 1 to 2147483647.');
  if (!Number.isFinite(gain) || gain < 0 || gain > 2) throw new Error('Signal strength must be between 0% and 200%.');
  return { ...config, gain, input: checkIndices(input, n, 'Input'), targets: checkIndices(targets, n, 'Target') };
}

export function createTrial(graph, rawConfig) {
  const n = graph.n;
  const config = validateTrial(rawConfig, n);
  const p = PARAMETERS;
  const steps = Math.round(config.duration / p.dt);
  const bins = new Uint32Array(Math.ceil(config.duration / p.binMs));
  const counts = new Uint32Array(n);
  const v = new Float64Array(n); v.fill(p.resting);
  const g = new Float64Array(n);
  const refractoryUntil = new Int32Array(n);
  const active = new Uint32Array(n);
  const activeFlags = new Uint8Array(n);
  const driven = new Uint8Array(n);
  const gains = new Float64Array(n); gains.fill(1);
  for (const i of config.targets) gains[i] = config.gain;
  let activeCount = 0, step = 0, total = 0;
  const activate = i => { if (!activeFlags[i]) { activeFlags[i] = 1; active[activeCount++] = i; } };
  for (const i of config.input) { activate(i); driven[i] = 1; }
  const random = seededRandom(config.seed);
  const delaySteps = Math.round(p.delay / p.dt);
  const refractorySteps = Math.round(p.refractory / p.dt);
  const queue = Array.from({ length: delaySteps + 1 }, () => []);
  const em = Math.exp(-p.dt / p.membraneTau);
  const eg = Math.exp(-p.dt / p.synapticTau);
  const coupling = p.synapticTau / (p.synapticTau - p.membraneTau) * (eg - em);
  const inputProbability = config.rate * p.dt / 1000;
  const spikes = [];

  // Advance in bounded slices; the worker yields between slices for cancellation.
  function advance(maxSteps = 20) {
    const end = Math.min(steps, step + maxSteps);
    for (; step < end; step++) {
      spikes.length = 0;
      for (let a = 0; a < activeCount; a++) {
        const i = active[a];
        if (step < refractoryUntil[i]) continue;
        v[i] = p.resting + (v[i] - p.resting) * em + g[i] * coupling;
        g[i] *= eg;
        if (v[i] > p.threshold) spikes.push(i);
      }
      // Synaptic events occur after the threshold check and before resets.
      const arrivals = queue[step % queue.length];
      for (let a = 0; a < arrivals.length; a++) {
        const source = arrivals[a], scale = p.weightPerContact * gains[source];
        if (scale === 0) continue;
        for (let edge = graph.offsets[source]; edge < graph.offsets[source + 1]; edge++) {
          const target = graph.targets[edge];
          g[target] += graph.weights[edge] * scale;
          activate(target);
        }
      }
      arrivals.length = 0;
      for (const i of config.input) if (random() < inputProbability) v[i] += p.inputWeight;
      const future = queue[(step + delaySteps) % queue.length];
      for (const i of spikes) {
        counts[i]++; total++;
        bins[Math.min(bins.length - 1, Math.floor(step * p.dt / p.binMs))]++;
        v[i] = p.reset; g[i] = 0;
        refractoryUntil[i] = step + (driven[i] ? 0 : refractorySteps);
        future.push(i);
      }
    }
    return step === steps;
  }

  function result() {
    if (step !== steps) throw new Error('Trial has not completed.');
    let responding = 0;
    for (let i = 0; i < n; i++) if (counts[i]) responding++;
    return { counts, bins, total, responding, duration: config.duration, binMs: p.binMs, seed: config.seed, config, parameters: p };
  }
  return { advance, result, get progress() { return step / steps; } };
}
