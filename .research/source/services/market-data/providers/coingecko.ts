/**
 * @fileOverview CoinGecko provider — read-only crypto fallback when a coin is
 * unavailable on Bybit (or Bybit is unreachable). Never used for order books.
 */

import { fetchJson } from '../http'
import {
  buildAssetId,
  COINGECKO_DAYS,
  cryptoByBase,
  cryptoBySymbol,
  displaySymbol,
  normalizeSymbol,
  CRYPTO_UNIVERSE,
} from '../symbols'
import type { AssetProfile, Candle, Quote, SearchResult, Timeframe } from '../types'

const PROVIDER = 'coingecko' as const
const BASE = process.env.COINGECKO_API_BASE || 'https://api.coingecko.com/api/v3'

const headers = (): Record<string, string> => {
  const key = process.env.COINGECKO_API_KEY
  return key ? { 'x-cg-demo-api-key': key } : {}
}

const cg = <T,>(path: string) => fetchJson<T>(PROVIDER, `${BASE}${path}`, { headers: headers() })

/** Resolve a `BTCUSDT`-style symbol to a CoinGecko coin id. */
const resolveCoinId = async (symbol: string): Promise<{ coinId: string; base: string } | null> => {
  const sym = normalizeSymbol(symbol)
  const known = cryptoBySymbol(sym)
  if (known) return { coinId: known.coingeckoId, base: known.base }

  const base = sym.replace(/(USDT|USDC|USD|BTC|ETH|EUR)$/i, '') || sym
  const byBase = cryptoByBase(base)
  if (byBase) return { coinId: byBase.coingeckoId, base: byBase.base }

  try {
    const res = await cg<{ coins: { id: string; symbol: string; name: string }[] }>(
      `/search?query=${encodeURIComponent(base)}`,
    )
    const match =
      res.coins?.find((c) => c.symbol.toUpperCase() === base.toUpperCase()) ?? res.coins?.[0]
    return match ? { coinId: match.id, base: base.toUpperCase() } : null
  } catch {
    return null
  }
}

interface CGMarket {
  id: string
  symbol: string
  name: string
  current_price: number
  price_change_24h: number
  price_change_percentage_24h: number
  high_24h: number
  low_24h: number
  total_volume: number
  market_cap: number
  last_updated: string
}

const toQuote = (m: CGMarket, symbol: string): Quote => {
  const sym = normalizeSymbol(symbol)
  return {
    id: buildAssetId('crypto', sym),
    type: 'crypto',
    symbol: sym,
    display: displaySymbol('crypto', sym),
    name: m.name,
    exchange: 'CoinGecko',
    price: m.current_price,
    change: m.price_change_24h ?? 0,
    changePercent: m.price_change_percentage_24h ?? 0,
    open: m.current_price - (m.price_change_24h ?? 0),
    high: m.high_24h,
    low: m.low_24h,
    close: m.current_price,
    previousClose: m.current_price - (m.price_change_24h ?? 0),
    volume: m.total_volume,
    marketCap: m.market_cap,
    currency: 'USD',
    provider: PROVIDER,
    timestamp: m.last_updated ? new Date(m.last_updated).getTime() : Date.now(),
  }
}

/** Batch quotes for crypto symbols using the curated coin-id mapping. */
export async function getQuotes(symbols: string[]): Promise<Quote[]> {
  const pairs = await Promise.all(
    symbols.map(async (s) => ({ symbol: normalizeSymbol(s), resolved: await resolveCoinId(s) })),
  )
  const ids = Array.from(new Set(pairs.map((p) => p.resolved?.coinId).filter(Boolean))) as string[]
  if (!ids.length) return []

  const markets = await cg<CGMarket[]>(
    `/coins/markets?vs_currency=usd&ids=${ids.join(',')}&price_change_percentage=24h`,
  )
  const byId = new Map(markets.map((m) => [m.id, m]))
  return pairs
    .map((p) => {
      const m = p.resolved ? byId.get(p.resolved.coinId) : undefined
      return m ? toQuote(m, p.symbol) : null
    })
    .filter((q): q is Quote => q !== null)
}

export async function getQuote(symbol: string): Promise<Quote> {
  const [quote] = await getQuotes([symbol])
  if (!quote) throw new Error(`[coingecko] No market data for ${symbol}`)
  return quote
}

/** OHLC history — coarser than Bybit k-line but adequate as a fallback. */
export async function getCandles(symbol: string, timeframe: Timeframe): Promise<Candle[]> {
  const resolved = await resolveCoinId(symbol)
  if (!resolved) return []
  const days = COINGECKO_DAYS[timeframe]
  const rows = await cg<number[][]>(`/coins/${resolved.coinId}/ohlc?vs_currency=usd&days=${days}`)
  return rows.map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4], volume: 0 }))
}

export async function getProfile(symbol: string): Promise<AssetProfile | null> {
  const resolved = await resolveCoinId(symbol)
  if (!resolved) return null
  const coin = await cg<any>(
    `/coins/${resolved.coinId}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false`,
  )
  const md = coin?.market_data ?? {}
  const fmt = (n?: number, prefix = '$') =>
    typeof n === 'number' && Number.isFinite(n)
      ? `${prefix}${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
      : '—'
  return {
    id: buildAssetId('crypto', normalizeSymbol(symbol)),
    name: coin?.name ?? symbol,
    description: (coin?.description?.en ?? '').split('. ').slice(0, 3).join('. '),
    sector: 'Digital Asset',
    industry: coin?.categories?.[0] ?? undefined,
    website: coin?.links?.homepage?.[0] || undefined,
    metrics: [
      { label: 'Market Cap', value: fmt(md.market_cap?.usd) },
      { label: 'Fully Diluted', value: fmt(md.fully_diluted_valuation?.usd) },
      { label: 'Circulating Supply', value: fmt(md.circulating_supply, '') },
      { label: 'Max Supply', value: fmt(md.max_supply, '') },
      { label: 'All-Time High', value: fmt(md.ath?.usd) },
      { label: 'Market Cap Rank', value: coin?.market_cap_rank ? `#${coin.market_cap_rank}` : '—' },
    ],
    provider: PROVIDER,
  }
}

export async function search(query: string, limit = 10): Promise<SearchResult[]> {
  const res = await cg<{ coins: { id: string; symbol: string; name: string; market_cap_rank: number | null }[] }>(
    `/search?query=${encodeURIComponent(query)}`,
  )
  return (res.coins ?? []).slice(0, limit).map((c) => {
    const base = c.symbol.toUpperCase()
    const known = cryptoByBase(base)
    const symbol = known?.symbol ?? `${base}USDT`
    return {
      id: buildAssetId('crypto', symbol),
      type: 'crypto' as const,
      symbol,
      display: displaySymbol('crypto', symbol),
      name: c.name,
      exchange: 'CoinGecko',
      provider: PROVIDER,
      score: c.market_cap_rank ? Math.max(20, 80 - c.market_cap_rank) : 20,
    }
  })
}

/** Market-cap enrichment for the curated universe (Bybit does not expose it). */
export async function getMarketCaps(): Promise<Map<string, number>> {
  const ids = CRYPTO_UNIVERSE.map((c) => c.coingeckoId).join(',')
  const markets = await cg<CGMarket[]>(`/coins/markets?vs_currency=usd&ids=${ids}`)
  const map = new Map<string, number>()
  for (const m of markets) {
    const meta = CRYPTO_UNIVERSE.find((c) => c.coingeckoId === m.id)
    if (meta) map.set(meta.symbol, m.market_cap)
  }
  return map
}
