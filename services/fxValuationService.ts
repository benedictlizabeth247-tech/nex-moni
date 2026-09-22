const YAHOO_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart/USDNGN=X"

type Quote = { base: "USD"; quote: "NGN"; rate: number | null; source: "Yahoo Finance"; receivedAt: string | null; expiresAt: string | null; stale: boolean; status: "live" | "unavailable" }
type CacheEntry = { value: Quote; expiresAt: number }
let cached: CacheEntry | null = null
const TTL_MS = 60_000

async function fetchYahooRate(): Promise<Quote> {
  const now = new Date()
  const response = await fetch(`${YAHOO_CHART_URL}?range=1d&interval=1m`, { headers: { "User-Agent": "NexMonie/1.0" }, cache: "no-store" })
  if (!response.ok) throw new Error(`Yahoo Finance returned ${response.status}`)
  const payload = await response.json() as { chart?: { result?: Array<{ meta?: { regularMarketPrice?: number; regularMarketTime?: number } }> } }
  const meta = payload.chart?.result?.[0]?.meta
  const rate = Number(meta?.regularMarketPrice)
  if (!Number.isFinite(rate) || rate <= 0) return { base: "USD", quote: "NGN", rate: null, source: "Yahoo Finance", receivedAt: null, expiresAt: null, stale: false, status: "unavailable" }
  const receivedAt = meta?.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : now.toISOString()
  return { base: "USD", quote: "NGN", rate, source: "Yahoo Finance", receivedAt, expiresAt: new Date(now.getTime() + TTL_MS).toISOString(), stale: false, status: "live" }
}

export async function getUsdNgnRate(): Promise<Quote> {
  if (cached && cached.expiresAt > Date.now()) return cached.value
  const value = await fetchYahooRate().catch(() => ({ base: "USD" as const, quote: "NGN" as const, rate: null, source: "Yahoo Finance" as const, receivedAt: null, expiresAt: null, stale: false, status: "unavailable" as const }))
  cached = { value, expiresAt: Date.now() + TTL_MS }
  return value
}

export async function getValuationMetadata() {
  return { usdNgn: await getUsdNgnRate() }
}

export function convertUsdToNgn(amountUsd: number, quote: Quote) {
  return quote.rate === null ? null : amountUsd * quote.rate
}
