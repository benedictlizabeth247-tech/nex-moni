/**
 * @fileOverview CNBC provider — keyless fallback for indices and commodities.
 *
 * Final link in the index and commodity failover chains, and the only keyless
 * source in the stack that covers the S&P 500, the Dow Jones Industrial Average
 * and the VIX. Nasdaq's public quote API is limited to Nasdaq-family
 * instruments (`SPX` / `DJI` / `VIX` all answer "Symbol not exists"), and it
 * carries no commodities at all, so without this provider both asset classes
 * resolve only while Yahoo Finance is reachable — which fails on any host Yahoo
 * rate-limits.
 *
 * Scope is deliberately narrow. Stocks and ETFs are already covered by Nasdaq
 * and forex by Exchange Rate, so `supports()` reports false for them and the
 * router never reaches here for those asset types.
 *
 * Candles: CNBC exposes no public time-series endpoint, so index history is
 * served by the tracking-fund proxy below (S&P 500 -> SPY, Dow -> DIA,
 * Nasdaq 100 -> QQQ) through the existing keyless Nasdaq provider. Shape and
 * percentage moves track the index; absolute levels are the fund's, so this is
 * used strictly as a last-resort chart source after Yahoo and the keyed
 * providers have all failed.
 */

import { fetchJson } from '../http'
import { assetName, buildAssetId, displaySymbol } from '../symbols'
import type { AssetProfile, AssetType, Candle, Quote, SearchResult, Timeframe } from '../types'
import * as nasdaq from './nasdaq'

const PROVIDER = 'cnbc' as const

const BASE =
  'https://quote.cnbc.com/quote-html-webservice/restQuote/symbolType/symbol'

/**
 * Our canonical index symbol -> CNBC feed symbol. CNBC prefixes index symbols
 * with a dot and uses `.SPX` / `.DJI` rather than Yahoo's `^GSPC` / `^DJI`.
 */
const INDEX_SYMBOL: Record<string, string> = {
  SPX: '.SPX',
  GSPC: '.SPX',
  DJI: '.DJI',
  VIX: '.VIX',
  NDX: '.NDX',
  COMP: '.IXIC',
  IXIC: '.IXIC',
}

/**
 * Commodities. Spot feeds (`XAU=`) are preferred because our symbols are spot
 * pairs; where CNBC has no spot feed the front-month future (`@CL.1`) is used,
 * which is the standard reference price for those contracts.
 */
const COMMODITY_SYMBOL: Record<string, string> = {
  XAUUSD: 'XAU=',
  XAGUSD: 'XAG=',
  XPTUSD: 'XPT=',
  XPDUSD: 'XPD=',
  WTIUSD: '@CL.1',
  BRENTUSD: '@LCO.1',
  NGASUSD: '@NG.1',
  XCUUSD: '@HG.1',
}

const FEED_SYMBOL: Partial<Record<AssetType, Record<string, string>>> = {
  index: INDEX_SYMBOL,
  commodity: COMMODITY_SYMBOL,
}

/** Reverse lookup so a batched response can be matched back to our ids. */
const CANONICAL: Record<string, string> = {
  '.SPX': 'SPX',
  '.DJI': 'DJI',
  '.VIX': 'VIX',
  '.NDX': 'NDX',
  '.IXIC': 'COMP',
}

/**
 * Exchange-traded funds that track each index, used only for chart history.
 * The VIX has no spot-tracking fund (VIXY holds futures, so its shape diverges
 * materially), which is why it is intentionally absent.
 */
const CHART_PROXY: Record<string, string> = {
  SPX: 'SPY',
  DJI: 'DIA',
  NDX: 'QQQ',
  COMP: 'QQQ',
}

/**
 * The same proxy approach for commodities: physically-backed funds where they
 * exist (the metals), otherwise the standard front-month futures fund. Without
 * these, commodity charts render empty on any host Yahoo rate-limits, because
 * every remaining commodity history source in the chain needs an API key.
 */
const COMMODITY_CHART_PROXY: Record<string, string> = {
  XAUUSD: 'GLD',
  XAGUSD: 'SLV',
  XPTUSD: 'PPLT',
  XPDUSD: 'PALL',
  WTIUSD: 'USO',
  BRENTUSD: 'BNO',
  NGASUSD: 'UNG',
  XCUUSD: 'CPER',
}

const proxyTable = (type: AssetType): Record<string, string> =>
  type === 'commodity' ? COMMODITY_CHART_PROXY : CHART_PROXY

export const supports = (type: AssetType): boolean => type in FEED_SYMBOL

/** Keyless — always available as the last-resort index / commodity source. */
export const isEnabled = () => true

const feedSymbol = (type: AssetType, symbol: string): string | null =>
  FEED_SYMBOL[type]?.[symbol.toUpperCase()] ?? null

/** True when this provider can serve the given instrument. */
export const canServe = (type: AssetType, symbol: string): boolean =>
  supports(type) && Boolean(feedSymbol(type, symbol))

/** `"7,489.72"` / `"+0.70%"` / `"-52.09"` -> number */
const num = (raw?: string | null): number | undefined => {
  if (raw == null) return undefined
  const cleaned = String(raw).replace(/[$,%\s+]/g, '')
  if (!cleaned || cleaned === '-' || cleaned.toUpperCase() === 'UNCH') return undefined
  const value = Number(cleaned)
  return Number.isFinite(value) ? value : undefined
}

interface CnbcQuote {
  symbol?: string
  feedSymbol?: string
  name?: string
  shortName?: string
  last?: string
  open?: string
  high?: string
  low?: string
  change?: string
  change_pct?: string
  changetype?: string
  previous_day_closing?: string
  currencyCode?: string
  exchange?: string
  last_time?: string
  volume?: string
  yrhiprice?: string
  yrloprice?: string
  curmktstatus?: string
  code?: number
}

interface CnbcResponse {
  FormattedQuoteResult?: {
    FormattedQuote?: CnbcQuote | CnbcQuote[] | null
  }
}

/** Map a CNBC index symbol back to our canonical asset, for unbatched replies. */
const resolveCanonical = (
  feed?: string,
): { type: AssetType; symbol: string } | undefined => {
  const symbol = feed ? CANONICAL[feed] : undefined
  return symbol ? { type: 'index', symbol } : undefined
}

/** CNBC returns a bare object for a single symbol and an array for many. */
const toArray = (value: CnbcQuote | CnbcQuote[] | null | undefined): CnbcQuote[] =>
  Array.isArray(value) ? value : value ? [value] : []

async function fetchQuotes(feedSymbols: string[]): Promise<CnbcQuote[]> {
  const url =
    `${BASE}?symbols=${encodeURIComponent(feedSymbols.join('|'))}` +
    '&requestMethod=itv&noform=1&partnerId=2&fund=1&exthrs=1&output=json&events=1'

  const json = await fetchJson<CnbcResponse>(PROVIDER, url, { retries: 1 })
  return toArray(json.FormattedQuoteResult?.FormattedQuote).filter((q) => q.code === 0 || !q.code)
}

const buildQuote = (type: AssetType, symbol: string, data: CnbcQuote): Quote => {
  const price = num(data.last) ?? 0
  const magnitude = num(data.change)
  const percentMagnitude = num(data.change_pct)
  // CNBC encodes direction in `changetype` and keeps the magnitude unsigned on
  // some feeds, so the sign is applied explicitly.
  const down = (data.changetype ?? '').toUpperCase() === 'DOWN'
  const sign = down ? -1 : 1
  const change = magnitude == null ? 0 : sign * Math.abs(magnitude)
  const changePercent = percentMagnitude == null ? 0 : sign * Math.abs(percentMagnitude)
  const previousClose = num(data.previous_day_closing) ?? price - change
  const parsedTime = data.last_time ? Date.parse(data.last_time) : NaN

  return {
    id: buildAssetId(type, symbol),
    type,
    symbol: symbol.toUpperCase(),
    display: displaySymbol(type, symbol),
    // Curated names stay authoritative; CNBC contract labels ("Gold COMEX
    // (Dec'26)") are only used for instruments we do not name ourselves.
    name: assetName(type, symbol) || data.shortName || data.name || symbol.toUpperCase(),
    exchange: data.exchange || undefined,
    price,
    change,
    changePercent,
    open: num(data.open) ?? previousClose,
    high: num(data.high),
    low: num(data.low),
    close: price,
    previousClose,
    volume: num(data.volume),
    currency: data.currencyCode || 'USD',
    provider: PROVIDER,
    timestamp: Number.isFinite(parsedTime) ? parsedTime : Date.now(),
  }
}

/**
 * Batched in a single request — CNBC accepts a pipe-delimited symbol list, so
 * the whole index board costs one upstream call.
 */
export async function getQuotes(assets: { type: AssetType; symbol: string }[]): Promise<Quote[]> {
  const wanted = new Map<string, { type: AssetType; symbol: string }>()
  for (const asset of assets) {
    const feed = supports(asset.type) ? feedSymbol(asset.type, asset.symbol) : null
    if (feed) wanted.set(feed, { type: asset.type, symbol: asset.symbol.toUpperCase() })
  }
  if (!wanted.size) return []

  const rows = await fetchQuotes(Array.from(wanted.keys()))

  const quotes: Quote[] = []
  for (const row of rows) {
    // `symbol` echoes back the symbol we requested; `feedSymbol` is the
    // exchange's own code and differs for futures (`@CL.1` -> `/CLU26`), so the
    // requested symbol is matched first.
    const target =
      (row.symbol ? wanted.get(row.symbol) : undefined) ??
      (row.feedSymbol ? wanted.get(row.feedSymbol) : undefined) ??
      resolveCanonical(row.symbol) ??
      resolveCanonical(row.feedSymbol)
    if (!target) continue
    const quote = buildQuote(target.type, target.symbol, row)
    if (quote.price > 0) quotes.push(quote)
  }
  return quotes
}

export async function getQuote(type: AssetType, symbol: string): Promise<Quote | null> {
  const [quote] = await getQuotes([{ type, symbol }])
  return quote ?? null
}

/* -------------------------------------------------------------------------- */
/* Candles (tracking-fund proxy)                                              */
/* -------------------------------------------------------------------------- */

/**
 * Index history via the fund that tracks it. Returns an empty series — rather
 * than a misleading one — for any index without a suitable spot tracker.
 */
export async function getCandles(
  type: AssetType,
  symbol: string,
  timeframe: Timeframe,
): Promise<Candle[]> {
  if (type !== 'index' && type !== 'commodity') return []
  const proxy = proxyTable(type)[symbol.toUpperCase()]
  if (!proxy) return []
  // These proxies are real exchange-traded instruments used only as a public,
  // keyless fallback when the direct Yahoo/keyed history providers fail. The
  // UI should label the source accordingly; never manufacture a price series.
  return nasdaq.getCandles('etf', proxy, timeframe)
}

/** The real tracking instrument used as a last-resort chart source. */
export const chartProxyFor = (symbol: string, type: AssetType = 'index'): string | undefined =>
  proxyTable(type)[symbol.toUpperCase()]

/* -------------------------------------------------------------------------- */
/* Search + profile                                                           */
/* -------------------------------------------------------------------------- */

/** Resolves exact index / commodity tickers (and aliases) against the live feed. */
export async function search(query: string, limit = 5): Promise<SearchResult[]> {
  const raw = query.trim().toUpperCase().replace(/^[\^.]/, '')
  if (!raw || raw.length > 8) return []

  const matches: { type: AssetType; symbol: string }[] = []
  for (const [type, table] of Object.entries(FEED_SYMBOL)) {
    for (const symbol of Object.keys(table ?? {})) {
      if (symbol.startsWith(raw)) matches.push({ type: type as AssetType, symbol })
    }
  }
  if (!matches.length) return []

  const quotes = await getQuotes(matches)
  const seen = new Set<string>()

  return quotes
    .filter((q) => (seen.has(q.id) ? false : seen.add(q.id)))
    .slice(0, limit)
    .map((q) => ({
      id: q.id,
      type: q.type,
      symbol: q.symbol,
      display: q.display,
      name: q.name,
      exchange: q.exchange,
      provider: PROVIDER,
      score: q.symbol === raw ? 70 : 45,
    }))
}

export async function getProfile(type: AssetType, symbol: string): Promise<AssetProfile | null> {
  if (!canServe(type, symbol)) return null
  try {
    const [row] = await fetchQuotes([feedSymbol(type, symbol)!])
    if (!row) return null

    const metrics = [
      { label: 'Instrument', value: type === 'index' ? 'Market Index' : 'Commodity' },
      { label: 'Exchange', value: row.exchange || '—' },
      { label: 'Market Status', value: row.curmktstatus === 'REG_MKT' ? 'Open' : 'Closed' },
      { label: '52 Week High', value: row.yrhiprice || '—' },
      { label: '52 Week Low', value: row.yrloprice || '—' },
    ]

    return {
      id: buildAssetId(type, symbol),
      name: assetName(type, symbol) || row.name || row.shortName || symbol.toUpperCase(),
      metrics,
      provider: PROVIDER,
    }
  } catch {
    return null
  }
}
