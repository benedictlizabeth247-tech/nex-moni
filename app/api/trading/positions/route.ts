import { NextResponse } from 'next/server'
import { and, desc, eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { tradingOrders, tradingPositions } from '@/lib/db/schema'

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const mode = new URL(request.url).searchParams.get('mode')
  const filter = mode === 'spot' || mode === 'futures' ? and(eq(tradingPositions.userId, session.user.id), eq(tradingPositions.mode, mode)) : eq(tradingPositions.userId, session.user.id)
  const positions = await db.select().from(tradingPositions).where(filter).orderBy(desc(tradingPositions.openedAt)).limit(100)
  const orders = await db.select().from(tradingOrders).where(eq(tradingOrders.userId, session.user.id)).orderBy(desc(tradingOrders.createdAt)).limit(100)
  return NextResponse.json({ positions, orders }, { headers: { 'cache-control': 'no-store' } })
}
