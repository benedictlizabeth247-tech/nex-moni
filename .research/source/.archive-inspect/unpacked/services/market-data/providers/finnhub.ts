/**
 * @fileOverview Finnhub provider — premium source for US stocks, ETFs,
 * indices and forex. Entirely key-gated: when `FINNHUB_API_KEY` is absent every
 * function reports unavailable and the router silently falls back to Yahoo.
 */

import { fetchJson } from '../http'
import { buildAssetId, displaySymbol, assetName } from '../symbols'
import type { AssetProfile, AssetType, Candle, Quote, SearchResult, Timeframe } from '../types'

const PROVIDER = 'finnhub' as const
const BASE = 'https://finnhub.io/api/v1'

export const isEnabled = () => Boolean(process.env.FINNHUB_API_KEY)

const supportedTypes: AssetType[] = ['stock', 'etf', 'index', 'forex']
export const supports = (type: AssetType) => isEnabled() && supportedTypes.includes(type)

const fh = <T,>(path: string) =>
  fetchJson<T>(PROVIDER, `${BASE}${path}${path.includes('?') ? '&' : '?'}token=${process.env.FINNHUB_API_KEY}`)

/** Finnhub tickers: plain for equities, `OANDA:EUR_USD` for forex. */
const providerSymbol = (type: AssetType, symbol: string): string => {
  const s = symbol.toUpperCase()
  if (type === 'forex') return `OANDA:${s.slice(0, 3)}_${s.slice(3, 6)}`
  if (type === 'index') return `^${s}`
  return s
}

interface FinnhubQuote {
  c: number // current
  d: number // change
  dp: number // percent change
  h: number
  l: number
  o: number
  pc: number
  t: number
}

export async function getQuote(type: AssetType, symbol: string): Promise<Quote> {
  const q = await fh<FinnhubQuote>(`/quote?symbol=${encodeURIComponent(providerSymbol(type, symbol))}`)
  if (!q || !q.c) throw new Error(`[finnhub] No quote for ${symbol}`)
  return {
    id: buildAssetId(type, symbol),
    type,
    symbol: symbol.toUpperCase(),
    display: displaySymbol(type, symbol),
    name: assetName(type, symbol),
    price: q.c,
    change: q.d ?? q.c - q.pc,
    changePercent: q.dp ?? (q.pc ? ((q.c - q.pc) / q.pc) * 100 : 0),
    open: q.o,
    high: q.h,
    low: q.l,
    close: q.c,
    previousClose: q.pc,
    currency: 'USD',
    provider: PROVIDER,
    timestamp: (q.t || Math.floor(Date.now() / 1000)) * 1000,
  }
}

export async function getQuotes(assets: { type: AssetType; symbol: string }[]): Promise<Quote[]> {
  const settled = await Promise.allSettled(assets.map((a) => getQuote(a.type, a.symbol)))
  return settled.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []))
}

const RESOLUTION: Record<Timeframe, string> = {
  '1m': '1',
  '5m': '5',
  '15m': '15',
  '1H': '60',
  '4H': '60',
  '1D': 'D',
  '1W': 'W',
  '1M': 'M',
}

const LOOKBACK_SECONDS: Record<Timeframe, number> = {
  '1m': 60 * 60 * 8,
  '5m': 60 * 60 * 48,
  '15m': 60 * 60 * 24 * 10,
  '1H': 60 * 60 * 24 * 60,
  '4H': 60 * 60 * 24 * 180,
  '1D': 60 * 60 * 24 * 365,
  '1W': 60 * 60 * 24 * 365 * 5,
  '1M': 60 * 60 * 24 * 365 * 10,
}

export async function getCandles(
  type: AssetType,
  symbol: string,
  timeframe: Timeframe,
): Promise<Candle[]> {
  const to = Math.floor(Date.now() / 1000)
  const from = to - LOOKBACK_SECONDS[timeframe]
  const endpoint = type === 'forex' ? '/forex/candle' : '/stock/candle'
  const json = await fh<{
    s: string
    t?: number[]
    o?: number[]
    h?: number[]
    l?: number[]
    c?: number[]
    v?: number[]
  }>(
    `${endpoint}?symbol=${encodeURIComponent(providerSymbol(type, symbol))}&resolution=${RESOLUTION[timeframe]}&from=${from}&to=${to}`,
  )
  if (json.s !== 'ok' || !json.t) return []
  return json.t.map((t, i) => ({
    time: t * 1000,
    open: json.o?.[i] ?? 0,
    high: json.h?.[i] ?? 0,
    low: json.l?.[i] ?? 0,
    close: json.c?.[i] ?? 0,
    volume: json.v?.[i] ?? 0,
  }))
}

export async function search(query: string, limit = 10): Promise<SearchResult[]> {
  const json = await fh<{ result: { symbol: string; description: string; type: string }[] }>(
    `/search?q=${encodeURIComponent(query)}`,
  )
  return (json.result ?? [])
    .filter((r) => !r.symbol.includes('.'))
    .slice(0, limit)
    .map((r) => {
      const type: AssetType = r.type === 'ETP' ? 'etf' : 'stock'
      return {
        id: buildAssetId(type, r.symbol),
        type,
        symbol: r.symbol.toUpperCase(),
        display: r.symbol.toUpperCase(),
        name: r.description,
        provider: PROVIDER,
        score: 65,
      }
    })
}

export async function getProfile(type: AssetType, symbol: string): Promise<AssetProfile | null> {
  if (type !== 'stock' && type !== 'etf') return null
  try {
    const p = await fh<any>(`/stock/profile2?symbol=${encodeURIComponent(symbol.toUpperCase())}`)
    if (!p?.name) return null
    return {
      id: buildAssetId(type, symbol),
      name: p.name,
      description: p.description,
      sector: p.finnhubIndustry,
      industry: p.finnhubIndustry,
      website: p.weburl,
      metrics: [
        {
          label: 'Market Cap',
          value: p.marketCapitalization
            ? `$${Number(p.marketCapitalization).toLocaleString('en-US', { maximumFractionDigits: 0 })}M`
            : '—',
        },
        { label: 'Exchange', value: p.exchange ?? '—' },
        { label: 'Country', value: p.country ?? '—' },
        { label: 'IPO', value: p.ipo ?? '—' },
        {
          label: 'Shares Out',
          value: p.shareOutstanding
            ? `${Number(p.shareOutstanding).toLocaleString('en-US', { maximumFractionDigits: 0 })}M`
            : '—',
        },
        { label: 'Currency', value: p.currency ?? 'USD' },
      ],
      provider: PROVIDER,
    }
  } catch {
    return null
  }
}
