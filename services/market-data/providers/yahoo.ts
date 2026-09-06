/**
 * @fileOverview Yahoo Finance provider — keyless public market information.
 *
 * Used for stocks, ETFs, indices, forex and commodities when no premium key is
 * configured, and for public information (profiles, market summary, headlines)
 * even when a premium provider handles the real-time quote. Never used as the
 * primary source for real-time trading or order-book data.
 */

import { fetchJson } from '../http'
import {
  buildAssetId,
  displaySymbol,
  equityMetaByYahoo,
  YAHOO_RANGE,
  yahooSymbol,
  assetName,
} from '../symbols'
import type {
  AssetProfile,
  AssetType,
  Candle,
  Headline,
  Quote,
  SearchResult,
  Timeframe,
} from '../types'

const PROVIDER = 'yahoo' as const
const HOSTS = ['https://query2.finance.yahoo.com', 'https://query1.finance.yahoo.com']

/**
 * Yahoo's edge throttles bursts per host, so we rotate hosts on the first pass
 * (no per-host retry) and only then fall back to backoff retries.
 */
async function yf<T>(path: string): Promise<T> {
  let lastError: unknown
  for (const host of HOSTS) {
    try {
      return await fetchJson<T>(PROVIDER, `${host}${path}`, { retries: 0 })
    } catch (err) {
      lastError = err
    }
  }
  // Both hosts rejected the burst — retry the primary with exponential backoff.
  try {
    return await fetchJson<T>(PROVIDER, `${HOSTS[0]}${path}`, { retries: 2 })
  } catch (err) {
    lastError = err
  }
  throw lastError instanceof Error ? lastError : new Error('[yahoo] Unreachable')
}

/* -------------------------------------------------------------------------- */
/* Quotes                                                                     */
/* -------------------------------------------------------------------------- */

interface ChartResponse {
  chart: {
    result:
      | {
          meta: {
            currency?: string
            symbol: string
            exchangeName?: string
            fullExchangeName?: string
            instrumentType?: string
            regularMarketPrice?: number
            chartPreviousClose?: number
            previousClose?: number
            regularMarketDayHigh?: number
            regularMarketDayLow?: number
            regularMarketVolume?: number
            fiftyTwoWeekHigh?: number
            fiftyTwoWeekLow?: number
            longName?: string
            shortName?: string
            regularMarketTime?: number
          }
          timestamp?: number[]
          indicators: {
            quote: {
              open?: (number | null)[]
              high?: (number | null)[]
              low?: (number | null)[]
              close?: (number | null)[]
              volume?: (number | null)[]
            }[]
          }
        }[]
      | null
    error?: { code: string; description: string } | null
  }
}

const buildQuote = (
  type: AssetType,
  symbol: string,
  meta: NonNullable<ChartResponse['chart']['result']>[number]['meta'],
): Quote => {
  const price = meta.regularMarketPrice ?? 0
  const prev = meta.chartPreviousClose ?? meta.previousClose ?? price
  return {
    id: buildAssetId(type, symbol),
    type,
    symbol,
    display: displaySymbol(type, symbol),
    name: meta.longName || meta.shortName || assetName(type, symbol),
    exchange: meta.fullExchangeName || meta.exchangeName,
    price,
    change: price - prev,
    changePercent: prev ? ((price - prev) / prev) * 100 : 0,
    open: prev,
    high: meta.regularMarketDayHigh,
    low: meta.regularMarketDayLow,
    close: price,
    previousClose: prev,
    volume: meta.regularMarketVolume,
    currency: meta.currency ?? 'USD',
    provider: PROVIDER,
    timestamp: (meta.regularMarketTime ?? Math.floor(Date.now() / 1000)) * 1000,
  }
}

export async function getQuote(type: AssetType, symbol: string): Promise<Quote> {
  const ticker = yahooSymbol(type, symbol)
  const json = await yf<ChartResponse>(
    `/v8/finance/chart/${encodeURIComponent(ticker)}?range=1d&interval=5m`,
  )
  const result = json.chart.result?.[0]
  if (!result) throw new Error(`[yahoo] No data for ${ticker}`)
  return buildQuote(type, symbol, result.meta)
}

interface SparkResponse {
  [ticker: string]: {
    symbol: string
    close?: (number | null)[]
    chartPreviousClose?: number
    previousClose?: number
    timestamp?: number[]
  }
}

/** Batched lightweight quotes (price + 24h change) for market lists. */
export async function getQuotes(assets: { type: AssetType; symbol: string }[]): Promise<Quote[]> {
  if (!assets.length) return []
  const tickers = assets.map((a) => yahooSymbol(a.type, a.symbol))
  const json = await yf<SparkResponse>(
    `/v8/finance/spark?symbols=${tickers.map(encodeURIComponent).join(',')}&range=1d&interval=5m`,
  )
  const out: Quote[] = []
  assets.forEach((asset, i) => {
    const entry = json[tickers[i]]
    if (!entry) return
    const closes = (entry.close ?? []).filter((c): c is number => typeof c === 'number')
    const price = closes[closes.length - 1]
    const prev = entry.chartPreviousClose ?? entry.previousClose ?? price
    if (typeof price !== 'number') return
    out.push({
      id: buildAssetId(asset.type, asset.symbol),
      type: asset.type,
      symbol: asset.symbol.toUpperCase(),
      display: displaySymbol(asset.type, asset.symbol),
      name: assetName(asset.type, asset.symbol),
      price,
      change: price - prev,
      changePercent: prev ? ((price - prev) / prev) * 100 : 0,
      open: prev,
      high: closes.length ? Math.max(...closes) : undefined,
      low: closes.length ? Math.min(...closes) : undefined,
      close: price,
      previousClose: prev,
      currency: 'USD',
      provider: PROVIDER,
      timestamp: entry.timestamp?.length ? entry.timestamp[entry.timestamp.length - 1] * 1000 : Date.now(),
    })
  })
  return out
}

/* -------------------------------------------------------------------------- */
/* Candles                                                                    */
/* -------------------------------------------------------------------------- */

/** Aggregate N consecutive candles into one (Yahoo has no native 4H bars). */
const aggregate = (candles: Candle[], factor: number): Candle[] => {
  if (factor <= 1) return candles
  const out: Candle[] = []
  for (let i = 0; i < candles.length; i += factor) {
    const slice = candles.slice(i, i + factor)
    if (!slice.length) continue
    out.push({
      time: slice[0].time,
      open: slice[0].open,
      close: slice[slice.length - 1].close,
      high: Math.max(...slice.map((c) => c.high)),
      low: Math.min(...slice.map((c) => c.low)),
      volume: slice.reduce((sum, c) => sum + (c.volume || 0), 0),
    })
  }
  return out
}

export async function getCandles(
  type: AssetType,
  symbol: string,
  timeframe: Timeframe,
): Promise<Candle[]> {
  const ticker = yahooSymbol(type, symbol)
  const { interval, range } = YAHOO_RANGE[timeframe]
  const json = await yf<ChartResponse>(
    `/v8/finance/chart/${encodeURIComponent(ticker)}?range=${range}&interval=${interval}&includePrePost=false`,
  )
  const result = json.chart.result?.[0]
  if (!result?.timestamp) return []
  const q = result.indicators.quote?.[0] ?? {}
  const candles: Candle[] = []
  result.timestamp.forEach((t, i) => {
    const open = q.open?.[i]
    const high = q.high?.[i]
    const low = q.low?.[i]
    const close = q.close?.[i]
    if (open == null || high == null || low == null || close == null) return
    candles.push({ time: t * 1000, open, high, low, close, volume: q.volume?.[i] ?? 0 })
  })
  return timeframe === '4H' ? aggregate(candles, 4) : candles
}

/* -------------------------------------------------------------------------- */
/* Search + public information                                                */
/* -------------------------------------------------------------------------- */

interface SearchResponse {
  quotes?: {
    symbol: string
    shortname?: string
    longname?: string
    quoteType?: string
    typeDisp?: string
    exchDisp?: string
    exchange?: string
    sector?: string
    industry?: string
    score?: number
    isYahooFinance?: boolean
  }[]
  news?: { uuid: string; title: string; publisher: string; link: string; providerPublishTime: number }[]
}

const mapQuoteType = (quoteType?: string, symbol?: string): AssetType | null => {
  switch ((quoteType ?? '').toUpperCase()) {
    case 'EQUITY':
      return 'stock'
    case 'ETF':
    case 'MUTUALFUND':
      return 'etf'
    case 'INDEX':
      return 'index'
    case 'CURRENCY':
      return 'forex'
    case 'FUTURE':
      return 'commodity'
    case 'CRYPTOCURRENCY':
      return 'crypto'
    default:
      return symbol?.endsWith('=X') ? 'forex' : symbol?.endsWith('=F') ? 'commodity' : null
  }
}

/** Strip Yahoo suffixes so ids stay canonical (`EURUSD=X` -> `EURUSD`). */
const canonicalSymbol = (type: AssetType, ticker: string): string => {
  const known = equityMetaByYahoo(ticker)
  if (known) return known.symbol
  if (type === 'forex') {
    const raw = ticker.replace('=X', '').toUpperCase()
    return raw.length === 3 ? `USD${raw}` : raw
  }
  if (type === 'index') return ticker.replace('^', '').toUpperCase()
  return ticker.toUpperCase()
}

export async function search(query: string, limit = 10): Promise<SearchResult[]> {
  const json = await yf<SearchResponse>(
    `/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=${limit}&newsCount=0&enableFuzzyQuery=false`,
  )
  const out: SearchResult[] = []
  for (const q of json.quotes ?? []) {
    if (q.isYahooFinance === false) continue
    const type = mapQuoteType(q.quoteType, q.symbol)
    if (!type || type === 'crypto') continue
    const symbol = canonicalSymbol(type, q.symbol)
    out.push({
      id: buildAssetId(type, symbol),
      type,
      symbol,
      display: displaySymbol(type, symbol),
      name: q.longname || q.shortname || symbol,
      exchange: q.exchDisp || q.exchange,
      provider: PROVIDER,
      score: q.score ? Math.min(95, 40 + Math.log10(q.score) * 10) : 40,
    })
  }
  return out.slice(0, limit)
}

export async function getProfile(type: AssetType, symbol: string): Promise<AssetProfile | null> {
  const ticker = yahooSymbol(type, symbol)
  try {
    const [searchJson, chartJson] = await Promise.all([
      yf<SearchResponse>(
        `/v1/finance/search?q=${encodeURIComponent(ticker)}&quotesCount=1&newsCount=0`,
      ),
      yf<ChartResponse>(`/v8/finance/chart/${encodeURIComponent(ticker)}?range=1d&interval=1d`),
    ])
    const hit = searchJson.quotes?.[0]
    const meta = chartJson.chart.result?.[0]?.meta
    const fmt = (n?: number) =>
      typeof n === 'number' ? n.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—'
    return {
      id: buildAssetId(type, symbol),
      name: meta?.longName || meta?.shortName || hit?.longname || assetName(type, symbol),
      sector: hit?.sector,
      industry: hit?.industry,
      metrics: [
        { label: 'Exchange', value: meta?.fullExchangeName || hit?.exchDisp || '—' },
        { label: 'Instrument', value: meta?.instrumentType || hit?.typeDisp || '—' },
        { label: 'Currency', value: meta?.currency ?? 'USD' },
        { label: '52W High', value: fmt(meta?.fiftyTwoWeekHigh) },
        { label: '52W Low', value: fmt(meta?.fiftyTwoWeekLow) },
        { label: 'Day Volume', value: fmt(meta?.regularMarketVolume) },
      ],
      provider: PROVIDER,
    }
  } catch {
    return null
  }
}

export async function getHeadlines(query: string, limit = 6): Promise<Headline[]> {
  try {
    const json = await yf<SearchResponse>(
      `/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=0&newsCount=${limit}`,
    )
    return (json.news ?? []).map((n) => ({
      id: n.uuid,
      title: n.title,
      publisher: n.publisher,
      url: n.link,
      time: (n.providerPublishTime ?? 0) * 1000,
    }))
  } catch {
    return []
  }
}
