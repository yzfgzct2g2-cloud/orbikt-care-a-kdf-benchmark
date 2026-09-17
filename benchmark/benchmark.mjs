export const BENCHMARK_CONFIG = Object.freeze({
  candidates: Object.freeze([300000, 600000, 1200000]),
  warmups: 5,
  runs: 25,
  inputBytes: 32,
  saltBytes: 16,
  derivedKeyBits: 256,
})

const failureName = (error) => {
  if (error && typeof error.name === 'string' && error.name.length > 0) {
    return error.name.slice(0, 80)
  }
  return 'OperationError'
}

const defaultRandomBytes = (cryptoApi, byteLength) =>
  cryptoApi.getRandomValues(new Uint8Array(byteLength))

const defaultDeriveKey = ({ subtle, material, iterations, salt }) =>
  subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', iterations, salt },
    material,
    { name: 'AES-GCM', length: BENCHMARK_CONFIG.derivedKeyBits },
    false,
    ['encrypt', 'decrypt'],
  )

export function summarizeSamples(samples) {
  if (samples.length === 0) {
    throw new Error('NO_SAMPLES')
  }

  const sorted = [...samples].sort((left, right) => left - right)
  return {
    medianMs: sorted[Math.floor(sorted.length / 2)],
    p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1],
    minMs: sorted[0],
    maxMs: sorted.at(-1),
    samplesMs: [...samples],
  }
}

export function createRunController(run) {
  let running = false

  return {
    get running() {
      return running
    },
    async run(...args) {
      if (running) {
        throw new Error('BENCHMARK_BUSY')
      }

      running = true
      try {
        return await run(...args)
      } finally {
        running = false
      }
    },
  }
}

export async function runSession({
  crypto: cryptoApi = globalThis.crypto,
  performance: performanceApi = globalThis.performance,
  randomBytes = (byteLength) => defaultRandomBytes(cryptoApi, byteLength),
  deriveKey = defaultDeriveKey,
  onProgress,
} = {}) {
  if (!cryptoApi?.subtle || typeof cryptoApi.getRandomValues !== 'function') {
    throw new Error('WEB_CRYPTO_UNAVAILABLE')
  }
  if (!performanceApi || typeof performanceApi.now !== 'function') {
    throw new Error('PERFORMANCE_CLOCK_UNAVAILABLE')
  }

  const startedAt = new Date().toISOString()
  const input = randomBytes(BENCHMARK_CONFIG.inputBytes)
  let material
  try {
    material = await cryptoApi.subtle.importKey(
      'raw',
      input,
      'PBKDF2',
      false,
      ['deriveKey'],
    )
  } finally {
    input.fill(0)
  }

  const candidates = []
  for (let candidateIndex = 0; candidateIndex < BENCHMARK_CONFIG.candidates.length; candidateIndex += 1) {
    const iterations = BENCHMARK_CONFIG.candidates[candidateIndex]
    const samples = []
    const failures = []

    for (let runIndex = 0; runIndex < BENCHMARK_CONFIG.warmups + BENCHMARK_CONFIG.runs; runIndex += 1) {
      const salt = randomBytes(BENCHMARK_CONFIG.saltBytes)
      const measured = runIndex >= BENCHMARK_CONFIG.warmups
      const start = measured ? performanceApi.now() : 0

      try {
        await deriveKey({
          subtle: cryptoApi.subtle,
          material,
          iterations,
          salt,
        })
        if (measured) {
          samples.push(performanceApi.now() - start)
        }
      } catch (error) {
        failures.push({
          candidate: iterations,
          phase: measured ? 'measured' : 'warmup',
          run: measured ? runIndex - BENCHMARK_CONFIG.warmups + 1 : runIndex + 1,
          errorName: failureName(error),
        })
      }

      onProgress?.({
        candidate: iterations,
        candidateIndex,
        run: runIndex + 1,
        totalRuns: BENCHMARK_CONFIG.warmups + BENCHMARK_CONFIG.runs,
        measured,
      })
    }

    candidates.push({
      iterations,
      ...(samples.length > 0
        ? summarizeSamples(samples)
        : {
            medianMs: null,
            p95Ms: null,
            minMs: null,
            maxMs: null,
            samplesMs: [],
          }),
      failures,
    })
  }

  return {
    startedAt,
    finishedAt: new Date().toISOString(),
    candidates,
  }
}
