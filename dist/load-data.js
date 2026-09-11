// Hosting may deliver a .gz file as raw gzip or transparently decoded bytes.
export async function fetchBinary(url, { signal, onProgress, timeoutMs = 45000 } = {}) {
  const controller = new AbortController();
  const abort = () => controller.abort(signal?.reason);
  if (signal?.aborted) abort();
  else signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => controller.abort(new Error(`Loading timed out: ${url}`)), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`Could not load ${url} (HTTP ${response.status}).`);
    const parts = [];
    let size = 0;
    if (response.body) {
      const reader = response.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        parts.push(value); size += value.byteLength; onProgress?.(size);
      }
    } else {
      const part = new Uint8Array(await response.arrayBuffer());
      parts.push(part); size = part.byteLength; onProgress?.(size);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
    return bytes;
  } catch (error) {
    if (controller.signal.aborted) throw controller.signal.reason || new Error('Loading cancelled.');
    throw error;
  } finally {
    clearTimeout(timer); signal?.removeEventListener('abort', abort);
  }
}

export async function decodeGzip(bytes) {
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  if (typeof DecompressionStream === 'undefined') throw new Error('This browser cannot unpack the brain data. Use a current version of Chrome, Edge, Firefox, or Safari.');
  return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
}

export async function loadBinary(url, options) {
  return decodeGzip(await fetchBinary(url, options));
}
