/**
 * @fileOverview Exchange Rate provider — keyless fallback for forex pairs.
 *
 * Final link in the forex failover chain. Uses the open exchangerate-api
 * endpoint, which requires no key and — unlike Frankfurter/ECB — covers NGN,
 * the base currency of this product.
 *
 * Rates are daily reference rates, so quotes are marked as such by carrying the
 * upstream update timestamp. Only used when Yahoo Finance is rate-limited and no
 * premium key is configured.
 */

import { cached, fetchJson } from '../http'
import { assetName, buildAssetId, displaySymbol } from '../symbols'
import type { AssetType, Candle, Quote, Timeframe } from '../types'

const PROVIDER = 'exchangerate' as const
const ENDPOINT = 'https://open.er-api.com/v6/latest/USD'

/** Reference rates refresh once a day upstream; cache for an hour. */
const TTL = 60 * 60 * 1000

export const supports = (type: AssetType): boolean => type === 'forex'

/** Keyless — always available as the last-resort forex source. */
export const isEnabled = () => true

interface RatesResponse {
  result?: string
  base_code?: string
  rates?: Record<string, number>
  time_last_update_unix?: number
}

interface RateTable {
  rates: Record<string, number>
  timestamp: number
}

const loadRates = (): Promise<RateTable> =>
  cached(`${PROVIDER}:usd`, TTL, async () => {
    const json = await fetchJson<RatesResponse>(PROVIDER, ENDPOINT, { retries: 1 })
    if (json.result !== 'success' || !json.rates) {
      throw new Error('[exchangerate] Malformed rates payload')
    }
    return {
      rates: json.rates,
      timestamp: (json.time_last_update_unix ?? Math.floor(Date.now() / 1000)) * 1000,
    }
  })

/** `EURUSD` -> `{ base: 'EUR', quote: 'USD' }` */
const splitPair = (symbol: string): { base: string; quote: string } | null => {
  const s = symbol.toUpperCase().replace(/[^A-Z]/g, '')
  if (s.length !== 6) return null
  return { base: s.slice(0, 3), quote: s.slice(3) }
}

/**
 * Cross rate via USD: `BASE/QUOTE = (USD->QUOTE) / (USD->BASE)`.
 * USD itself is implicitly 1.
 */
const crossRate = (rates: Record<string, number>, base: string, quote: string): number | null => {
  const usdToBase = base === 'USD' ? 1 : rates[base]
  const usdToQuote = quote === 'USD' ? 1 : rates[quote]
  if (!usdToBase || !usdToQuote) return null
  const value = usdToQuote / usdToBase
  return Number.isFinite(value) && value > 0 ? value : null
}

export async function getQuotes(assets: { type: AssetType; symbol: string }[]): Promise<Quote[]> {
  const pairs = assets.filter((a) => supports(a.type))
  if (!pairs.length) return []

  const { rates, timestamp } = await loadRates()
  const out: Quote[] = []

  for (const asset of pairs) {
    const parts = splitPair(asset.symbol)
    if (!parts) continue
    const price = crossRate(rates, parts.base, parts.quote)
    if (price == null) continue

    const symbol = asset.symbol.toUpperCase()
    out.push({
      id: buildAssetId('forex', symbol),
      type: 'forex',
      symbol,
      display: displaySymbol('forex', symbol),
      name: assetName('forex', symbol),
      price,
      // Daily reference rates carry no intraday delta.
      change: 0,
      changePercent: 0,
      close: price,
      previousClose: price,
      currency: parts.quote,
      provider: PROVIDER,
      timestamp,
    })
  }

  return out
}

export async function getQuote(type: AssetType, symbol: string): Promise<Quote> {
  const [quote] = await getQuotes([{ type, symbol }])
  if (!quote) throw new Error(`[exchangerate] No rate for ${symbol}`)
  return quote
}

/* -------------------------------------------------------------------------- */
/* History (Frankfurter public daily reference rates)                      */
/* -------------------------------------------------------------------------- */

/**
 * Frankfurter's current public v2 API is keyless and now aggregates daily
 * reference rates from multiple central-bank sources, including CBN coverage
 * for NGN. It therefore closes the historical-forex gap when Yahoo or a keyed
 * provider is unavailable. These are daily reference closes, not synthetic
 * intraday ticks, so sub-daily chart selections intentionally use the same
 * genuine daily observations rather than inventing candles.
 */
const HISTORY_BASE = 'https://api.frankfurter.dev/v2'

/** Calendar days of history to request per timeframe. */
const HISTORY_DAYS: Record<Timeframe, number> = {
  '1m': 7,
  '5m': 14,
  '15m': 30,
  '1H': 60,
  '4H': 120,
  '1D': 365,
  '1W': 365 * 3,
  '1M': 365 * 10,
}

const isoDate = (ms: number): string => new Date(ms).toISOString().slice(0, 10)

interface FrankfurterRateRow {
  date: string
  base: string
  quote: string
  rate: number
}

export async function getCandles(
  type: AssetType,
  symbol: string,
  timeframe: Timeframe,
): Promise<Candle[]> {
  if (!supports(type)) return []
  const parts = splitPair(symbol)
  if (!parts) return []
  // Same-currency pairs and anything outside the ECB basket have no series.
  if (parts.base === parts.quote) return []

  const days = HISTORY_DAYS[timeframe] ?? 365
  const end = Date.now()
  const start = end - days * 24 * 60 * 60 * 1000
  const path = `/rates?from=${isoDate(start)}&to=${isoDate(end)}&base=${parts.base}&quotes=${parts.quote}`

  const rows = await cached(`${PROVIDER}:history:${parts.base}${parts.quote}:${days}`, TTL, () =>
    fetchJson<FrankfurterRateRow[]>(PROVIDER, `${HISTORY_BASE}${path}`, { retries: 1 }),
  )

  const series = (rows ?? [])
    .map((row) => ({ time: Date.parse(`${row.date}T00:00:00Z`), value: Number(row.rate) }))
    .filter((p) => Number.isFinite(p.time) && Number.isFinite(p.value) && p.value > 0)
    .sort((a, b) => a.time - b.time)

  // Reference rates are single daily closes, so each bar opens at the previous
  // close and carries no intraday range or volume.
  return series.map((point, i) => {
    const open = i > 0 ? series[i - 1].value : point.value
    return {
      time: point.time,
      open,
      high: Math.max(open, point.value),
      low: Math.min(open, point.value),
      close: point.value,
      volume: 0,
    }
  })
}
