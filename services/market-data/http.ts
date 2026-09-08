/**
 * @fileOverview Shared transport helpers for market data providers.
 * Isomorphic: safe to run on the server (route handlers) and in the browser
 * (service-layer fallback when a provider is unreachable from the edge region).
 */

export class ProviderError extends Error {
  constructor(
    public provider: string,
    message: string,
    public status?: number,
    /** True for transient conditions (429 / 5xx / timeout) worth retrying. */
    public retryable = false,
  ) {
    super(`[${provider}] ${message}`)
    this.name = 'ProviderError'
  }
}

const DEFAULT_TIMEOUT = 8000
/** Public endpoints (Yahoo especially) throttle bursts; a short retry clears it. */
const DEFAULT_RETRIES = 2

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const isRetryableStatus = (status: number) => status === 429 || status === 408 || status >= 500

async function requestOnce<T>(
  provider: string,
  url: string,
  init: RequestInit & { timeout?: number },
): Promise<T> {
  const { timeout = DEFAULT_TIMEOUT, ...rest } = init
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    const res = await fetch(url, {
      ...rest,
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        // `*/*` avoids Yahoo's stricter JSON-only throttling bucket.
        accept: '*/*',
        'accept-language': 'en-US,en;q=0.9',
        // Some public endpoints (Yahoo) reject requests without a UA.
        'user-agent': UA,
        ...(rest.headers as Record<string, string> | undefined),
      },
    })
    const text = await res.text()
    if (!res.ok) {
      throw new ProviderError(
        provider,
        `HTTP ${res.status}: ${text.slice(0, 160)}`,
        res.status,
        isRetryableStatus(res.status),
      )
    }
    try {
      return JSON.parse(text) as T
    } catch {
      // Geo-blocked CDNs answer with non-JSON bodies.
      throw new ProviderError(provider, `Invalid JSON: ${text.slice(0, 160)}`)
    }
  } catch (err: any) {
    if (err instanceof ProviderError) throw err
    const timedOut = err?.name === 'AbortError'
    throw new ProviderError(
      provider,
      timedOut ? 'Request timed out' : String(err?.message ?? err),
      undefined,
      // Network blips and timeouts are worth one more attempt.
      true,
    )
  } finally {
    clearTimeout(timer)
  }
}

export async function fetchJson<T>(
  provider: string,
  url: string,
  init: RequestInit & { timeout?: number; retries?: number } = {},
): Promise<T> {
  const { retries = DEFAULT_RETRIES, ...rest } = init
  let lastError: ProviderError | undefined

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await requestOnce<T>(provider, url, rest)
    } catch (err) {
      lastError = err as ProviderError
      if (!lastError.retryable || attempt === retries) break
      // Exponential backoff with jitter keeps us inside free-tier limits.
      await sleep(250 * 2 ** attempt + Math.random() * 150)
    }
  }

  throw lastError ?? new ProviderError(provider, 'Unknown transport failure')
}

/* -------------------------------------------------------------------------- */
/* Tiny TTL cache — keeps us inside free-tier rate limits                     */
/* -------------------------------------------------------------------------- */

interface Entry<T> {
  value: T
  expires: number
}

const store = new Map<string, Entry<unknown>>()
const inflight = new Map<string, Promise<unknown>>()

export async function cached<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  const now = Date.now()
  const hit = store.get(key) as Entry<T> | undefined
  if (hit && hit.expires > now) return hit.value

  const pending = inflight.get(key) as Promise<T> | undefined
  if (pending) return pending

  const promise = loader()
    .then((value) => {
      store.set(key, { value, expires: Date.now() + ttlMs })
      return value
    })
    .finally(() => {
      inflight.delete(key)
    })

  inflight.set(key, promise)
  return promise
}

/** Last-known-good value, used when every provider for an asset fails. */
export function peekCache<T>(key: string): T | undefined {
  return (store.get(key) as Entry<T> | undefined)?.value
}

/** Overwrite a cache entry (used for last-known-good snapshots). */
export function putCache<T>(key: string, value: T, ttlMs: number) {
  store.set(key, { value, expires: Date.now() + ttlMs })
}

export const chunk = <T,>(items: T[], size: number): T[][] => {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}
