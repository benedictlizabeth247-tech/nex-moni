/**
 * @fileOverview Symbol registry + id helpers shared by every provider.
 */

import type { AssetRef, AssetType, Timeframe } from './types'

/* -------------------------------------------------------------------------- */
/* Ids                                                                        */
/* -------------------------------------------------------------------------- */

export const buildAssetId = (type: AssetType, symbol: string) => `${type}.${symbol.toUpperCase()}`

export const parseAssetId = (id: string): { type: AssetType; symbol: string } | null => {
  const idx = id.indexOf('.')
  if (idx <= 0) return null
  const type = id.slice(0, idx) as AssetType
  const symbol = id.slice(idx + 1)
  if (!symbol) return null
  if (!['crypto', 'stock', 'etf', 'forex', 'commodity', 'index'].includes(type)) return null
  return { type, symbol: symbol.toUpperCase() }
}

const QUOTE_ASSETS = ['USDT', 'USDC', 'USD', 'EUR', 'BTC', 'ETH', 'DAI', 'NGN', 'GBP', 'JPY', 'TRY']

/** `BTCUSDT` -> `BTC/USDT`, `EURUSD` -> `EUR/USD`, `AAPL` -> `AAPL`. */
export const displaySymbol = (type: AssetType, symbol: string): string => {
  const s = symbol.toUpperCase()
  if (type === 'crypto' || type === 'forex' || type === 'commodity') {
    if (s.includes('/')) return s
    for (const q of QUOTE_ASSETS) {
      if (s.length > q.length && s.endsWith(q)) return `${s.slice(0, s.length - q.length)}/${q}`
    }
  }
  return s
}

/** `BTC/USDT` -> `BTCUSDT` */
export const normalizeSymbol = (symbol: string) => symbol.replace(/[\s/\-_]/g, '').toUpperCase()

/* -------------------------------------------------------------------------- */
/* Curated universes                                                          */
/* -------------------------------------------------------------------------- */

export interface CryptoMeta {
  /** Bybit spot symbol. */
  symbol: string
  base: string
  name: string
  /** CoinGecko id used for the read-only fallback. */
  coingeckoId: string
}

export const CRYPTO_UNIVERSE: CryptoMeta[] = [
  { symbol: 'BTCUSDT', base: 'BTC', name: 'Bitcoin', coingeckoId: 'bitcoin' },
  { symbol: 'ETHUSDT', base: 'ETH', name: 'Ethereum', coingeckoId: 'ethereum' },
  { symbol: 'USDCUSDT', base: 'USDC', name: 'USD Coin', coingeckoId: 'usd-coin' },
  { symbol: 'SOLUSDT', base: 'SOL', name: 'Solana', coingeckoId: 'solana' },
  { symbol: 'MNTUSDT', base: 'MNT', name: 'Mantle', coingeckoId: 'mantle' },
  { symbol: 'BNBUSDT', base: 'BNB', name: 'BNB', coingeckoId: 'binancecoin' },
  { symbol: 'XRPUSDT', base: 'XRP', name: 'XRP', coingeckoId: 'ripple' },
  { symbol: 'DOGEUSDT', base: 'DOGE', name: 'Dogecoin', coingeckoId: 'dogecoin' },
  { symbol: 'ADAUSDT', base: 'ADA', name: 'Cardano', coingeckoId: 'cardano' },
  { symbol: 'TONUSDT', base: 'TON', name: 'Toncoin', coingeckoId: 'the-open-network' },
  { symbol: 'AVAXUSDT', base: 'AVAX', name: 'Avalanche', coingeckoId: 'avalanche-2' },
  { symbol: 'LINKUSDT', base: 'LINK', name: 'Chainlink', coingeckoId: 'chainlink' },
  { symbol: 'TRXUSDT', base: 'TRX', name: 'TRON', coingeckoId: 'tron' },
  { symbol: 'DOTUSDT', base: 'DOT', name: 'Polkadot', coingeckoId: 'polkadot' },
  { symbol: 'LTCUSDT', base: 'LTC', name: 'Litecoin', coingeckoId: 'litecoin' },
  { symbol: 'SUIUSDT', base: 'SUI', name: 'Sui', coingeckoId: 'sui' },
  { symbol: 'ARBUSDT', base: 'ARB', name: 'Arbitrum', coingeckoId: 'arbitrum' },
  { symbol: 'OPUSDT', base: 'OP', name: 'Optimism', coingeckoId: 'optimism' },
  { symbol: 'NEARUSDT', base: 'NEAR', name: 'NEAR Protocol', coingeckoId: 'near' },
  { symbol: 'APTUSDT', base: 'APT', name: 'Aptos', coingeckoId: 'aptos' },
  { symbol: 'ATOMUSDT', base: 'ATOM', name: 'Cosmos', coingeckoId: 'cosmos' },
  { symbol: 'FILUSDT', base: 'FIL', name: 'Filecoin', coingeckoId: 'filecoin' },
  { symbol: 'PEPEUSDT', base: 'PEPE', name: 'Pepe', coingeckoId: 'pepe' },
  { symbol: 'SHIBUSDT', base: 'SHIB', name: 'Shiba Inu', coingeckoId: 'shiba-inu' },
  { symbol: 'XLMUSDT', base: 'XLM', name: 'Stellar', coingeckoId: 'stellar' },
  { symbol: 'HBARUSDT', base: 'HBAR', name: 'Hedera', coingeckoId: 'hedera-hashgraph' },
]

export const cryptoBySymbol = (symbol: string) =>
  CRYPTO_UNIVERSE.find((c) => c.symbol === normalizeSymbol(symbol))

export const cryptoByBase = (base: string) =>
  CRYPTO_UNIVERSE.find((c) => c.base === base.toUpperCase())

export interface EquityMeta {
  symbol: string
  name: string
  type: AssetType
  /** Yahoo Finance ticker (also works for Finnhub/Polygon for plain equities). */
  yahoo: string
  /** Twelve Data symbol where it differs. */
  twelvedata?: string
}

export const STOCK_UNIVERSE: EquityMeta[] = [
  { symbol: 'AAPL', name: 'Apple Inc.', type: 'stock', yahoo: 'AAPL' },
  { symbol: 'TSLA', name: 'Tesla Inc.', type: 'stock', yahoo: 'TSLA' },
  { symbol: 'NVDA', name: 'NVIDIA Corp.', type: 'stock', yahoo: 'NVDA' },
  { symbol: 'MSFT', name: 'Microsoft Corp.', type: 'stock', yahoo: 'MSFT' },
  { symbol: 'AMZN', name: 'Amazon.com Inc.', type: 'stock', yahoo: 'AMZN' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', type: 'stock', yahoo: 'GOOGL' },
  { symbol: 'META', name: 'Meta Platforms', type: 'stock', yahoo: 'META' },
  { symbol: 'NFLX', name: 'Netflix Inc.', type: 'stock', yahoo: 'NFLX' },
  { symbol: 'AMD', name: 'Advanced Micro Devices', type: 'stock', yahoo: 'AMD' },
  { symbol: 'JPM', name: 'JPMorgan Chase', type: 'stock', yahoo: 'JPM' },
  { symbol: 'AVGO', name: 'Broadcom Inc.', type: 'stock', yahoo: 'AVGO' },
  { symbol: 'PLTR', name: 'Palantir Technologies', type: 'stock', yahoo: 'PLTR' },
  { symbol: 'MU', name: 'Micron Technology', type: 'stock', yahoo: 'MU' },
  { symbol: 'XOM', name: 'Exxon Mobil Corp.', type: 'stock', yahoo: 'XOM' },
  { symbol: 'CVX', name: 'Chevron Corp.', type: 'stock', yahoo: 'CVX' },
  { symbol: 'COP', name: 'ConocoPhillips', type: 'stock', yahoo: 'COP' },
  { symbol: 'SLB', name: 'SLB (Schlumberger)', type: 'stock', yahoo: 'SLB' },
  { symbol: 'JNJ', name: 'Johnson & Johnson', type: 'stock', yahoo: 'JNJ' },
  { symbol: 'LLY', name: 'Eli Lilly and Co.', type: 'stock', yahoo: 'LLY' },
  { symbol: 'PFE', name: 'Pfizer Inc.', type: 'stock', yahoo: 'PFE' },
  { symbol: 'UNH', name: 'UnitedHealth Group', type: 'stock', yahoo: 'UNH' },
]

export const ETF_UNIVERSE: EquityMeta[] = [
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF', type: 'etf', yahoo: 'SPY' },
  { symbol: 'VOO', name: 'Vanguard S&P 500 ETF', type: 'etf', yahoo: 'VOO' },
  { symbol: 'QQQ', name: 'Invesco QQQ Trust', type: 'etf', yahoo: 'QQQ' },
  { symbol: 'VTI', name: 'Vanguard Total Stock Market', type: 'etf', yahoo: 'VTI' },
  { symbol: 'IWM', name: 'iShares Russell 2000 ETF', type: 'etf', yahoo: 'IWM' },
]

export const INDEX_UNIVERSE: EquityMeta[] = [
  { symbol: 'SPX', name: 'S&P 500', type: 'index', yahoo: '^GSPC' },
  { symbol: 'NDX', name: 'Nasdaq 100', type: 'index', yahoo: '^NDX' },
  { symbol: 'DJI', name: 'Dow Jones Industrial', type: 'index', yahoo: '^DJI' },
  { symbol: 'VIX', name: 'CBOE Volatility Index', type: 'index', yahoo: '^VIX' },
]

export const FOREX_UNIVERSE: EquityMeta[] = [
  { symbol: 'EURUSD', name: 'Euro / US Dollar', type: 'forex', yahoo: 'EURUSD=X', twelvedata: 'EUR/USD' },
  { symbol: 'GBPUSD', name: 'British Pound / US Dollar', type: 'forex', yahoo: 'GBPUSD=X', twelvedata: 'GBP/USD' },
  { symbol: 'USDJPY', name: 'US Dollar / Japanese Yen', type: 'forex', yahoo: 'JPY=X', twelvedata: 'USD/JPY' },
  { symbol: 'USDCHF', name: 'US Dollar / Swiss Franc', type: 'forex', yahoo: 'CHF=X', twelvedata: 'USD/CHF' },
  { symbol: 'AUDUSD', name: 'Australian Dollar / US Dollar', type: 'forex', yahoo: 'AUDUSD=X', twelvedata: 'AUD/USD' },
  { symbol: 'USDCAD', name: 'US Dollar / Canadian Dollar', type: 'forex', yahoo: 'CAD=X', twelvedata: 'USD/CAD' },
  { symbol: 'NZDUSD', name: 'New Zealand Dollar / US Dollar', type: 'forex', yahoo: 'NZDUSD=X', twelvedata: 'NZD/USD' },
  { symbol: 'EURGBP', name: 'Euro / British Pound', type: 'forex', yahoo: 'EURGBP=X', twelvedata: 'EUR/GBP' },
  { symbol: 'USDNGN', name: 'US Dollar / Nigerian Naira', type: 'forex', yahoo: 'NGN=X', twelvedata: 'USD/NGN' },
  { symbol: 'GBPNGN', name: 'British Pound / Nigerian Naira', type: 'forex', yahoo: 'GBPNGN=X', twelvedata: 'GBP/NGN' },
  { symbol: 'EURNGN', name: 'Euro / Nigerian Naira', type: 'forex', yahoo: 'EURNGN=X', twelvedata: 'EUR/NGN' },
]

export const COMMODITY_UNIVERSE: EquityMeta[] = [
  { symbol: 'XAUUSD', name: 'Gold Spot', type: 'commodity', yahoo: 'GC=F', twelvedata: 'XAU/USD' },
  { symbol: 'XAGUSD', name: 'Silver Spot', type: 'commodity', yahoo: 'SI=F', twelvedata: 'XAG/USD' },
  { symbol: 'WTIUSD', name: 'Crude Oil (WTI)', type: 'commodity', yahoo: 'CL=F', twelvedata: 'WTI/USD' },
  { symbol: 'BRENTUSD', name: 'Crude Oil (Brent)', type: 'commodity', yahoo: 'BZ=F', twelvedata: 'BRENT/USD' },
  { symbol: 'NGASUSD', name: 'Natural Gas', type: 'commodity', yahoo: 'NG=F', twelvedata: 'NG/USD' },
  { symbol: 'XPTUSD', name: 'Platinum Spot', type: 'commodity', yahoo: 'PL=F', twelvedata: 'XPT/USD' },
  { symbol: 'XCUUSD', name: 'Copper', type: 'commodity', yahoo: 'HG=F', twelvedata: 'XCU/USD' },
]

const EQUITY_LIKE: EquityMeta[] = [
  ...STOCK_UNIVERSE,
  ...ETF_UNIVERSE,
  ...INDEX_UNIVERSE,
  ...FOREX_UNIVERSE,
  ...COMMODITY_UNIVERSE,
]

export const equityMeta = (type: AssetType, symbol: string): EquityMeta | undefined =>
  EQUITY_LIKE.find((m) => m.type === type && m.symbol === symbol.toUpperCase())

export const equityMetaByYahoo = (yahoo: string): EquityMeta | undefined =>
  EQUITY_LIKE.find((m) => m.yahoo.toUpperCase() === yahoo.toUpperCase())

/** Resolve the provider ticker for non-crypto assets, with sane fallbacks. */
export const yahooSymbol = (type: AssetType, symbol: string): string => {
  const meta = equityMeta(type, symbol)
  if (meta) return meta.yahoo
  const s = symbol.toUpperCase()
  if (type === 'forex') return s.endsWith('=X') ? s : `${s}=X`
  if (type === 'commodity') return s.endsWith('=F') || s.endsWith('=X') ? s : `${s}=X`
  if (type === 'index') return s.startsWith('^') ? s : `^${s}`
  return s
}


const CRYPTO_ICON_BASE = 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/128/color'
const EQUITY_ICON_BASE = 'https://logo.clearbit.com'
const EQUITY_DOMAINS: Record<string, string> = {
  AAPL: 'apple.com', TSLA: 'tesla.com', NVDA: 'nvidia.com', MSFT: 'microsoft.com',
  AMZN: 'amazon.com', GOOGL: 'google.com', META: 'meta.com', NFLX: 'netflix.com',
  AMD: 'amd.com', JPM: 'jpmorganchase.com', AVGO: 'broadcom.com', PLTR: 'palantir.com',
  MU: 'micron.com', XOM: 'exxonmobil.com', CVX: 'chevron.com', COP: 'conocophillips.com',
  SLB: 'slb.com', JNJ: 'jnj.com', LLY: 'lilly.com', PFE: 'pfizer.com', UNH: 'uhg.com',
  SPY: 'ssga.com', VOO: 'vanguard.com', QQQ: 'invesco.com', VTI: 'vanguard.com', IWM: 'ishares.com',
}

export const assetIconUrl = (type: AssetType, symbol: string): string | undefined => {
  const s = normalizeSymbol(symbol)
  if (type === 'crypto') {
    const base = s.replace(/USDT$|USDC$|USD$|BTC$|ETH$/, '').toLowerCase()
    if (base) return `${CRYPTO_ICON_BASE}/${base}.png`
  }
  if (type === 'stock' || type === 'etf') {
    const domain = EQUITY_DOMAINS[s]
    if (domain) return `${EQUITY_ICON_BASE}/${domain}`
  }
  return undefined
}

export const assetName = (type: AssetType, symbol: string): string => {
  if (type === 'crypto') return cryptoBySymbol(symbol)?.name ?? displaySymbol(type, symbol)
  return equityMeta(type, symbol)?.name ?? symbol.toUpperCase()
}

export const toAssetRef = (type: AssetType, symbol: string, name?: string): AssetRef => {
  const sym = type === 'crypto' ? normalizeSymbol(symbol) : symbol.toUpperCase()
  return {
    id: buildAssetId(type, sym),
    type,
    symbol: sym,
    display: displaySymbol(type, sym),
    name: name ?? assetName(type, sym),
    iconUrl: assetIconUrl(type, sym),
  }
}

/** The default board rendered by the home Markets card. */
export const DEFAULT_BOARD_IDS = [
  buildAssetId('crypto', 'BTCUSDT'),
  buildAssetId('crypto', 'USDCUSDT'),
  buildAssetId('crypto', 'ETHUSDT'),
  buildAssetId('crypto', 'SOLUSDT'),
  buildAssetId('crypto', 'MNTUSDT'),
  buildAssetId('crypto', 'XRPUSDT'),
  buildAssetId('crypto', 'BNBUSDT'),
  buildAssetId('crypto', 'DOGEUSDT'),
  buildAssetId('stock', 'AAPL'),
  buildAssetId('stock', 'TSLA'),
  buildAssetId('stock', 'NVDA'),
]

/**
 * Categories behind the Finance "Explore" chips. Thematic baskets reuse the
 * curated equity universe so names resolve without an extra provider call.
 */
export type MarketCategory =
  | 'stocks'
  | 'etfs'
  | 'crypto'
  | 'forex'
  | 'commodities'
  | 'indices'
  | 'ai'
  | 'energy'
  | 'healthcare'

const THEMES: Record<'ai' | 'energy' | 'healthcare', string[]> = {
  ai: ['NVDA', 'MSFT', 'GOOGL', 'AMD', 'AVGO', 'PLTR', 'MU', 'META'],
  energy: ['XOM', 'CVX', 'COP', 'SLB'],
  healthcare: ['JNJ', 'LLY', 'PFE', 'UNH'],
}

export const categoryIds = (category: MarketCategory): string[] => {
  switch (category) {
    case 'crypto':
      return CRYPTO_UNIVERSE.map((c) => buildAssetId('crypto', c.symbol))
    case 'stocks':
      return STOCK_UNIVERSE.map((s) => buildAssetId('stock', s.symbol))
    case 'etfs':
      return ETF_UNIVERSE.map((s) => buildAssetId('etf', s.symbol))
    case 'indices':
      return INDEX_UNIVERSE.map((s) => buildAssetId('index', s.symbol))
    case 'forex':
      return FOREX_UNIVERSE.map((s) => buildAssetId('forex', s.symbol))
    case 'commodities':
      return COMMODITY_UNIVERSE.map((s) => buildAssetId('commodity', s.symbol))
    default:
      return THEMES[category].map((s) => buildAssetId('stock', s))
  }
}

export const MARKET_CATEGORIES: MarketCategory[] = [
  'stocks',
  'etfs',
  'crypto',
  'forex',
  'commodities',
  'indices',
  'ai',
  'energy',
  'healthcare',
]

/** Assets shown by the Finance "Market Pulse" strip. */
export const MARKET_PULSE_IDS = [
  buildAssetId('index', 'SPX'),
  buildAssetId('crypto', 'BTCUSDT'),
]

/* -------------------------------------------------------------------------- */
/* Timeframes                                                                 */
/* -------------------------------------------------------------------------- */

export const TIMEFRAMES: Timeframe[] = ['1m', '5m', '15m', '1H', '4H', '1D', '1W', '1M']

/** Bybit v5 kline interval codes. */
export const BYBIT_INTERVAL: Record<Timeframe, string> = {
  '1m': '1',
  '5m': '5',
  '15m': '15',
  '1H': '60',
  '4H': '240',
  '1D': 'D',
  '1W': 'W',
  '1M': 'M',
}

/** Yahoo chart interval + range pairs. */
export const YAHOO_RANGE: Record<Timeframe, { interval: string; range: string }> = {
  '1m': { interval: '1m', range: '1d' },
  '5m': { interval: '5m', range: '5d' },
  '15m': { interval: '15m', range: '1mo' },
  '1H': { interval: '60m', range: '3mo' },
  '4H': { interval: '1h', range: '1y' },
  '1D': { interval: '1d', range: '1y' },
  '1W': { interval: '1wk', range: '5y' },
  '1M': { interval: '1mo', range: '10y' },
}

/** Approximate CoinGecko OHLC window (days) per timeframe. */
export const COINGECKO_DAYS: Record<Timeframe, number> = {
  '1m': 1,
  '5m': 1,
  '15m': 7,
  '1H': 14,
  '4H': 30,
  '1D': 180,
  '1W': 365,
  '1M': 365,
}

/** Twelve Data interval codes. */
export const TWELVEDATA_INTERVAL: Record<Timeframe, string> = {
  '1m': '1min',
  '5m': '5min',
  '15m': '15min',
  '1H': '1h',
  '4H': '4h',
  '1D': '1day',
  '1W': '1week',
  '1M': '1month',
}
