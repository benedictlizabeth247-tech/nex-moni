import { NextResponse } from 'next/server'

import { logger } from '@/lib/logger'
import { getBoard, getQuotes, getTrending, type BoardTab } from '@/services/market-data/router'
import { MARKET_CATEGORIES, type MarketCategory } from '@/services/market-data/symbols'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const TABS: BoardTab[] = ['favorites', 'hot', 'gainers', 'losers']

/**
 * Quotes endpoint.
 *
 *   ?ids=crypto.BTCUSDT,stock.AAPL   explicit assets (request order preserved)
 *   ?tab=hot|gainers|losers          board ordering (optionally combined with ids)
 *   ?category=stocks|ai|crypto|...   curated category board
 *   ?trending=1                      biggest movers across crypto + equities
 *   ?limit=n                         cap the number of rows
 *
 * Always answers 200 with `{ quotes, providers, degraded }` so the UI can render
 * a degraded state instead of an error screen.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const ids = (searchParams.get('ids') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const tabParam = (searchParams.get('tab') ?? '').toLowerCase() as BoardTab
  const tab = TABS.includes(tabParam) ? tabParam : undefined
  const categoryParam = (searchParams.get('category') ?? '').toLowerCase() as MarketCategory
  const category = MARKET_CATEGORIES.includes(categoryParam) ? categoryParam : undefined
  const trending = searchParams.get('trending') === '1'
  const parsedLimit = Number(searchParams.get('limit'))
  const limit =
    Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 60) : undefined

  try {
    if (trending) {
      return NextResponse.json(await getTrending(limit ?? 6), {
        headers: { 'cache-control': 'no-store' },
      })
    }

    if (category || tab) {
      return NextResponse.json(
        await getBoard({ tab, category, limit, ids: ids.length ? ids : undefined }),
        { headers: { 'cache-control': 'no-store' } },
      )
    }

    if (!ids.length) {
      return NextResponse.json(
        { quotes: [], providers: [], degraded: false },
        { headers: { 'cache-control': 'no-store' } },
      )
    }

    const result = await getQuotes(limit ? ids.slice(0, limit) : ids)
    return NextResponse.json(result, { headers: { 'cache-control': 'no-store' } })
  } catch (error) {
    logger.error('GET /api/market/quotes failed', { reason: (error as Error).message })
    return NextResponse.json(
      { quotes: [], providers: [], degraded: true },
      { status: 200, headers: { 'cache-control': 'no-store' } },
    )
  }
}
