/**
 * @fileOverview Polygon.io provider — optional premium source for US stocks,
 * ETFs, indices, forex and crypto aggregates. Key-gated via `POLYGON_API_KEY`;
 * when the key is absent every function reports unavailable and the router
 * silently keeps using Yahoo / Finnhub / Twelve Data.
 */

import { fetchJson } from '../http'
import { assetName, buildAssetId, displaySymbol } from '../symbols'
import type { AssetType, Candle, Quote, SearchResult, Timeframe } from '../types'

const PROVIDER = 'polygon' as const
const BASE = 'https://api.polygon.io'

export const isEnabled = () => Boolean(process.env.POLYGON_API_KEY)

const supportedTypes: AssetType[] = ['stock', 'etf', 'index', 'forex']
export const supports = (type: AssetType) => isEnabled() && supportedTypes.includes(type)

const pg = <T,>(path: string) =>
  fetchJson<T>(
    PROVIDER,
    `${BASE}${path}${path.includes('?') ? '&' : '?'}apiKey=${process.env.POLYGON_API_KEY}`,
  )

/** `AAPL` -> `AAPL`, `SPX` -> `I:SPX`, `EURUSD` -> `C:EURUSD`. */
const providerSymbol = (type: AssetType, symbol: string): string => {
  const s = symbol.toUpperCase()
  if (type === 'index') return `I:${s.replace(/^\^/, '')}`
  if (type === 'forex') return `C:${s}`
  return s
}

/** Polygon aggregate multiplier/timespan pairs. */
const AGG: Record<Timeframe, { multiplier: number; timespan: string; lookbackMs: number }> = {
  '1m': { multiplier: 1, timespan: 'minute', lookbackMs: 8 * 60 * 60 * 1000 },
  '5m': { multiplier: 5, timespan: 'minute', lookbackMs: 2 * 24 * 60 * 60 * 1000 },
  '15m': { multiplier: 15, timespan: 'minute', lookbackMs: 10 * 24 * 60 * 60 * 1000 },
  '1H': { multiplier: 1, timespan: 'hour', lookbackMs: 60 * 24 * 60 * 60 * 1000 },
  '4H': { multiplier: 4, timespan: 'hour', lookbackMs: 180 * 24 * 60 * 60 * 1000 },
  '1D': { multiplier: 1, timespan: 'day', lookbackMs: 365 * 24 * 60 * 60 * 1000 },
  '1W': { multiplier: 1, timespan: 'week', lookbackMs: 5 * 365 * 24 * 60 * 60 * 1000 },
  '1M': { multiplier: 1, timespan: 'month', lookbackMs: 10 * 365 * 24 * 60 * 60 * 1000 },
}

interface AggBar {
  t: number
  o: number
  h: number
  l: number
  c: number
  v?: number
  vw?: number
}

/**
 * Previous close + latest aggregate give us a free-tier friendly quote that
 * still carries open/high/low and a correct day change.
 */
export async function getQuote(type: AssetType, symbol: string): Promise<Quote> {
  const ticker = providerSymbol(type, symbol)
  const [prev, snapshot] = await Promise.all([
    pg<{ results?: AggBar[] }>(`/v2/aggs/ticker/${encodeURIComponent(ticker)}/prev?adjusted=true`),
    pg<{ results?: AggBar[] }>(
      `/v2/aggs/ticker/${encodeURIComponent(ticker)}/range/1/minute/${Date.now() - 6 * 60 * 60 * 1000}/${Date.now()}?adjusted=true&sort=desc&limit=1`,
    ).catch(() => ({ results: [] as AggBar[] })),
  ])

  const previousBar = prev.results?.[0]
  const latest = snapshot.results?.[0] ?? previousBar
  if (!latest?.c) throw new Error(`[polygon] No quote for ${symbol}`)

  const price = latest.c
  const previousClose = previousBar?.c ?? latest.o ?? price

  return {
    id: buildAssetId(type, symbol),
    type,
    symbol: symbol.toUpperCase(),
    display: displaySymbol(type, symbol),
    name: assetName(type, symbol),
    price,
    change: price - previousClose,
    changePercent: previousClose ? ((price - previousClose) / previousClose) * 100 : 0,
    open: latest.o,
    high: latest.h,
    low: latest.l,
    close: price,
    previousClose,
    volume: latest.v,
    currency: 'USD',
    provider: PROVIDER,
    timestamp: latest.t || Date.now(),
  }
}

export async function getQuotes(assets: { type: AssetType; symbol: string }[]): Promise<Quote[]> {
  const settled = await Promise.allSettled(assets.map((a) => getQuote(a.type, a.symbol)))
  return settled.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []))
}

export async function getCandles(
  type: AssetType,
  symbol: string,
  timeframe: Timeframe,
): Promise<Candle[]> {
  const { multiplier, timespan, lookbackMs } = AGG[timeframe]
  const to = Date.now()
  const from = to - lookbackMs
  const json = await pg<{ results?: AggBar[] }>(
    `/v2/aggs/ticker/${encodeURIComponent(providerSymbol(type, symbol))}/range/${multiplier}/${timespan}/${from}/${to}?adjusted=true&sort=asc&limit=5000`,
  )
  return (json.results ?? []).map((b) => ({
    time: b.t,
    open: b.o,
    high: b.h,
    low: b.l,
    close: b.c,
    volume: b.v ?? 0,
  }))
}

export async function search(query: string, limit = 10): Promise<SearchResult[]> {
  const json = await pg<{
    results?: { ticker: string; name: string; market: string; type?: string; primary_exchange?: string }[]
  }>(`/v3/reference/tickers?search=${encodeURIComponent(query)}&active=true&limit=${limit}`)

  return (json.results ?? []).flatMap((r) => {
    const kind = (r.type ?? '').toUpperCase()
    const type: AssetType | null =
      kind === 'ETF' || kind === 'ETN' || kind === 'ETV'
        ? 'etf'
        : kind === 'INDEX'
          ? 'index'
          : r.market === 'fx'
            ? 'forex'
            : r.market === 'stocks'
              ? 'stock'
              : null
    if (!type) return []
    const symbol = r.ticker.replace(/^[A-Z]:/, '').toUpperCase()
    return [
      {
        id: buildAssetId(type, symbol),
        type,
        symbol,
        display: displaySymbol(type, symbol),
        name: r.name,
        exchange: r.primary_exchange,
        provider: PROVIDER,
        score: 62,
      },
    ]
  })
}
