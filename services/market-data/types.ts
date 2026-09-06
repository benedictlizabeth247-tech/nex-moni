/**
 * @fileOverview Provider-agnostic market data contracts.
 *
 * Every provider (Bybit, CoinGecko, Yahoo Finance, Finnhub, Twelve Data, ...)
 * normalises its payloads into these shapes, so providers can be swapped
 * without touching a single line of UI code.
 */

export type AssetType = 'crypto' | 'stock' | 'etf' | 'forex' | 'commodity' | 'index'

export type ProviderId =
  | 'bybit'
  /** Keyless crypto fallback — spot tickers, klines, order book and trades. */
  | 'okx'
  | 'coingecko'
  | 'yahoo'
  | 'finnhub'
  | 'twelvedata'
  | 'polygon'
  /** Keyless equity fallback (US stocks, ETFs, Nasdaq indices). */
  | 'nasdaq'
  /** Keyless index fallback (S&P 500, Dow Jones, VIX, Nasdaq 100). */
  | 'cnbc'
  /** Keyless forex fallback (daily reference rates, incl. NGN). */
  | 'exchangerate'

export type Timeframe = '1m' | '5m' | '15m' | '1H' | '4H' | '1D' | '1W' | '1M'

/** Category label rendered by the existing UI badges. */
export type CategoryLabel = 'Crypto' | 'Stocks' | 'ETF' | 'Forex' | 'Commodity' | 'Index'

export interface AssetRef {
  /** Canonical id used across the app + URLs, e.g. `crypto.BTCUSDT`, `stock.AAPL`. */
  id: string
  type: AssetType
  /** Raw symbol, e.g. `BTCUSDT`, `AAPL`, `EURUSD`. */
  symbol: string
  /** Human display symbol, e.g. `BTC/USDT`, `AAPL`, `EUR/USD`. */
  display: string
  name: string
  exchange?: string
  /** Canonical visual identity for the instrument where a stable public logo exists. */
  iconUrl?: string
}

export interface Quote extends AssetRef {
  price: number
  change: number
  changePercent: number
  open?: number
  high?: number
  low?: number
  close?: number
  previousClose?: number
  volume?: number
  quoteVolume?: number
  marketCap?: number
  currency: string
  provider: ProviderId
  timestamp: number
  stale?: boolean
}

export interface Candle {
  /** Epoch milliseconds of the candle open. */
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface CandleSeries {
  id: string
  timeframe: Timeframe
  provider: ProviderId
  candles: Candle[]
}

export interface OrderBookLevel {
  price: number
  size: number
}

export interface OrderBook {
  id: string
  bids: OrderBookLevel[]
  asks: OrderBookLevel[]
  provider: ProviderId
  timestamp: number
}

export interface Trade {
  id: string
  price: number
  size: number
  side: 'buy' | 'sell'
  time: number
}

export interface TradeFeed {
  id: string
  trades: Trade[]
  provider: ProviderId
}

export interface AssetProfileMetric {
  label: string
  value: string
}

export interface AssetProfile {
  id: string
  name: string
  description?: string
  sector?: string
  industry?: string
  website?: string
  employees?: number
  metrics: AssetProfileMetric[]
  provider: ProviderId
}

export interface Headline {
  id: string
  title: string
  publisher: string
  url: string
  time: number
}

export interface AssetDetail {
  quote: Quote
  profile?: AssetProfile
  headlines: Headline[]
  /** Capabilities the resolved provider supports for this asset. */
  capabilities: {
    orderBook: boolean
    trades: boolean
    stream: boolean
  }
}

export interface SearchResult extends AssetRef {
  provider: ProviderId
  score?: number
}

export interface MarketListResult {
  quotes: Quote[]
  /** Providers that actually answered, for observability/debugging. */
  providers: ProviderId[]
  degraded?: boolean
}

export const CATEGORY_LABEL: Record<AssetType, CategoryLabel> = {
  crypto: 'Crypto',
  stock: 'Stocks',
  etf: 'ETF',
  forex: 'Forex',
  commodity: 'Commodity',
  index: 'Index',
}
