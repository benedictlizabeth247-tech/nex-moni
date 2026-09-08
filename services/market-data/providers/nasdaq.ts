/**
 * @fileOverview Nasdaq provider — keyless fallback for US equities.
 *
 * Final link in the equity failover chain. Serves real-time consolidated prices
 * for stocks, ETFs and Nasdaq indices plus intraday/daily candles, without an
 * API key. Used only when Yahoo Finance is rate-limited and no premium key
 * (Finnhub / Twelve Data / Polygon) is configured.
 *
 * Coverage: US-listed stocks, ETFs and Nasdaq-family indices. Forex and
 * commodities are handled by `exchangerate.ts` / the keyed providers, so this
 * module deliberately reports `supports() === false` for them.
 */

import { fetchJson } from '../http'
import { assetName, buildAssetId, displaySymbol, equityMeta } from '../symbols'
import type { AssetProfile, AssetType, Candle, Quote, SearchResult, Timeframe } from '../types'

const PROVIDER = 'nasdaq' as const
const BASE = 'https://api.nasdaq.com/api'

/** Nasdaq's `assetclass` query parameter per asset type. */
const ASSET_CLASS: Partial<Record<AssetType, string>> = {
  stock: 'stocks',
  etf: 'etf',
  index: 'index',
}

/**
 * Nasdaq index tickers differ from our canonical ids and only the Nasdaq
 * families are available. The S&P 500, Dow Jones and VIX are absent from this
 * API entirely (they answer "Symbol not exists"), so those are served by the
 * keyless `cnbc.ts` provider that follows this one in the chain.
 */
const INDEX_TICKER: Record<string, string> = {
  NDX: 'NDX',
  COMP: 'COMP',
  IXIC: 'COMP',
}

export const supports = (type: AssetType): boolean => type in ASSET_CLASS

/** Keyless — always available as the last-resort equity source. */
export const isEnabled = () => true

const ticker = (type: AssetType, symbol: string): string | null => {
  const s = symbol.toUpperCase()
  if (type === 'index') return INDEX_TICKER[s] ?? null
  return s
}

/** `"$301.24"` / `"25,190.63"` / `"-9.65%"` -> number */
const num = (raw?: string | null): number | undefined => {
  if (!raw) return undefined
  const cleaned = raw.replace(/[$,%\s]/g, '').replace(/,/g, '')
  const value = Number(cleaned)
  return Number.isFinite(value) ? value : undefined
}

/** `"201.50 - 344.57"` -> `[201.5, 344.57]` */
const range = (raw?: string): [number | undefined, number | undefined] => {
  const parts = (raw ?? '').split('-').map((p) => num(p.trim()))
  return [parts[0], parts[1]]
}

interface QuoteInfo {
  symbol: string
  companyName?: string
  stockType?: string | null
  exchange?: string | null
  assetClass?: string
  marketStatus?: string
  primaryData?: {
    lastSalePrice?: string
    netChange?: string
    percentageChange?: string
    deltaIndicator?: string
    lastTradeTimestamp?: string
    volume?: string
    currency?: string | null
  }
  keyStats?: Record<string, { label?: string; value?: string }> | null
}

interface InfoResponse {
  data: QuoteInfo | null
  status?: { rCode?: number; bCodeMessage?: { errorMessage?: string }[] | null }
}

async function info(type: AssetType, symbol: string): Promise<QuoteInfo> {
  const t = ticker(type, symbol)
  const assetClass = ASSET_CLASS[type]
  if (!t || !assetClass) throw new Error(`[nasdaq] Unsupported asset ${type}:${symbol}`)

  const json = await fetchJson<InfoResponse>(
    PROVIDER,
    `${BASE}/quote/${encodeURIComponent(t)}/info?assetclass=${assetClass}`,
    { retries: 1 },
  )
  // Nasdaq answers 200 with a null payload for unknown symbols.
  if (!json.data) {
    const reason = json.status?.bCodeMessage?.[0]?.errorMessage ?? 'No data'
    throw new Error(`[nasdaq] ${symbol}: ${reason}`)
  }
  return json.data
}

const buildQuote = (type: AssetType, symbol: string, data: QuoteInfo): Quote => {
  const p = data.primaryData ?? {}
  const price = num(p.lastSalePrice) ?? 0
  const change = num(p.netChange) ?? 0
  const percent = num(p.percentageChange) ?? 0
  // Nasdaq encodes direction separately from the magnitude.
  const negative = (p.deltaIndicator ?? '').toLowerCase() === 'down'
  const signedChange = negative ? -Math.abs(change) : Math.abs(change)
  const signedPercent = negative ? -Math.abs(percent) : Math.abs(percent)
  const previousClose = num(data.keyStats?.previousclose?.value) ?? price - signedChange

  const [low, high] = range(data.keyStats?.dayrange?.value ?? data.keyStats?.dayRange?.value)
  const parsedTime = p.lastTradeTimestamp
    ? Date.parse(p.lastTradeTimestamp.replace(/\s+ET$/, ' EDT'))
    : NaN

  return {
    id: buildAssetId(type, symbol),
    type,
    symbol: symbol.toUpperCase(),
    display: displaySymbol(type, symbol),
    name: data.companyName || assetName(type, symbol),
    exchange: data.exchange ?? undefined,
    price,
    change: signedChange,
    changePercent: signedPercent,
    open: previousClose,
    high,
    low,
    close: price,
    previousClose,
    volume: num(p.volume),
    currency: p.currency ?? 'USD',
    provider: PROVIDER,
    timestamp: Number.isFinite(parsedTime) ? parsedTime : Date.now(),
  }
}

/**
 * Nasdaq has no batch endpoint, so symbols are fetched concurrently. Failures
 * are isolated per symbol — one delisted ticker never fails the whole board.
 */
export async function getQuotes(assets: { type: AssetType; symbol: string }[]): Promise<Quote[]> {
  const supported = assets.filter((a) => supports(a.type) && ticker(a.type, a.symbol))
  if (!supported.length) return []

  const settled = await Promise.allSettled(
    supported.map(async (a) => buildQuote(a.type, a.symbol, await info(a.type, a.symbol))),
  )
  return settled
    .filter((r): r is PromiseFulfilledResult<Quote> => r.status === 'fulfilled')
    .map((r) => r.value)
    .filter((q) => q.price > 0)
}

export async function getQuote(type: AssetType, symbol: string): Promise<Quote> {
  return buildQuote(type, symbol, await info(type, symbol))
}

/* -------------------------------------------------------------------------- */
/* Candles                                                                    */
/* -------------------------------------------------------------------------- */

/** Timeframes served by the intraday chart endpoint; the rest use daily bars. */
const INTRADAY: Timeframe[] = ['1m', '5m', '15m', '1H', '4H']

/** Minutes per bar, used to bucket Nasdaq's 1-minute chart points. */
const BUCKET_MINUTES: Record<string, number> = {
  '1m': 1,
  '5m': 5,
  '15m': 15,
  '1H': 60,
  '4H': 240,
}

/** Trading days of daily history to request per timeframe. */
const DAILY_DAYS: Record<string, number> = {
  '1D': 365,
  '1W': 5 * 365,
  '1M': 10 * 365,
}

interface ChartResponse {
  data: {
    chart?: { x: number; y: number }[] | null
    previousClose?: string
  } | null
}

interface HistoricalResponse {
  data: {
    tradesTable?: {
      rows?: { date: string; close: string; volume: string; open: string; high: string; low: string }[]
    } | null
  } | null
}

/** Fold 1-minute price points into OHLC bars of `minutes` width. */
const bucketize = (points: { x: number; y: number }[], minutes: number): Candle[] => {
  const width = minutes * 60_000
  const buckets = new Map<number, Candle>()

  for (const point of points) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue
    const start = Math.floor(point.x / width) * width
    const existing = buckets.get(start)
    if (!existing) {
      buckets.set(start, {
        time: start,
        open: point.y,
        high: point.y,
        low: point.y,
        close: point.y,
        volume: 0,
      })
      continue
    }
    existing.high = Math.max(existing.high, point.y)
    existing.low = Math.min(existing.low, point.y)
    existing.close = point.y
  }

  return Array.from(buckets.values()).sort((a, b) => a.time - b.time)
}

/** Aggregate daily bars into weekly / monthly bars. */
const groupDaily = (candles: Candle[], unit: 'week' | 'month'): Candle[] => {
  const keyOf = (time: number) => {
    const d = new Date(time)
    if (unit === 'month') return `${d.getUTCFullYear()}-${d.getUTCMonth()}`
    // ISO week bucket: shift to the Monday of that week.
    const monday = new Date(time)
    const day = (monday.getUTCDay() + 6) % 7
    monday.setUTCDate(monday.getUTCDate() - day)
    return monday.toISOString().slice(0, 10)
  }

  const groups = new Map<string, Candle[]>()
  for (const candle of candles) {
    const key = keyOf(candle.time)
    groups.set(key, [...(groups.get(key) ?? []), candle])
  }

  return Array.from(groups.values())
    .map((slice) => ({
      time: slice[0].time,
      open: slice[0].open,
      close: slice[slice.length - 1].close,
      high: Math.max(...slice.map((c) => c.high)),
      low: Math.min(...slice.map((c) => c.low)),
      volume: slice.reduce((sum, c) => sum + c.volume, 0),
    }))
    .sort((a, b) => a.time - b.time)
}

const isoDate = (d: Date) => d.toISOString().slice(0, 10)

export async function getCandles(
  type: AssetType,
  symbol: string,
  timeframe: Timeframe,
): Promise<Candle[]> {
  const t = ticker(type, symbol)
  const assetClass = ASSET_CLASS[type]
  if (!t || !assetClass) return []

  if (INTRADAY.includes(timeframe)) {
    const json = await fetchJson<ChartResponse>(
      PROVIDER,
      `${BASE}/quote/${encodeURIComponent(t)}/chart?assetclass=${assetClass}`,
      { retries: 1 },
    )
    const points = json.data?.chart ?? []
    if (!points.length) return []
    return bucketize(points, BUCKET_MINUTES[timeframe] ?? 5)
  }

  const days = DAILY_DAYS[timeframe] ?? 365
  const to = new Date()
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000)
  const json = await fetchJson<HistoricalResponse>(
    PROVIDER,
    `${BASE}/quote/${encodeURIComponent(t)}/historical?assetclass=${assetClass}` +
      `&fromdate=${isoDate(from)}&todate=${isoDate(to)}&limit=${Math.min(days, 5000)}`,
    { retries: 1 },
  )

  const rows = json.data?.tradesTable?.rows ?? []
  const daily: Candle[] = []
  for (const row of rows) {
    const [month, day, year] = row.date.split('/').map(Number)
    const time = Date.UTC(year, (month ?? 1) - 1, day ?? 1)
    const open = num(row.open)
    const high = num(row.high)
    const low = num(row.low)
    const close = num(row.close)
    if (!Number.isFinite(time) || open == null || high == null || low == null || close == null) continue
    daily.push({ time, open, high, low, close, volume: num(row.volume) ?? 0 })
  }
  daily.sort((a, b) => a.time - b.time)

  if (timeframe === '1W') return groupDaily(daily, 'week')
  if (timeframe === '1M') return groupDaily(daily, 'month')
  return daily
}

/* -------------------------------------------------------------------------- */
/* Search + profile                                                           */
/* -------------------------------------------------------------------------- */

interface ScreenerResponse {
  data?: {
    tableData?: { symbol: string; companyName?: string; name?: string }[] | null
    records?: { symbol: string; name?: string }[] | null
  } | null
}

/**
 * Nasdaq's public autocomplete is unstable, so search is served by resolving
 * the query against the live quote endpoints. An exact ticker hit returns a
 * real, tradable instrument — which is exactly what the search UI needs from a
 * fallback provider.
 */
export async function search(query: string, limit = 10): Promise<SearchResult[]> {
  const symbol = query.trim().toUpperCase()
  if (!symbol || symbol.length > 6 || !/^[A-Z.\-]+$/.test(symbol)) return []

  const attempts: AssetType[] = ['stock', 'etf', 'index']
  const settled = await Promise.allSettled(
    attempts.map(async (type): Promise<SearchResult> => {
      const data = await info(type, symbol)
      return {
        id: buildAssetId(type, symbol),
        type,
        symbol,
        display: displaySymbol(type, symbol),
        name: data.companyName || assetName(type, symbol),
        exchange: data.exchange ?? undefined,
        provider: PROVIDER,
        score: 70,
      }
    }),
  )

  return settled
    .filter((r): r is PromiseFulfilledResult<SearchResult> => r.status === 'fulfilled')
    .map((r) => r.value)
    .slice(0, limit)
}

export async function getProfile(type: AssetType, symbol: string): Promise<AssetProfile | null> {
  if (!supports(type)) return null
  try {
    const data = await info(type, symbol)
    const stats = data.keyStats ?? {}
    const metrics = Object.values(stats)
      .filter((s) => s?.label && s?.value)
      .map((s) => ({ label: s.label!.replace(/:$/, ''), value: s.value! }))

    return {
      id: buildAssetId(type, symbol),
      name: data.companyName || assetName(type, symbol),
      metrics: [
        { label: 'Exchange', value: data.exchange || '—' },
        { label: 'Instrument', value: data.stockType || data.assetClass || '—' },
        { label: 'Market Status', value: data.marketStatus || '—' },
        ...metrics,
      ],
      provider: PROVIDER,
    }
  } catch {
    return null
  }
}

/** Exposed so the router can skip index symbols Nasdaq cannot serve. */
export const canServe = (type: AssetType, symbol: string): boolean =>
  supports(type) && Boolean(ticker(type, symbol)) && Boolean(equityMeta(type, symbol) || type !== 'index')
