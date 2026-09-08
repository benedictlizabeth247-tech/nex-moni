import { NextResponse } from 'next/server'

import { getOrderBook, getTrades } from '@/services/market-data/router'
import { parseAssetId } from '@/services/market-data/symbols'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * `{ orderBook, trades, supported }` — order book depth + recent trades. Only
 * crypto assets have a book, so `supported: false` is a normal answer for
 * stocks/ETFs/indices rather than an error.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id') ?? ''
  if (!id) {
    return NextResponse.json(
      { error: 'missing_id', orderBook: null, trades: null, supported: false },
      { status: 400 },
    )
  }

  const ref = parseAssetId(id)
  if (!ref || ref.type !== 'crypto') {
    return NextResponse.json(
      { orderBook: null, trades: null, supported: false },
      { headers: { 'cache-control': 'no-store' } },
    )
  }

  const [book, trades] = await Promise.allSettled([getOrderBook(id), getTrades(id)])
  const orderBook = book.status === 'fulfilled' ? book.value : null
  const tradeFeed = trades.status === 'fulfilled' ? trades.value : null

  if (!orderBook && !tradeFeed) {
    return NextResponse.json(
      { error: 'provider_unavailable', orderBook: null, trades: null, supported: true },
      { status: 200, headers: { 'cache-control': 'no-store' } },
    )
  }

  return NextResponse.json(
    { orderBook, trades: tradeFeed, supported: true },
    { headers: { 'cache-control': 'no-store' } },
  )
}
