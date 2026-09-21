import { NextResponse } from 'next/server'
import { and, eq, sql } from 'drizzle-orm'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { accountTransfers, auditLog, futuresAccounts, spotAccounts, wallets } from '@/lib/db/schema'
import { randomUUID } from 'node:crypto'

const types = ['funding', 'spot', 'futures'] as const
type AccountType = typeof types[number]
const valid = (value: unknown): value is AccountType => typeof value === 'string' && types.includes(value as AccountType)

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => null)
  const amount = Number(body?.amount)
  const from = body?.from
  const to = body?.to
  if (!valid(from) || !valid(to) || from === to || !Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: 'Choose different accounts and enter a valid amount.' }, { status: 400 })
  const userId = session.user.id
  const transferId = randomUUID()
  try {
    await db.transaction(async (tx) => {
      const [funding] = await tx.select().from(wallets).where(and(eq(wallets.userId, userId), eq(wallets.currency, 'USDT'))).limit(1)
      const [spot] = await tx.select().from(spotAccounts).where(eq(spotAccounts.userId, userId)).limit(1)
      const [futures] = await tx.select().from(futuresAccounts).where(eq(futuresAccounts.userId, userId)).limit(1)
      const sourceAvailable = from === 'funding' ? Number(funding?.availableBalance ?? 0) : from === 'spot' ? Number(spot?.balanceUsdt ?? 0) - Number(spot?.lockedUsdt ?? 0) : Number(futures?.balanceUsdt ?? 0) - Number(futures?.lockedUsdt ?? 0)
      if (amount > sourceAvailable + 1e-8) throw new Error(`Insufficient available ${from} balance.`)
      if (from === 'funding') await tx.update(wallets).set({ availableBalance: sql`${wallets.availableBalance} - ${amount}`, updatedAt: new Date() }).where(eq(wallets.id, funding!.id))
      if (from === 'spot') await tx.update(spotAccounts).set({ balanceUsdt: sql`${spotAccounts.balanceUsdt} - ${amount}`, updatedAt: new Date() }).where(eq(spotAccounts.id, spot!.id))
      if (from === 'futures') await tx.update(futuresAccounts).set({ balanceUsdt: sql`${futuresAccounts.balanceUsdt} - ${amount}`, updatedAt: new Date() }).where(eq(futuresAccounts.id, futures!.id))
      if (to === 'funding') {
        if (funding) await tx.update(wallets).set({ availableBalance: sql`${wallets.availableBalance} + ${amount}`, updatedAt: new Date() }).where(eq(wallets.id, funding.id))
        else await tx.insert(wallets).values({ id: randomUUID(), userId, currency: 'USDT', availableBalance: amount.toFixed(8), updatedAt: new Date() })
      }
      if (to === 'spot') {
        if (spot) await tx.update(spotAccounts).set({ balanceUsdt: sql`${spotAccounts.balanceUsdt} + ${amount}`, updatedAt: new Date() }).where(eq(spotAccounts.id, spot.id))
        else await tx.insert(spotAccounts).values({ id: randomUUID(), userId, balanceUsdt: amount.toFixed(8), updatedAt: new Date() })
      }
      if (to === 'futures') {
        if (futures) await tx.update(futuresAccounts).set({ balanceUsdt: sql`${futuresAccounts.balanceUsdt} + ${amount}`, updatedAt: new Date() }).where(eq(futuresAccounts.id, futures.id))
        else await tx.insert(futuresAccounts).values({ id: randomUUID(), userId, balanceUsdt: amount.toFixed(8), updatedAt: new Date() })
      }
      await tx.insert(accountTransfers).values({ id: transferId, userId, fromAccountType: from, toAccountType: to, amountUsdt: amount.toFixed(8), status: 'completed', updatedAt: new Date() })
      await tx.insert(auditLog).values({ id: randomUUID(), actorUserId: userId, action: 'ACCOUNT_TRANSFER_COMPLETED', resourceType: 'account_transfer', resourceId: transferId, metadata: { from, to, amount } })
    })
    return NextResponse.json({ success: true, transferId })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Transfer failed.' }, { status: 422 })
  }
}
