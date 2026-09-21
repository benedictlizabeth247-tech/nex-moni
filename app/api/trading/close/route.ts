import { NextResponse } from 'next/server'
import { and, eq, sql } from 'drizzle-orm'
import { headers } from 'next/headers'
import { randomUUID } from 'node:crypto'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { auditLog, futuresAccounts, spotAccounts, tradingPositions } from '@/lib/db/schema'
import { getQuotes } from '@/services/market-data/router'

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    const body = await request.json()
    const positionId = String(body?.positionId ?? '')
    const symbol = String(body?.symbol ?? '')
    const quoteId = symbol.includes('.') ? symbol : `crypto.${symbol.replace('/', '').toUpperCase()}`
    const market = await getQuotes([quoteId])
    const quote = market.quotes.find((item) => item.id === quoteId)
    const markPrice = Number(quote?.price ?? 0)
    if (!positionId || !quote || !Number.isFinite(markPrice) || markPrice <= 0 || quote.stale || !quote.timestamp || Date.now() - quote.timestamp > 30000) return NextResponse.json({ error: 'A fresh market price is required to close this position.' }, { status: 503 })
    const [position] = await db.select().from(tradingPositions).where(and(eq(tradingPositions.id, positionId), eq(tradingPositions.userId, session.user.id), eq(tradingPositions.status, 'open'))).limit(1)
    if (!position) return NextResponse.json({ error: 'Open position not found.' }, { status: 404 })
    const pnl = (position.side === 'buy' ? markPrice - Number(position.entryPrice) : Number(position.entryPrice) - markPrice) * Number(position.quantity)
    const now = new Date()
    await db.transaction(async (tx) => {
      await tx.update(tradingPositions).set({ markPrice: String(markPrice), unrealizedPnl: String(pnl), realizedPnl: String(pnl), status: 'closed', closedAt: now, updatedAt: now }).where(eq(tradingPositions.id, position.id))
      if (position.mode === 'spot') await tx.update(spotAccounts).set({ lockedUsdt: sql`${spotAccounts.lockedUsdt} - ${position.margin}`, balanceUsdt: sql`${spotAccounts.balanceUsdt} + ${pnl}`, updatedAt: now }).where(eq(spotAccounts.userId, session.user.id))
      else await tx.update(futuresAccounts).set({ lockedUsdt: sql`${futuresAccounts.lockedUsdt} - ${position.margin}`, balanceUsdt: sql`${futuresAccounts.balanceUsdt} + ${pnl}`, updatedAt: now }).where(eq(futuresAccounts.userId, session.user.id))
      await tx.insert(auditLog).values({ id: randomUUID(), actorUserId: session.user.id, action: 'TRADE_CLOSED', resourceType: 'trading_position', resourceId: position.id, metadata: { symbol, markPrice, realizedPnl: pnl } })
    })
    return NextResponse.json({ status: 'closed', position_id: position.id, realized_pnl: pnl, mark_price: markPrice, reference: `CLOSE-${position.id}` }, { headers: { 'cache-control': 'no-store' } })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Position close failed' }, { status: 400 })
  }
}
