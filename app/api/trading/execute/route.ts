import { NextResponse } from 'next/server'
import { and, eq, sql } from 'drizzle-orm'
import { headers } from 'next/headers'
import { randomUUID } from 'node:crypto'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { auditLog, futuresAccounts, spotAccounts, tradingOrders, tradingPositions } from '@/lib/db/schema'
import { getQuotes } from '@/services/market-data/router'
import { calculateFuturesOrder, calculateSpotOrder, DEFAULT_TRADING_FEE_RATE } from '@/lib/trading-calculations'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    const body = await request.json()
    const mode = body?.mode as 'spot' | 'futures'
    const symbol = String(body?.symbol ?? '')
    const side = body?.side as 'buy' | 'sell'
    const orderType = body?.orderType ?? 'market'
    const requestedAmountUsdt = Number(body?.amountUsdt ?? body?.marginUsdt ?? 0)
    const leverage = Number(body?.leverage ?? 1)
    if (!['spot', 'futures'].includes(mode) || !['buy', 'sell'].includes(side) || orderType !== 'market' || !symbol || !Number.isFinite(requestedAmountUsdt) || requestedAmountUsdt <= 0 || leverage < 1 || leverage > 50) return NextResponse.json({ error: 'Enter a valid USDT amount.' }, { status: 400 })
    const quoteId = symbol.includes('.') ? symbol : `crypto.${symbol.replace('/', '').toUpperCase()}`
    const market = await getQuotes([quoteId])
    const quote = market.quotes.find((item) => item.id === quoteId)
    const executionPrice = Number(quote?.price ?? 0)
    if (!quote || !Number.isFinite(executionPrice) || executionPrice <= 0 || quote.stale || !quote.timestamp || Date.now() - quote.timestamp > 30000) return NextResponse.json({ error: 'A fresh market price is required.' }, { status: 503 })
    const quantity = mode === 'futures'
      ? calculateFuturesOrder(requestedAmountUsdt, leverage, executionPrice, DEFAULT_TRADING_FEE_RATE).quantity
      : calculateSpotOrder(requestedAmountUsdt, executionPrice, DEFAULT_TRADING_FEE_RATE).quantity
    const margin = requestedAmountUsdt
    const estimatedFee = (mode === 'futures' ? requestedAmountUsdt * leverage : requestedAmountUsdt) * DEFAULT_TRADING_FEE_RATE
    if (!Number.isFinite(quantity) || quantity <= 0) return NextResponse.json({ error: 'The executable market price could not produce a valid quantity.' }, { status: 400 })
    const accountId = randomUUID()
    const positionId = randomUUID()
    const orderId = randomUUID()
    await db.transaction(async (tx) => {
      if (mode === 'spot') {
        const [account] = await tx.select().from(spotAccounts).where(eq(spotAccounts.userId, session.user.id)).limit(1)
        if (!account || Number(account.balanceUsdt) - Number(account.lockedUsdt) < margin + estimatedFee) throw new Error('Insufficient available Spot balance for amount and estimated fee.')
        await tx.update(spotAccounts).set({ lockedUsdt: sql`${spotAccounts.lockedUsdt} + ${margin}`, updatedAt: new Date() }).where(eq(spotAccounts.id, account.id))
      } else {
        const [account] = await tx.select().from(futuresAccounts).where(eq(futuresAccounts.userId, session.user.id)).limit(1)
        if (!account || Number(account.balanceUsdt) - Number(account.lockedUsdt) < margin + estimatedFee) throw new Error('Insufficient available Futures margin for margin and estimated fee.')
        await tx.update(futuresAccounts).set({ lockedUsdt: sql`${futuresAccounts.lockedUsdt} + ${margin}`, updatedAt: new Date() }).where(eq(futuresAccounts.id, account.id))
      }
      await tx.insert(tradingOrders).values({ id: orderId, userId: session.user.id, mode, symbol, side, orderType, quantity: String(quantity), price: String(executionPrice), leverage: String(leverage), margin: String(margin), status: 'filled', updatedAt: new Date() })
      await tx.insert(tradingPositions).values({ id: positionId, userId: session.user.id, mode, symbol, side, quantity: String(quantity), entryPrice: String(executionPrice), markPrice: String(executionPrice), leverage: String(leverage), margin: String(margin), status: 'open', updatedAt: new Date() })
      await tx.insert(auditLog).values({ id: accountId, actorUserId: session.user.id, action: 'TRADE_OPENED', resourceType: 'trading_position', resourceId: positionId, metadata: { mode, symbol, side, quantity, executionPrice, margin } })
    })
    return NextResponse.json({ status: 'filled', order_id: orderId, position_id: positionId, execution_price: executionPrice, margin, provider: quote.provider, timestamp: quote.timestamp }, { headers: { 'cache-control': 'no-store' } })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Execution failed' }, { status: 400 })
  }
}
