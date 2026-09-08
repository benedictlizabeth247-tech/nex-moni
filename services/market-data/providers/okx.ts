/**
 * @fileOverview OKX public API provider — keyless crypto fallback.
 *
 * Bybit is the primary crypto source, but its CDN geo-blocks entire regions
 * (HTTP 403 "configured to block access from your country"), and CoinGecko's
 * free tier rate-limits chart history (HTTP 429) while offering no order book
 * or trade feed at all. OKX fills exactly that gap: same USDT spot pairs,
 * keyless, with k-lines, order book and recent trades.
 *
 * It therefore sits between Bybit and CoinGecko in the crypto chain, and is the
 * source that keeps crypto charts and market depth working in regions where
 * Bybit is unreachable.
 *
 * Symbols are the same bases as Bybit with a dash: `BTCUSDT` <-> `BTC-USDT`.
 */

import { fetchJson, ProviderError } from '../http'
import {
  buildAssetId,
  cryptoBySymbol,
  displaySymbol,
  normalizeSymbol,
} from '../symbols'
import type { Candle, OrderBook, Quote, SearchResult, Timeframe, Trade } from '../types'

const PROVIDER = 'okx' as const
const BASE = process.env.OKX_API_BASE || 'https://www.okx.com'

/** OKX bar codes per timeframe. */
const BAR: Record<Timeframe, string> = {
  '1m': '1m',
  '5m': '5m',
  '15m': '15m',
  '1H': '1H',
  '4H': '4H',
  '1D': '1D',
  '1W': '1W',
  '1M': '1M',
}

/** `BTCUSDT` -> `BTC-USDT` (OKX instrument id). */
export const toInstId = (symbol: string): string | null => {
  const s = normalizeSymbol(symbol)
  for (const quote of ['USDT', 'USDC', 'USD', 'BTC', 'ETH']) {
    if (s.length > quote.length && s.endsWith(quote)) {
      return `${s.slice(0, s.length - quote.length)}-${quote}`
    }
  }
  return null
}

/** `BTC-USDT` -> `BTCUSDT` */
export const fromInstId = (instId: string): string => normalizeSymbol(instId)

interface OkxEnvelope<T> {
  code: string
  msg: string
  data: T
}

async function okx<T>(path: string): Promise<T> {
  const json = await fetchJson<OkxEnvelope<T>>(PROVIDER, `${BASE}${path}`)
  if (json.code !== '0') throw new ProviderError(PROVIDER, json.msg || `Error code ${json.code}`)
  return json.data
}

/* -------------------------------------------------------------------------- */
/* Tickers                                                                    */
/* -------------------------------------------------------------------------- */

interface OkxTicker {
  instId: string
  last: string
  open24h: string
  high24h: string
  low24h: string
  vol24h: string
  volCcy24h: string
  ts: string
}

const toQuote = (t: OkxTicker): Quote => {
  const symbol = fromInstId(t.instId)
  const meta = cryptoBySymbol(symbol)
  const price = Number(t.last)
  const open = Number(t.open24h)
  const change = Number.isFinite(open) && open > 0 ? price - open : 0
  const changePercent = Number.isFinite(open) && open > 0 ? (change / open) * 100 : 0
  const ts = Number(t.ts)

  return {
    id: buildAssetId('crypto', symbol),
    type: 'crypto',
    symbol,
    display: displaySymbol('crypto', symbol),
    name: meta?.name ?? symbol,
    exchange: 'OKX',
    price,
    change,
    changePercent,
    open: Number.isFinite(open) ? open : undefined,
    high: Number(t.high24h) || undefined,
    low: Number(t.low24h) || undefined,
    close: price,
    previousClose: Number.isFinite(open) ? open : undefined,
    volume: Number(t.vol24h) || undefined,
    quoteVolume: Number(t.volCcy24h) || undefined,
    currency: 'USD',
    provider: PROVIDER,
    timestamp: Number.isFinite(ts) ? ts : Date.now(),
  }
}

/** All spot tickers (one request), keyed by normalised symbol. */
export async function getSpotTickers(): Promise<Map<string, Quote>> {
  const list = await okx<OkxTicker[]>('/api/v5/market/tickers?instType=SPOT')
  const map = new Map<string, Quote>()
  for (const t of list ?? []) {
    const quote = toQuote(t)
    if (quote.price > 0) map.set(quote.symbol, quote)
  }
  return map
}

/** Single pair snapshot, mirroring `bybit.getTicker`. */
export async function getTicker(symbol: string): Promise<Quote> {
  const instId = toInstId(symbol)
  if (!instId) throw new ProviderError(PROVIDER, `Unsupported symbol ${symbol}`)
  const [ticker] = await okx<OkxTicker[]>(`/api/v5/market/ticker?instId=${instId}`)
  if (!ticker) throw new ProviderError(PROVIDER, `No ticker for ${symbol}`)
  return toQuote(ticker)
}

/* -------------------------------------------------------------------------- */
/* K-line                                                                     */
/* -------------------------------------------------------------------------- */

export async function getKline(
  symbol: string,
  timeframe: Timeframe,
  limit = 200,
): Promise<Candle[]> {
  const instId = toInstId(symbol)
  if (!instId) return []
  const rows = await okx<string[][]>(
    `/api/v5/market/candles?instId=${instId}&bar=${BAR[timeframe]}&limit=${Math.min(limit, 300)}`,
  )
  return (rows ?? [])
    .map((row) => ({
      time: Number(row[0]),
      open: Number(row[1]),
      high: Number(row[2]),
      low: Number(row[3]),
      close: Number(row[4]),
      volume: Number(row[5]),
    }))
    .filter((c) => Number.isFinite(c.close) && Number.isFinite(c.time))
    // OKX returns newest-first; the chart expects chronological order.
    .sort((a, b) => a.time - b.time)
}

/* -------------------------------------------------------------------------- */
/* Order book + recent trades                                                 */
/* -------------------------------------------------------------------------- */

export async function getOrderBook(symbol: string, limit = 25): Promise<OrderBook> {
  const instId = toInstId(symbol)
  if (!instId) throw new ProviderError(PROVIDER, `Unsupported symbol ${symbol}`)

  const [book] = await okx<{ bids: string[][]; asks: string[][]; ts: string }[]>(
    `/api/v5/market/books?instId=${instId}&sz=${Math.min(limit, 400)}`,
  )
  if (!book) throw new ProviderError(PROVIDER, `No order book for ${symbol}`)

  const level = (row: string[]) => ({ price: Number(row[0]), size: Number(row[1]) })
  const ts = Number(book.ts)
  return {
    id: buildAssetId('crypto', normalizeSymbol(symbol)),
    bids: (book.bids ?? []).map(level),
    asks: (book.asks ?? []).map(level),
    provider: PROVIDER,
    timestamp: Number.isFinite(ts) ? ts : Date.now(),
  }
}

export async function getRecentTrades(symbol: string, limit = 30): Promise<Trade[]> {
  const instId = toInstId(symbol)
  if (!instId) return []
  const rows = await okx<{ tradeId: string; px: string; sz: string; side: string; ts: string }[]>(
    `/api/v5/market/trades?instId=${instId}&limit=${Math.min(limit, 500)}`,
  )
  return (rows ?? []).map((t) => ({
    id: t.tradeId,
    price: Number(t.px),
    size: Number(t.sz),
    side: t.side?.toLowerCase() === 'sell' ? 'sell' : 'buy',
    time: Number(t.ts),
  }))
}

/* -------------------------------------------------------------------------- */
/* Instruments — powers crypto search when Bybit is unreachable               */
/* -------------------------------------------------------------------------- */

interface OkxInstrument {
  instId: string
  baseCcy: string
  quoteCcy: string
  state: string
}

export async function getInstruments(): Promise<OkxInstrument[]> {
  const list = await okx<OkxInstrument[]>('/api/v5/public/instruments?instType=SPOT')
  return (list ?? []).filter((i) => i.state === 'live')
}

export async function searchPairs(query: string, limit = 12): Promise<SearchResult[]> {
  const q = normalizeSymbol(query)
  if (!q) return []

  const instruments = await getInstruments()
  return instruments
    .map((i) => {
      const symbol = fromInstId(i.instId)
      let score = 0
      if (symbol === q) score = 100
      else if (i.baseCcy === q) score = 90
      else if (symbol.startsWith(q)) score = 70
      else if (i.baseCcy.startsWith(q)) score = 60
      else if (symbol.includes(q)) score = 30
      if (score && i.quoteCcy === 'USDT') score += 8
      return { i, symbol, score }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ i, symbol, score }) => ({
      id: buildAssetId('crypto', symbol),
      type: 'crypto' as const,
      symbol,
      display: displaySymbol('crypto', symbol),
      name: cryptoBySymbol(symbol)?.name ?? i.baseCcy,
      exchange: 'OKX',
      provider: PROVIDER,
      score,
    }))
}
