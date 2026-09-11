/**
 * @fileOverview The Market Data Service.
 *
 * Single entry point that aggregates every provider and routes each request by
 * asset type. The UI never talks to an external API — it only ever talks to
 * `/api/market/*`, which delegates here. Swapping a provider means editing this
 * file only.
 *
 *   crypto     -> Bybit (primary) -> OKX (keyless exchange fallback) -> CoinGecko
 *   stock/etf  -> Yahoo Finance -> Finnhub -> Twelve Data -> Polygon -> Nasdaq
 *   index      -> Yahoo Finance -> Finnhub -> Twelve Data -> Polygon -> Nasdaq -> CNBC
 *   forex      -> Yahoo Finance -> Finnhub -> Twelve Data -> Polygon -> Exchange Rate
 *   commodity  -> Yahoo Finance -> Twelve Data -> CNBC
 *   public info-> Yahoo Finance (profiles, headlines, market summary)
 *
 * Nasdaq, CNBC and Exchange Rate are keyless, so they close the chain in every
 * environment — including one with no API keys at all, or one whose IP is being
 * throttled by Yahoo. CNBC specifically covers the S&P 500, Dow Jones and VIX,
 * which Nasdaq's public API does not carry.
 */

import 'server-only'

import { logger } from '@/lib/logger'

import { cached, peekCache, putCache } from './http'
import * as bybit from './providers/bybit'
import * as cnbc from './providers/cnbc'
import * as coingecko from './providers/coingecko'
import * as exchangerate from './providers/exchangerate'
import * as finnhub from './providers/finnhub'
import * as nasdaq from './providers/nasdaq'
import * as okx from './providers/okx'
import * as polygon from './providers/polygon'
import * as twelvedata from './providers/twelvedata'
import * as yahoo from './providers/yahoo'
import {
  COMMODITY_UNIVERSE,
  CRYPTO_UNIVERSE,
  DEFAULT_BOARD_IDS,
  ETF_UNIVERSE,
  FOREX_UNIVERSE,
  INDEX_UNIVERSE,
  STOCK_UNIVERSE,
  buildAssetId,
  assetIconUrl,
  categoryIds,
  cryptoByBase,
  normalizeSymbol,
  parseAssetId,
  toAssetRef,
  type MarketCategory,
} from './symbols'
import type {
  AssetDetail,
  AssetProfile,
  AssetType,
  CandleSeries,
  MarketListResult,
  OrderBook,
  Quote,
  SearchResult,
  Timeframe,
  TradeFeed,
  Candle,
} from './types'

const TTL = {
  cryptoTickers: 5_000,
  equityQuote: 20_000,
  candles: 30_000,
  orderBook: 2_000,
  trades: 3_000,
  profile: 6 * 60 * 60 * 1000,
  headlines: 10 * 60 * 1000,
  search: 60_000,
  instruments: 30 * 60 * 1000,
}

/**
 * Provider degradation is expected (rate limits, geo-blocks) and always
 * recovered by the next link in the chain, so it is reported as a warning
 * through the app logger rather than as an error.
 */
const reportFallback = (stage: string, error: unknown) => {
  logger.warn(`market-data: ${stage}`, {
    reason: error instanceof Error ? error.message : String(error),
  })
}

/* -------------------------------------------------------------------------- */
/* Crypto                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Spot tickers from the first reachable exchange. Bybit is preferred, but it is
 * geo-blocked in some regions (HTTP 403), so OKX — same USDT spot pairs, also
 * keyless — takes over before we degrade to CoinGecko's slower REST snapshots.
 */
const okxSpotTickers = () => cached('okx:tickers', TTL.cryptoTickers, () => okx.getSpotTickers())

const cryptoTickers = () =>
  cached('crypto:tickers', TTL.cryptoTickers, async () => {
    try {
      return await bybit.getSpotTickers()
    } catch (err) {
      reportFallback('bybit tickers unavailable, trying OKX', err)
      return okxSpotTickers()
    }
  })

const marketCaps = async (): Promise<Map<string, number>> => {
  try {
    return await cached('cg:marketcaps', 5 * 60 * 1000, () => coingecko.getMarketCaps())
  } catch {
    return new Map()
  }
}

async function cryptoQuotes(symbols: string[]): Promise<Quote[]> {
  const wanted = symbols.map(normalizeSymbol)
  let fromExchange: Quote[] = []
  let missing = wanted

  try {
    const tickers = await cryptoTickers()
    fromExchange = wanted.map((s) => tickers.get(s)).filter((q): q is Quote => Boolean(q))
    const covered = new Set(fromExchange.map((q) => q.symbol))
    missing = wanted.filter((s) => !covered.has(s))
  } catch (err) {
    reportFallback('no exchange tickers available, falling back to CoinGecko', err)
  }

  // Pairs the primary exchange does not list are topped up from OKX before we
  // reach for CoinGecko, whose free tier is the most rate-limited link.
  if (missing.length) {
    try {
      const okxTickers = await okxSpotTickers()
      const fromOkx = missing.map((s) => okxTickers.get(s)).filter((q): q is Quote => Boolean(q))
      if (fromOkx.length) {
        fromExchange = [...fromExchange, ...fromOkx]
        const covered = new Set(fromExchange.map((q) => q.symbol))
        missing = missing.filter((s) => !covered.has(s))
      }
    } catch (err) {
      reportFallback('okx crypto top-up unavailable', err)
    }
  }

  let fallback: Quote[] = []
  if (missing.length) {
    try {
      fallback = await cached(`cg:quotes:${missing.join(',')}`, TTL.cryptoTickers * 4, () =>
        coingecko.getQuotes(missing),
      )
    } catch (err) {
      reportFallback('coingecko crypto fallback failed', err)
    }
  }

  const caps = await marketCaps()
  return [...fromExchange, ...fallback].map((q) => ({
    ...q,
    marketCap: q.marketCap ?? caps.get(q.symbol),
  }))
}

/* -------------------------------------------------------------------------- */
/* Non-crypto                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Yahoo Finance answers for every non-crypto asset class without a key, so it
 * leads. Keyed providers take over whenever Yahoo is rate-limited, geo-blocked
 * or returns an empty payload, and the keyless Nasdaq / Exchange Rate providers
 * close the chain so quotes still resolve with no API keys configured at all.
 *
 * Each link only fills the symbols still missing, so a partial answer from one
 * provider is topped up by the next instead of being discarded.
 */
async function equityQuotes(type: AssetType, symbols: string[]): Promise<Quote[]> {
  const assets = symbols.map((symbol) => ({ type, symbol }))
  const collected = new Map<string, Quote>()

  const remaining = () => assets.filter((a) => !collected.has(buildAssetId(a.type, a.symbol)))

  const chain: { name: string; run: (pending: typeof assets) => Promise<Quote[]> }[] = [
    { name: 'yahoo', run: (pending) => yahoo.getQuotes(pending) },
  ]

  if (finnhub.supports(type)) chain.push({ name: 'finnhub', run: (p) => finnhub.getQuotes(p) })
  if (twelvedata.supports(type)) chain.push({ name: 'twelvedata', run: (p) => twelvedata.getQuotes(p) })
  if (polygon.supports(type)) chain.push({ name: 'polygon', run: (p) => polygon.getQuotes(p) })
  // Keyless last resorts — always present, so quotes still resolve with no keys
  // configured at all and with every keyed provider exhausted.
  if (nasdaq.supports(type)) chain.push({ name: 'nasdaq', run: (p) => nasdaq.getQuotes(p) })
  // CNBC is the only keyless source covering S&P 500 / Dow / VIX, which Nasdaq's
  // public API cannot serve, so it closes the index chain.
  if (cnbc.supports(type)) chain.push({ name: 'cnbc', run: (p) => cnbc.getQuotes(p) })
  if (exchangerate.supports(type)) {
    chain.push({ name: 'exchangerate', run: (p) => exchangerate.getQuotes(p) })
  }

  for (const link of chain) {
    const pending = remaining()
    if (!pending.length) break
    try {
      for (const quote of await link.run(pending)) {
        if (quote.price > 0 && !collected.has(quote.id)) collected.set(quote.id, quote)
      }
    } catch (err) {
      reportFallback(`${type} quotes via ${link.name} unavailable`, err)
    }
  }

  return Array.from(collected.values())
}

/* -------------------------------------------------------------------------- */
/* Public API of the service                                                  */
/* -------------------------------------------------------------------------- */

export async function getQuotes(ids: string[]): Promise<MarketListResult> {
  const parsed = ids
    .map((id) => ({ id, ref: parseAssetId(id) }))
    .filter((x): x is { id: string; ref: { type: AssetType; symbol: string } } => Boolean(x.ref))

  const groups = new Map<AssetType, string[]>()
  for (const { ref } of parsed) {
    groups.set(ref.type, [...(groups.get(ref.type) ?? []), ref.symbol])
  }

  const results = await Promise.all(
    Array.from(groups.entries()).map(async ([type, symbols]) =>
      type === 'crypto' ? cryptoQuotes(symbols) : equityQuotes(type, symbols),
    ),
  )

  const byId = new Map<string, Quote>()
  for (const quote of results.flat()) {
    if (!isUsableQuote(quote) || !Number.isFinite(quote.changePercent)) continue
    byId.set(quote.id, { ...quote, iconUrl: quote.iconUrl ?? assetIconUrl(quote.type, quote.symbol) })
  }

  // Preserve request order; keep last-known-good values so the UI never blanks.
  const quotes: Quote[] = []
  for (const { id, ref } of parsed) {
    const fresh = byId.get(id)
    if (fresh) {
      cacheQuote(fresh)
      quotes.push(fresh)
      continue
    }
    const stale = peekCache<Quote>(quoteKey(id))
    if (stale && isUsableQuote(stale)) quotes.push({ ...stale, stale: true })
  }

  const providers = Array.from(new Set(quotes.map((q) => q.provider)))
  return { quotes, providers, degraded: quotes.some((q) => q.stale || q.price === 0) }
}

const quoteKey = (id: string) => `quote:${id}`

function isUsableQuote(quote: Quote): boolean {
  return Number.isFinite(quote.price) && quote.price > 0 && Number.isFinite(quote.timestamp)
}

function cacheQuote(quote: Quote) {
  // Last-known-good snapshot so a provider outage never blanks the UI.
  putCache(quoteKey(quote.id), quote, 60 * 60 * 1000)
}

export type BoardTab = 'favorites' | 'hot' | 'gainers' | 'losers'

/** Board rendered by the home Markets card and the market overview screen. */
export async function getBoard(options: {
  tab?: BoardTab
  ids?: string[]
  category?: MarketCategory
  limit?: number
  includeEquities?: boolean
} = {}): Promise<MarketListResult> {
  const { tab = 'hot', ids, category, limit, includeEquities = true } = options

  const requested =
    ids?.length
      ? ids
      : category
      ? categoryIds(category)
      : [
          ...CRYPTO_UNIVERSE.slice(0, 16).map((c) => buildAssetId('crypto', c.symbol)),
          ...(includeEquities
            ? [
                ...STOCK_UNIVERSE.slice(0, 6).map((s) => buildAssetId('stock', s.symbol)),
                ...ETF_UNIVERSE.slice(0, 3).map((s) => buildAssetId('etf', s.symbol)),
              ]
            : []),
        ]

  const { quotes, providers } = await getQuotes(requested)
  const live = quotes.filter((q) => q.price > 0)

  let ordered = live
  if (tab === 'gainers') ordered = [...live].filter((q) => q.changePercent > 0).sort((a, b) => b.changePercent - a.changePercent)
  else if (tab === 'losers') ordered = [...live].filter((q) => q.changePercent < 0).sort((a, b) => a.changePercent - b.changePercent)
  else if (tab === 'hot')
    ordered = [...live].sort(
      (a, b) => (b.quoteVolume ?? b.marketCap ?? 0) - (a.quoteVolume ?? a.marketCap ?? 0),
    )

  return {
    quotes: limit ? ordered.slice(0, limit) : ordered,
    providers,
    degraded: !live.length && quotes.length > 0,
  }
}

/**
 * Trending assets = biggest absolute movers across crypto + equities. Powers the
 * Finance "Trending Today" section and the home Markets "Hot" tab.
 */
export async function getTrending(limit = 6): Promise<MarketListResult> {
  const { quotes, providers } = await getQuotes([
    ...CRYPTO_UNIVERSE.slice(0, 12).map((c) => buildAssetId('crypto', c.symbol)),
    ...STOCK_UNIVERSE.slice(0, 8).map((s) => buildAssetId('stock', s.symbol)),
  ])

  const live = quotes.filter((q) => q.price > 0)
  return {
    quotes: [...live]
      .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))
      .slice(0, limit),
    providers,
    degraded: !live.length,
  }
}

export const DEFAULT_IDS = DEFAULT_BOARD_IDS

/* -------------------------------------------------------------------------- */
/* Unified search                                                             */
/* -------------------------------------------------------------------------- */

const looksLikeCrypto = (query: string) => {
  const q = normalizeSymbol(query)
  if (!q) return false
  if (cryptoByBase(q)) return true
  if (CRYPTO_UNIVERSE.some((c) => c.symbol.startsWith(q) || c.name.toUpperCase().startsWith(query.toUpperCase())))
    return true
  return /(USDT|USDC)$/.test(q)
}

export async function search(query: string, limit = 12): Promise<SearchResult[]> {
  const trimmed = query.trim()
  if (trimmed.length < 1) return []

  return cached(`search:${trimmed.toLowerCase()}:${limit}`, TTL.search, async () => {
    const tasks: Promise<SearchResult[]>[] = []

    // Crypto: exchange trading pairs first (Bybit, then OKX where Bybit is
    // blocked), CoinGecko for long-tail coins, curated pairs as the floor.
    tasks.push(
      cached(`crypto:pairs:${normalizeSymbol(trimmed)}`, TTL.instruments, () =>
        bybit.searchPairs(trimmed).catch(() => okx.searchPairs(trimmed)),
      ).catch(() => coingecko.search(trimmed).catch(() => bybit.searchCuratedPairs(trimmed))),
    )

    // Stocks / ETFs / indices / forex / commodities — Yahoo leads, keyed
    // providers widen the result set when their keys are configured, and Nasdaq
    // resolves exact tickers with no key so search still works when Yahoo is
    // rate-limited.
    tasks.push(yahoo.search(trimmed).catch(() => []))
    if (finnhub.isEnabled()) tasks.push(finnhub.search(trimmed).catch(() => []))
    if (twelvedata.isEnabled()) tasks.push(twelvedata.search(trimmed).catch(() => []))
    if (polygon.isEnabled()) tasks.push(polygon.search(trimmed).catch(() => []))
    tasks.push(nasdaq.search(trimmed).catch(() => []))
    // Keyless index resolution (S&P 500 / Dow / VIX are absent from Nasdaq's API).
    tasks.push(cnbc.search(trimmed).catch(() => []))

    // Curated matches always surface (works fully offline of any provider).
    tasks.push(Promise.resolve(curatedMatches(trimmed)))

    const settled = await Promise.all(tasks)
    const merged = new Map<string, SearchResult>()
    for (const result of settled.flat()) {
      const existing = merged.get(result.id)
      if (!existing || (result.score ?? 0) > (existing.score ?? 0)) merged.set(result.id, result)
    }

    const exact = normalizeSymbol(trimmed)
    return Array.from(merged.values())
      .map((r) => ({
        ...r,
        score:
          (r.score ?? 0) +
          (normalizeSymbol(r.symbol) === exact ? 60 : 0) +
          (r.symbol.startsWith(exact) ? 15 : 0) +
          (looksLikeCrypto(trimmed) && r.type === 'crypto' ? 10 : 0),
      }))
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, limit)
  })
}

function curatedMatches(query: string): SearchResult[] {
  const q = query.trim().toUpperCase()
  const norm = normalizeSymbol(query)
  const out: SearchResult[] = []

  for (const c of CRYPTO_UNIVERSE) {
    if (c.symbol.startsWith(norm) || c.base === norm || c.name.toUpperCase().includes(q)) {
      out.push({
        ...toAssetRef('crypto', c.symbol, c.name),
        exchange: 'Bybit',
        provider: 'bybit',
        score: c.base === norm ? 92 : 55,
      })
    }
  }

  const equityGroups: [AssetType, typeof STOCK_UNIVERSE][] = [
    ['stock', STOCK_UNIVERSE],
    ['etf', ETF_UNIVERSE],
    ['index', INDEX_UNIVERSE],
    ['forex', FOREX_UNIVERSE],
    ['commodity', COMMODITY_UNIVERSE],
  ]
  for (const [type, universe] of equityGroups) {
    for (const m of universe) {
      if (m.symbol.startsWith(norm) || m.name.toUpperCase().includes(q)) {
        out.push({
          ...toAssetRef(type, m.symbol, m.name),
          provider: type === 'commodity' ? 'twelvedata' : 'yahoo',
          score: m.symbol === norm ? 90 : 52,
        })
      }
    }
  }
  return out
}

/* -------------------------------------------------------------------------- */
/* Detail, charts, depth, trades                                              */
/* -------------------------------------------------------------------------- */

export async function getDetail(id: string): Promise<AssetDetail | null> {
  const ref = parseAssetId(id)
  if (!ref) return null

  const [{ quotes }, profile, headlines] = await Promise.all([
    getQuotes([id]),
    getProfile(id).catch(() => null),
    getHeadlines(id).catch(() => []),
  ])

  const quote = quotes[0]
  if (!quote) return null

  return {
    quote,
    profile: profile ?? undefined,
    headlines,
    capabilities: {
      orderBook: ref.type === 'crypto',
      trades: ref.type === 'crypto',
      stream: ref.type === 'crypto',
    },
  }
}

export async function getProfile(id: string): Promise<AssetProfile | null> {
  const ref = parseAssetId(id)
  if (!ref) return null
  return cached(`profile:${id}`, TTL.profile, async () => {
    if (ref.type === 'crypto') {
      const cg = await coingecko.getProfile(ref.symbol).catch(() => null)
      if (cg) return cg
      return null
    }
    const premium = finnhub.supports(ref.type) ? await finnhub.getProfile(ref.type, ref.symbol) : null
    if (premium) return premium
    const fromYahoo = await yahoo.getProfile(ref.type, ref.symbol)
    if (fromYahoo) return fromYahoo
    // Keyless last resort for company/instrument facts.
    const fromNasdaq = nasdaq.supports(ref.type)
      ? await nasdaq.getProfile(ref.type, ref.symbol)
      : null
    if (fromNasdaq) return fromNasdaq
    return cnbc.supports(ref.type) ? cnbc.getProfile(ref.type, ref.symbol) : null
  })
}

export async function getHeadlines(id: string) {
  const ref = parseAssetId(id)
  if (!ref) return []
  const query =
    ref.type === 'crypto'
      ? (cryptoByBase(ref.symbol.replace(/USDT$|USDC$/, ''))?.name ?? ref.symbol)
      : ref.symbol
  return cached(`news:${id}`, TTL.headlines, () => yahoo.getHeadlines(query))
}

function normalizeCandles(candles: Candle[]): Candle[] {
  const valid = candles.filter((candle) =>
    Number.isFinite(candle.time) &&
    Number.isFinite(candle.open) &&
    Number.isFinite(candle.high) &&
    Number.isFinite(candle.low) &&
    Number.isFinite(candle.close) &&
    Number.isFinite(candle.volume) &&
    candle.high >= Math.max(candle.open, candle.close) &&
    candle.low <= Math.min(candle.open, candle.close),
  )
  const unique = new Map<number, Candle>()
  for (const candle of valid) unique.set(candle.time, candle)
  return Array.from(unique.values()).sort((a, b) => a.time - b.time)
}

export async function getCandles(id: string, timeframe: Timeframe): Promise<CandleSeries | null> {
  const ref = parseAssetId(id)
  if (!ref) return null

  return cached(`candles:${id}:${timeframe}`, TTL.candles, async () => {
    if (ref.type === 'crypto') {
      try {
        const candles = normalizeCandles(await bybit.getKline(ref.symbol, timeframe))
        if (candles.length) return { id, timeframe, provider: 'bybit' as const, candles }
      } catch (err) {
        reportFallback('bybit kline unavailable, trying OKX', err)
      }
      // OKX is the only keyless source with true intraday crypto OHLC —
      // CoinGecko's free tier has no sub-daily candles, so without this the
      // 1m..4H chart ranges render empty wherever Bybit is blocked.
      try {
        const candles = normalizeCandles(await okx.getKline(ref.symbol, timeframe))
        if (candles.length) return { id, timeframe, provider: 'okx' as const, candles }
      } catch (err) {
        reportFallback('okx kline unavailable, falling back to CoinGecko', err)
      }
      const candles = normalizeCandles(await coingecko.getCandles(ref.symbol, timeframe).catch(() => []))
      return { id, timeframe, provider: 'coingecko' as const, candles }
    }

    const fromYahoo = normalizeCandles(await yahoo.getCandles(ref.type, ref.symbol, timeframe).catch(() => []))
    if (fromYahoo.length) return { id, timeframe, provider: 'yahoo' as const, candles: fromYahoo }

    if (finnhub.supports(ref.type)) {
      const candles = normalizeCandles(await finnhub.getCandles(ref.type, ref.symbol, timeframe).catch(() => []))
      if (candles.length) return { id, timeframe, provider: 'finnhub' as const, candles }
    }
    if (twelvedata.supports(ref.type)) {
      const candles = normalizeCandles(await twelvedata.getCandles(ref.type, ref.symbol, timeframe).catch(() => []))
      if (candles.length) return { id, timeframe, provider: 'twelvedata' as const, candles }
    }
    if (polygon.supports(ref.type)) {
      const candles = normalizeCandles(await polygon.getCandles(ref.type, ref.symbol, timeframe).catch(() => []))
      if (candles.length) return { id, timeframe, provider: 'polygon' as const, candles }
    }
    // Keyless forex history. This must be part of the candle chain, not only
    // the quote chain, otherwise a Yahoo outage leaves FX charts empty even
    // though a real public historical source is available.
    if (exchangerate.supports(ref.type)) {
      const candles = normalizeCandles(await exchangerate.getCandles(ref.type, ref.symbol, timeframe).catch((err: unknown) => {
        reportFallback(`exchangerate candles unavailable for ${id}`, err)
        return []
      }))
      if (candles.length) return { id, timeframe, provider: 'exchangerate' as const, candles }
    }
    // Keyless last resort so charts still render without any API key.
    if (nasdaq.supports(ref.type)) {
      const candles = normalizeCandles(await nasdaq
        .getCandles(ref.type, ref.symbol, timeframe)
        .catch((err: unknown) => {
          reportFallback(`nasdaq candles unavailable for ${id}`, err)
          return []
        }))
      if (candles.length) return { id, timeframe, provider: 'nasdaq' as const, candles }
    }
    // Index history of last resort, charted from the fund that tracks the index.
    if (cnbc.supports(ref.type)) {
      const candles = normalizeCandles(await cnbc.getCandles(ref.type, ref.symbol, timeframe).catch((err: unknown) => {
        reportFallback(`cnbc index candles unavailable for ${id}`, err)
        return []
      }))
      if (candles.length) return { id, timeframe, provider: 'cnbc' as const, candles }
    }
    return { id, timeframe, provider: 'yahoo' as const, candles: [] }
  })
}

export async function getOrderBook(id: string): Promise<OrderBook | null> {
  const ref = parseAssetId(id)
  if (!ref || ref.type !== 'crypto') return null
  return cached(`book:${id}`, TTL.orderBook, async () => {
    try {
      return await bybit.getOrderBook(ref.symbol)
    } catch (err) {
      reportFallback('bybit order book unavailable, trying OKX', err)
      return okx.getOrderBook(ref.symbol)
    }
  })
}

export async function getTrades(id: string): Promise<TradeFeed | null> {
  const ref = parseAssetId(id)
  if (!ref || ref.type !== 'crypto') return null
  return cached(`trades:${id}`, TTL.trades, async () => {
    try {
      return { id, trades: await bybit.getRecentTrades(ref.symbol), provider: 'bybit' as const }
    } catch (err) {
      reportFallback('bybit trades unavailable, trying OKX', err)
      return { id, trades: await okx.getRecentTrades(ref.symbol), provider: 'okx' as const }
    }
  })
}

/** Provider health, surfaced so the UI can show a subtle live/delayed state. */
export function getProviderStatus() {
  const keyed = [
    ...(finnhub.isEnabled() ? ['finnhub'] : []),
    ...(twelvedata.isEnabled() ? ['twelvedata'] : []),
    ...(polygon.isEnabled() ? ['polygon'] : []),
  ]

  // `nasdaq` / `exchangerate` need no key, so they always terminate the chain.
  const equityChain = ['yahoo', ...keyed, 'nasdaq']

  return {
    crypto: { primary: 'bybit', chain: ['bybit', 'okx', 'coingecko'] },
    stocks: { primary: 'yahoo', chain: equityChain },
    etfs: { primary: 'yahoo', chain: equityChain },
    // CNBC terminates the index chain because Nasdaq's public API has no
    // S&P 500 / Dow / VIX coverage.
    indices: { primary: 'yahoo', chain: [...equityChain, 'cnbc'] },
    forex: { primary: 'yahoo', chain: ['yahoo', ...keyed, 'exchangerate'] },
    commodities: {
      primary: 'yahoo',
      // CNBC closes this chain too — it is the only keyless commodity source.
      chain: ['yahoo', ...(twelvedata.isEnabled() ? ['twelvedata'] : []), 'cnbc'],
    },
    publicInfo: 'yahoo',
    keys: {
      finnhub: finnhub.isEnabled(),
      twelvedata: twelvedata.isEnabled(),
      polygon: polygon.isEnabled(),
    },
    /** Providers that work without any configuration. */
    keyless: ['bybit', 'okx', 'coingecko', 'yahoo', 'nasdaq', 'cnbc', 'exchangerate'],
  }
}
