import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getQuotes } from '@/services/market-data/router'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const mode = body?.mode
    const symbol = String(body?.symbol ?? '')
    const side = body?.side
    const orderType = body?.orderType ?? 'market'
    const quantity = Number(body?.quantity)
    const leverage = Number(body?.leverage ?? 1)
    const takeProfit = body?.takeProfit == null || body?.takeProfit === '' ? null : Number(body.takeProfit)
    const stopLoss = body?.stopLoss == null || body?.stopLoss === '' ? null : Number(body.stopLoss)
    if (!Number.isFinite(leverage) || leverage < 1 || leverage > 50) return NextResponse.json({ error: 'Leverage must be between 1x and 50x.' }, { status: 400 })
    const client = await createClient()
    const { data: auth } = await client.auth.getUser()
    const userId = auth.user?.id
    if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    if (!['spot', 'futures'].includes(mode) || !['buy', 'sell'].includes(side) || !['market', 'limit', 'stop'].includes(orderType) || !symbol || !Number.isFinite(quantity) || quantity <= 0) {
      return NextResponse.json({ error: 'Invalid order request' }, { status: 400 })
    }
    if (!symbol.toLowerCase().startsWith('crypto.') && !symbol.includes('/')) {
      return NextResponse.json({ error: 'Order entry is enabled only for crypto spot and futures. This market is display-only.' }, { status: 403 })
    }
    if ((takeProfit !== null && (!Number.isFinite(takeProfit) || takeProfit <= 0)) || (stopLoss !== null && (!Number.isFinite(stopLoss) || stopLoss <= 0))) {
      return NextResponse.json({ error: 'Take-profit and stop-loss must be positive prices.' }, { status: 400 })
    }

    const quoteId = symbol.includes('.') ? symbol : symbol.includes('/') ? `crypto.${symbol.replace('/', '').toUpperCase()}` : `stock.${symbol.toUpperCase()}`
    const market = await getQuotes([quoteId])
    const quote = market.quotes.find((q) => q.id === quoteId)
    const executionPrice = Number(quote?.price ?? 0)
    if (!executionPrice || !Number.isFinite(executionPrice)) {
      return NextResponse.json({ error: 'No live execution price is currently available.' }, { status: 503 })
    }
    if (quote?.stale || !quote.timestamp || Date.now() - quote.timestamp > 30_000) {
      return NextResponse.json({ error: 'Market feed is stale; order execution is paused until a fresh price is available.' }, { status: 503 })
    }
    if (mode === 'futures' && (leverage < 1 || leverage > 50)) {
      return NextResponse.json({ error: 'Futures leverage must be between 1x and 50x.' }, { status: 400 })
    }

    const { data, error } = await client.rpc('trading_execute_order', {
      p_user_id: userId,
      p_mode: mode,
      p_symbol: symbol,
      p_side: side,
      p_order_type: orderType,
      p_quantity: quantity,
      p_execution_price: executionPrice,
      p_leverage: leverage,
      p_take_profit: takeProfit,
      p_stop_loss: stopLoss,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ...data, execution_price: executionPrice, provider: quote.provider, timestamp: quote.timestamp }, { headers: { 'cache-control': 'no-store' } })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Execution failed' }, { status: 500 })
  }
}
