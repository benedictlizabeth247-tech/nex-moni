/**
 * @fileOverview Presentation helpers for live market data.
 *
 * Kept separate from `formatters.ts` (which is Naira/銀行-oriented) because market
 * prices need dynamic precision: BTC needs 2 decimals, PEPE needs 8, and FX
 * pairs need 4.
 */

import type { Quote } from '@/services/market-data/types'

/** Decimals scale with magnitude so sub-cent assets stay readable. */
export const priceDecimals = (price: number): number => {
  const abs = Math.abs(price)
  if (!Number.isFinite(abs) || abs === 0) return 2
  if (abs >= 1000) return 2
  if (abs >= 1) return abs >= 100 ? 2 : 4
  if (abs >= 0.01) return 4
  if (abs >= 0.0001) return 6
  return 8
}

export const formatPrice = (price: number, currency = 'USD'): string => {
  if (!Number.isFinite(price) || price === 0) return '—'
  const decimals = priceDecimals(price)
  const symbol = currency === 'USD' ? '$' : currency === 'NGN' ? '₦' : ''
  const formatted = price.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
  return symbol ? `${symbol}${formatted}` : `${formatted} ${currency}`
}

/** Forex pairs are quoted without a currency symbol. */
export const formatQuotePrice = (quote: Pick<Quote, 'price' | 'type' | 'currency'>): string => {
  if (!Number.isFinite(quote.price) || quote.price === 0) return '—'
  if (quote.type === 'forex' || quote.type === 'index') {
    const decimals = quote.type === 'index' ? 2 : 4
    return quote.price.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
  }
  return formatPrice(quote.price, quote.currency)
}

export const formatPercent = (value: number): string => {
  if (!Number.isFinite(value)) return '0.00%'
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

export const formatChange = (value: number, currency = 'USD'): string => {
  if (!Number.isFinite(value)) return '—'
  const sign = value >= 0 ? '+' : '-'
  return `${sign}${formatPrice(Math.abs(value), currency)}`
}

/** `1234567890` -> `1.23B` */
export const formatCompact = (value?: number): string => {
  if (value === undefined || !Number.isFinite(value) || value === 0) return '—'
  const abs = Math.abs(value)
  if (abs >= 1e12) return `${(value / 1e12).toFixed(2)}T`
  if (abs >= 1e9) return `${(value / 1e9).toFixed(2)}B`
  if (abs >= 1e6) return `${(value / 1e6).toFixed(2)}M`
  if (abs >= 1e3) return `${(value / 1e3).toFixed(2)}K`
  return value.toFixed(2)
}

export const formatMoneyCompact = (value?: number): string => {
  const compact = formatCompact(value)
  return compact === '—' ? compact : `$${compact}`
}

/** `1717171717000` -> `14:28` */
export const formatClock = (timestamp: number): string =>
  new Date(timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

export const formatRelative = (timestamp: number): string => {
  const diff = Date.now() - timestamp
  const minutes = Math.round(diff / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}
