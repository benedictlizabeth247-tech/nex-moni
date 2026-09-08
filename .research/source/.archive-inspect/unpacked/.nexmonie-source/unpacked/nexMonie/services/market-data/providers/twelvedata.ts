/**
 * @fileOverview Twelve Data provider — premium source for forex and
 * commodities (gold, silver, oil, natural gas, ...). Key-gated via
 * `TWELVEDATA_API_KEY`; falls back to Yahoo when absent.
 */

import { fetchJson } from '../http'
import { assetName, buildAssetId, displaySymbol, equityMeta, TWELVEDATA_INTERVAL } from '../symbols'
import type { AssetType, Candle, Quote, SearchResult, Timeframe } from '../types'

const PROVIDER = 'twelvedata' as const
const BASE = 'https://api.twelvedata.com'

export const isEnabled = () => Boolean(process.env.TWELVEDATA_API_KEY)

const supportedTypes: AssetType[] = ['forex', 'commodity', 'stock', 'etf', 'index']
export const supports = (type: AssetType) => isEnabled() && supportedTypes.includes(type)

const td = <T,>(path: string) =>
  fetchJson<T>(PROVIDER, `${BASE}${path}${path.includes('?') ? '&' : '?'}apikey=${process.env.TWELVEDATA_API_KEY}`)

/** `XAUUSD` -> `XAU/USD`, `EURUSD` -> `EUR/USD`, `AAPL` -> `AAPL`. */
const providerSymbol = (type: AssetType, symbol: string): string => {
  const meta = equityMeta(type, symbol)
  if (meta?.twelvedata) return meta.twelvedata
  const s = symbol.toUpperCase()
  if (type === 'forex' || type === 'commodity') {
    return s.length === 6 ? `${s.slice(0, 3)}/${s.slice(3)}` : s
  }
  return s
}

interface TDQuote {
  symbol: string
  name?: string
  open?: string
  high?: string
  low?: string
  close?: string
  previous_close?: string
  change?: string
  percent_change?: string
  volume?: string
  timestamp?: number
  currency?: string
  status?: string
  code?: number
}

export async function getQuote(type: AssetType, symbol: string): Promise<Quote> {
  const q = await td<TDQuote>(`/quote?symbol=${encodeURIComponent(providerSymbol(type, symbol))}`)
  if (!q?.close) throw new Error(`[twelvedata] No quote for ${symbol}`)
  const price = Number(q.close)
  const prev = Number(q.previous_close ?? q.open ?? price)
  return {
    id: buildAssetId(type, symbol),
    type,
    symbol: symbol.toUpperCase(),
    display: displaySymbol(type, symbol),
    name: q.name || assetName(type, symbol),
    price,
    change: Number(q.change ?? price - prev),
    changePercent: Number(q.percent_change ?? (prev ? ((price - prev) / prev) * 100 : 0)),
    open: Number(q.open ?? prev),
    high: q.high ? Number(q.high) : undefined,
    low: q.low ? Number(q.low) : undefined,
    close: price,
    previousClose: prev,
    volume: q.volume ? Number(q.volume) : undefined,
    currency: q.currency ?? 'USD',
    provider: PROVIDER,
    timestamp: (q.timestamp ?? Math.floor(Date.now() / 1000)) * 1000,
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
  const json = await td<{
    values?: { datetime: string; open: string; high: string; low: string; close: string; volume?: string }[]
    status?: string
  }>(
    `/time_series?symbol=${encodeURIComponent(providerSymbol(type, symbol))}&interval=${TWELVEDATA_INTERVAL[timeframe]}&outputsize=300&order=ASC`,
  )
  return (json.values ?? []).map((v) => ({
    time: new Date(v.datetime.replace(' ', 'T') + (v.datetime.includes(':') ? 'Z' : '')).getTime(),
    open: Number(v.open),
    high: Number(v.high),
    low: Number(v.low),
    close: Number(v.close),
    volume: Number(v.volume ?? 0),
  }))
}

export async function search(query: string, limit = 10): Promise<SearchResult[]> {
  const json = await td<{
    data?: { symbol: string; instrument_name: string; instrument_type: string; exchange?: string }[]
  }>(`/symbol_search?symbol=${encodeURIComponent(query)}&outputsize=${limit}`)
  return (json.data ?? []).flatMap((d) => {
    const kind = (d.instrument_type || '').toLowerCase()
    const type: AssetType | null = kind.includes('etf')
      ? 'etf'
      : kind.includes('index')
        ? 'index'
        : kind.includes('currency')
          ? 'forex'
          : kind.includes('commodit')
            ? 'commodity'
            : kind.includes('stock') || kind.includes('common')
              ? 'stock'
              : null
    if (!type) return []
    const symbol = d.symbol.replace('/', '').toUpperCase()
    return [
      {
        id: buildAssetId(type, symbol),
        type,
        symbol,
        display: displaySymbol(type, symbol),
        name: d.instrument_name,
        exchange: d.exchange,
        provider: PROVIDER,
        score: 60,
      },
    ]
  })
}
