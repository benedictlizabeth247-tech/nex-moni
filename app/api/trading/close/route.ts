import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getQuotes } from '@/services/market-data/router'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    const positionId = String(body?.positionId ?? '')
    const symbol = String(body?.symbol ?? '')
    if (!positionId || !symbol) return NextResponse.json({ error: 'Position and market are required.' }, { status: 400 })

    const client = await createClient()
    const { data: auth } = await client.auth.getUser()
    if (!auth.user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const quoteId = symbol.includes('.') ? symbol : symbol.includes('/') ? `crypto.${symbol.replace('/', '').toUpperCase()}` : `stock.${symbol.toUpperCase()}`
    const market = await getQuotes([quoteId])
    const quote = market.quotes.find((item) => item.id === quoteId)
    const markPrice = Number(quote?.price ?? 0)
    if (!quote || !Number.isFinite(markPrice) || markPrice <= 0) return NextResponse.json({ error: 'No live execution price is currently available.' }, { status: 503 })
    if (quote.stale || !quote.timestamp || Date.now() - quote.timestamp > 30_000) return NextResponse.json({ error: 'Market feed is stale; closing is paused until a fresh price is available.' }, { status: 503 })

    const { data, error } = await client.rpc('trading_close_position', { p_position_id: positionId, p_mark_price: markPrice })
    if (error) return NextResponse.json({ error: error.message, code: error.code ?? 'CLOSE_POSITION_FAILED' }, { status: 400 })
    return NextResponse.json({ ...data, execution_price: markPrice, provider: quote.provider, timestamp: quote.timestamp }, { headers: { 'cache-control': 'no-store' } })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Position close failed' }, { status: 500 })
  }
}
