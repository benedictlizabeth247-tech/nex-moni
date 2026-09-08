/**
 * @fileOverview Bybit public API provider — primary source for crypto.
 *
 * Covers live prices, trading pairs, k-line history, order book, recent trades
 * and 24h statistics. Isomorphic so the service layer can retry from the
 * browser when Bybit is unreachable from the serverless region.
 */

import { fetchJson, ProviderError } from '../http'
import {
  BYBIT_INTERVAL,
  cryptoBySymbol,
  displaySymbol,
  buildAssetId,
  normalizeSymbol,
  CRYPTO_UNIVERSE,
} from '../symbols'
import type { Candle, OrderBook, Quote, SearchResult, Timeframe, Trade } from '../types'

export const BYBIT_BASES = [
  process.env.BYBIT_API_BASE || 'https://api.bybit.com',
  'https://api.bytick.com',
]

const PROVIDER = 'bybit' as const

interface BybitEnvelope<T> {
  retCode: number
  retMsg: string
  result: T
  time: number
}

async function bybit<T>(path: string): Promise<T> {
  let lastError: unknown
  for (const base of BYBIT_BASES) {
    try {
      const json = await fetchJson<BybitEnvelope<T>>(PROVIDER, `${base}${path}`)
      if (json.retCode !== 0) throw new ProviderError(PROVIDER, json.retMsg || 'Unknown error')
      return json.result
    } catch (err) {
      lastError = err
    }
  }
  throw lastError instanceof Error ? lastError : new ProviderError(PROVIDER, 'Unreachable')
}

/* -------------------------------------------------------------------------- */
/* Tickers / 24h statistics                                                   */
/* -------------------------------------------------------------------------- */

interface BybitTicker {
  symbol: string
  lastPrice: string
  prevPrice24h: string
  price24hPcnt: string
  highPrice24h: string
  lowPrice24h: string
  volume24h: string
  turnover24h: string
  usdIndexPrice?: string
}

const toQuote = (t: BybitTicker): Quote => {
  const symbol = normalizeSymbol(t.symbol)
  const meta = cryptoBySymbol(symbol)
  const price = Number(t.lastPrice)
  const prev = Number(t.prevPrice24h)
  const pct = Number(t.price24hPcnt) * 100
  return {
    id: buildAssetId('crypto', symbol),
    type: 'crypto',
    symbol,
    display: displaySymbol('crypto', symbol),
    name: meta?.name ?? symbol,
    exchange: 'Bybit',
    price,
    change: Number.isFinite(prev) ? price - prev : 0,
    changePercent: Number.isFinite(pct) ? pct : 0,
    open: Number.isFinite(prev) ? prev : undefined,
    high: Number(t.highPrice24h) || undefined,
    low: Number(t.lowPrice24h) || undefined,
    close: price,
    previousClose: Number.isFinite(prev) ? prev : undefined,
    volume: Number(t.volume24h) || undefined,
    quoteVolume: Number(t.turnover24h) || undefined,
    currency: 'USD',
    provider: PROVIDER,
    timestamp: Date.now(),
  }
}

/** All spot tickers (one request), keyed by normalised symbol. */
export async function getSpotTickers(): Promise<Map<string, Quote>> {
  const result = await bybit<{ list: BybitTicker[] }>('/v5/market/tickers?category=spot')
  const map = new Map<string, Quote>()
  for (const t of result.list ?? []) map.set(normalizeSymbol(t.symbol), toQuote(t))
  return map
}

export async function getTicker(symbol: string): Promise<Quote> {
  const sym = normalizeSymbol(symbol)
  const result = await bybit<{ list: BybitTicker[] }>(`/v5/market/tickers?category=spot&symbol=${sym}`)
  const ticker = result.list?.[0]
  if (!ticker) throw new ProviderError(PROVIDER, `No ticker for ${sym}`)
  return toQuote(ticker)
}

/* -------------------------------------------------------------------------- */
/* K-line                                                                     */
/* -------------------------------------------------------------------------- */

export async function getKline(symbol: string, timeframe: Timeframe, limit = 200): Promise<Candle[]> {
  const sym = normalizeSymbol(symbol)
  const interval = BYBIT_INTERVAL[timeframe]
  const result = await bybit<{ list: string[][] }>(
    `/v5/market/kline?category=spot&symbol=${sym}&interval=${interval}&limit=${limit}`,
  )
  return (result.list ?? [])
    .map((row) => ({
      time: Number(row[0]),
      open: Number(row[1]),
      high: Number(row[2]),
      low: Number(row[3]),
      close: Number(row[4]),
      volume: Number(row[5]),
    }))
    .filter((c) => Number.isFinite(c.close))
    .sort((a, b) => a.time - b.time)
}

/* -------------------------------------------------------------------------- */
/* Order book + recent trades                                                 */
/* -------------------------------------------------------------------------- */

export async function getOrderBook(symbol: string, limit = 25): Promise<OrderBook> {
  const sym = normalizeSymbol(symbol)
  const result = await bybit<{ b: string[][]; a: string[][]; ts: number }>(
    `/v5/market/orderbook?category=spot&symbol=${sym}&limit=${limit}`,
  )
  const level = (row: string[]) => ({ price: Number(row[0]), size: Number(row[1]) })
  return {
    id: buildAssetId('crypto', sym),
    bids: (result.b ?? []).map(level),
    asks: (result.a ?? []).map(level),
    provider: PROVIDER,
    timestamp: result.ts ?? Date.now(),
  }
}

export async function getRecentTrades(symbol: string, limit = 30): Promise<Trade[]> {
  const sym = normalizeSymbol(symbol)
  const result = await bybit<{
    list: { execId: string; price: string; size: string; side: string; time: string }[]
  }>(`/v5/market/recent-trade?category=spot&symbol=${sym}&limit=${limit}`)
  return (result.list ?? []).map((t) => ({
    id: t.execId,
    price: Number(t.price),
    size: Number(t.size),
    side: t.side?.toLowerCase() === 'sell' ? 'sell' : 'buy',
    time: Number(t.time),
  }))
}

/* -------------------------------------------------------------------------- */
/* Instruments (trading pairs) — powers crypto search                         */
/* -------------------------------------------------------------------------- */

interface BybitInstrument {
  symbol: string
  baseCoin: string
  quoteCoin: string
  status: string
}

export async function getInstruments(): Promise<BybitInstrument[]> {
  const result = await bybit<{ list: BybitInstrument[] }>('/v5/market/instruments-info?category=spot')
  return (result.list ?? []).filter((i) => i.status === 'Trading')
}

export async function searchPairs(query: string, limit = 12): Promise<SearchResult[]> {
  const q = normalizeSymbol(query)
  if (!q) return []
  const instruments = await getInstruments()
  const scored = instruments
    .map((i) => {
      const symbol = normalizeSymbol(i.symbol)
      let score = 0
      if (symbol === q) score = 100
      else if (i.baseCoin === q) score = 90
      else if (symbol.startsWith(q)) score = 70
      else if (i.baseCoin.startsWith(q)) score = 60
      else if (symbol.includes(q)) score = 30
      if (score && i.quoteCoin === 'USDT') score += 8
      return { i, symbol, score }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)

  return scored.map(({ i, symbol, score }) => ({
    id: buildAssetId('crypto', symbol),
    type: 'crypto' as const,
    symbol,
    display: displaySymbol('crypto', symbol),
    name: cryptoBySymbol(symbol)?.name ?? i.baseCoin,
    exchange: 'Bybit',
    provider: PROVIDER,
    score,
  }))
}

/** Offline-safe pair search over the curated universe (no network). */
export function searchCuratedPairs(query: string, limit = 12): SearchResult[] {
  const q = normalizeSymbol(query)
  if (!q) return []
  return CRYPTO_UNIVERSE.filter(
    (c) => c.symbol.startsWith(q) || c.base.startsWith(q) || c.name.toUpperCase().includes(query.toUpperCase()),
  )
    .slice(0, limit)
    .map((c) => ({
      id: buildAssetId('crypto', c.symbol),
      type: 'crypto' as const,
      symbol: c.symbol,
      display: displaySymbol('crypto', c.symbol),
      name: c.name,
      exchange: 'Bybit',
      provider: PROVIDER,
      score: c.base === q ? 95 : 50,
    }))
}

/* -------------------------------------------------------------------------- */
/* WebSocket (browser)                                                        */
/* -------------------------------------------------------------------------- */

export const BYBIT_WS_URL =
  process.env.NEXT_PUBLIC_BYBIT_WS_URL || 'wss://stream.bybit.com/v5/public/spot'

export const tickerTopic = (symbol: string) => `tickers.${normalizeSymbol(symbol)}`
export const orderBookTopic = (symbol: string, depth = 50) =>
  `orderbook.${depth}.${normalizeSymbol(symbol)}`
export const tradeTopic = (symbol: string) => `publicTrade.${normalizeSymbol(symbol)}`
