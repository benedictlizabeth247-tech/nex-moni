const OKX_BASE_URL = "https://www.okx.com/api/v5"

type Quote = { base: "USDT"; quote: "NGN" | "USD"; rate: number | null; source: "OKX"; receivedAt: string | null; expiresAt: string | null; stale: boolean; status: "live" | "unavailable" }

type CacheEntry = { value: Quote; expiresAt: number }
const cache = new Map<string, CacheEntry>()
const TTL_MS = 30_000

async function fetchOkxQuote(quote: "NGN" | "USD"): Promise<Quote> {
  const now = new Date()
  const instruments = await fetch(`${OKX_BASE_URL}/public/instruments?instType=SPOT`, { next: { revalidate: 30 } }).then((response) => response.json()) as { data?: Array<{ instId?: string }> }
  const instrument = instruments.data?.find((item) => item.instId === `USDT-${quote}`)
  if (!instrument) return { base: "USDT", quote, rate: null, source: "OKX", receivedAt: null, expiresAt: null, stale: false, status: "unavailable" }
  const ticker = await fetch(`${OKX_BASE_URL}/market/ticker?instId=${encodeURIComponent(instrument.instId!)}`, { next: { revalidate: 30 } }).then((response) => response.json()) as { data?: Array<{ last?: string }> }
  const rate = Number(ticker.data?.[0]?.last)
  if (!Number.isFinite(rate) || rate <= 0) return { base: "USDT", quote, rate: null, source: "OKX", receivedAt: null, expiresAt: null, stale: false, status: "unavailable" }
  const receivedAt = now.toISOString()
  return { base: "USDT", quote, rate, source: "OKX", receivedAt, expiresAt: new Date(now.getTime() + TTL_MS).toISOString(), stale: false, status: "live" }
}

export async function getLiveRate(quote: "NGN" | "USD"): Promise<Quote> {
  const cached = cache.get(quote)
  if (cached && cached.expiresAt > Date.now()) return cached.value
  const value: Quote = await fetchOkxQuote(quote).catch(() => ({ base: "USDT" as const, quote, rate: null, source: "OKX" as const, receivedAt: null, expiresAt: null, stale: false, status: "unavailable" as const }))
  cache.set(quote, { value, expiresAt: Date.now() + TTL_MS })
  return value
}

export async function getValuationMetadata() {
  const [ngn, usd] = await Promise.all([getLiveRate("NGN"), getLiveRate("USD")])
  return { ngn, usd }
}

export function convertUsdt(amountUsdt: number, quote: Quote) {
  return quote.rate === null ? null : amountUsdt * quote.rate
}
