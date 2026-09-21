import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { futuresAccounts, spotAccounts, wallets } from '@/lib/db/schema'

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id
  const [funding] = await db.select().from(wallets).where(and(eq(wallets.userId, userId), eq(wallets.currency, 'USDT'))).limit(1)
  const [spot] = await db.select().from(spotAccounts).where(eq(spotAccounts.userId, userId)).limit(1)
  const [futures] = await db.select().from(futuresAccounts).where(eq(futuresAccounts.userId, userId)).limit(1)
  const fundingBalance = Number(funding?.availableBalance ?? 0)
  const spotBalance = Number(spot?.balanceUsdt ?? 0)
  const spotLocked = Number(spot?.lockedUsdt ?? 0)
  const futuresBalance = Number(futures?.balanceUsdt ?? 0)
  const futuresLocked = Number(futures?.lockedUsdt ?? 0)
  return NextResponse.json({
    totalBalance: fundingBalance + spotBalance + futuresBalance,
    totalLocked: spotLocked + futuresLocked,
    totalAvailable: fundingBalance + spotBalance - spotLocked + futuresBalance - futuresLocked,
    funding: { balance: fundingBalance, available: fundingBalance, currency: 'USDT' },
    spot: { balance: spotBalance, locked: spotLocked, available: Math.max(0, spotBalance - spotLocked) },
    futures: { balance: futuresBalance, locked: futuresLocked, available: Math.max(0, futuresBalance - futuresLocked) },
    positions: { spot: [], futures: [] },
  })
}
