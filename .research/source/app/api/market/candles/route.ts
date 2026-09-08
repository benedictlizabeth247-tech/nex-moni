import { NextResponse } from 'next/server'

import { logger } from '@/lib/logger'
import { getCandles } from '@/services/market-data/router'
import { TIMEFRAMES, CRYPTO_UNIVERSE, FOREX_UNIVERSE, STOCK_UNIVERSE, ETF_UNIVERSE, INDEX_UNIVERSE, COMMODITY_UNIVERSE, buildAssetId, normalizeSymbol } from '@/services/market-data/symbols'
import type { Timeframe } from '@/services/market-data/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * `{ series }` — OHLCV for any asset. Accepts `timeframe` (preferred) or the
 * shorthand `tf`. On total provider failure an empty series is returned so
 * charts can render an empty state instead of an error.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id') ?? ''
  const raw = (searchParams.get('timeframe') ?? searchParams.get('tf') ?? '1H') as Timeframe
  const timeframe: Timeframe = TIMEFRAMES.includes(raw) ? raw : '1H'

  if (!id) return NextResponse.json({ error: 'missing_id', series: null }, { status: 400 })

  const normalizedId = normalizeMarketId(id)

  try {
    const series = await getCandles(normalizedId, timeframe)
    if (!series) {
      return NextResponse.json({ error: 'unknown_asset', series: null }, { status: 404 })
    }
    return NextResponse.json({ series }, { headers: { 'cache-control': 'no-store' } })
  } catch (error) {
    logger.error('GET /api/market/candles failed', { reason: (error as Error).message })
    return NextResponse.json(
      { series: { id: normalizedId, timeframe, provider: 'unavailable', candles: [] }, degraded: true },
      { status: 200, headers: { 'cache-control': 'no-store' } },
    )
  }
}

function normalizeMarketId(raw: string): string {
  const value = decodeURIComponent(raw).trim()
  if (value.includes('.')) return value
  const normalized = normalizeSymbol(value)
  if (value.includes('/')) return buildAssetId('crypto', normalized)
  if (CRYPTO_UNIVERSE.some((asset) => asset.symbol === normalized)) return buildAssetId('crypto', normalized)
  if (FOREX_UNIVERSE.some((asset) => asset.symbol === normalized)) return buildAssetId('forex', normalized)
  if (ETF_UNIVERSE.some((asset) => asset.symbol === normalized)) return buildAssetId('etf', normalized)
  if (INDEX_UNIVERSE.some((asset) => asset.symbol === normalized)) return buildAssetId('index', normalized)
  if (COMMODITY_UNIVERSE.some((asset) => asset.symbol === normalized)) return buildAssetId('commodity', normalized)
  if (STOCK_UNIVERSE.some((asset) => asset.symbol === normalized)) return buildAssetId('stock', normalized)
  return buildAssetId('stock', value.toUpperCase())
}
