import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { db } from '@/lib/db'
import { wallets, withdrawals as neonWithdrawals, auditLog, ledgerEntries } from '@/lib/db/schema'
import { and, eq, sql } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'

const schema = z.object({
  amount: z.number().finite().positive(),
  currency: z.string().trim().min(3).max(10),
  destinationType: z.enum(['bank', 'nex', 'card_refund', 'mobile_money', 'crypto']),
  destination: z.string().trim().min(1).max(255),
  network: z.string().trim().max(64).nullable().optional(),
  autopilot: z.boolean().optional().default(false),
  idempotencyKey: z.string().trim().min(16).max(128),
})

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  const user = session?.user

  if (!user?.id) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid withdrawal request.', details: parsed.error.flatten() }, { status: 400 })
  }

  if (parsed.data.destinationType === 'crypto' && !parsed.data.network) {
    return NextResponse.json({ error: 'Crypto network is required.' }, { status: 400 })
  }

  const requestId = randomUUID()
  const currency = parsed.data.currency.toUpperCase()
  try {
    await db.transaction(async (tx) => {
      const [wallet] = await tx.select().from(wallets).where(and(eq(wallets.userId, user.id), eq(wallets.currency, currency))).limit(1)
      if (!wallet || Number(wallet.availableBalance) < parsed.data.amount) throw new Error('Insufficient available balance.')
      await tx.update(wallets).set({ availableBalance: sql`${wallets.availableBalance} - ${parsed.data.amount}`, heldBalance: sql`${wallets.heldBalance} + ${parsed.data.amount}`, updatedAt: new Date() }).where(eq(wallets.id, wallet.id))
      await tx.insert(neonWithdrawals).values({ id: requestId, userId: user.id, amount: parsed.data.amount.toFixed(2), currency, destinationType: parsed.data.destinationType, destination: parsed.data.destination, status: 'PENDING', updatedAt: new Date() })
      await tx.insert(ledgerEntries).values({ id: randomUUID(), userId: user.id, walletId: wallet.id, kind: 'WITHDRAWAL_HOLD', direction: 'DEBIT', amount: parsed.data.amount.toFixed(2), currency, reference: `WD-${requestId}`, sourceId: requestId, metadata: { destinationType: parsed.data.destinationType, network: parsed.data.network ?? null } })
      await tx.insert(auditLog).values({ id: randomUUID(), actorUserId: user.id, action: 'WITHDRAWAL_CREATED', resourceType: 'withdrawal', resourceId: requestId, metadata: { amount: parsed.data.amount, currency } })
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create withdrawal request.'
    return NextResponse.json({ error: message }, { status: /insufficient/i.test(message) ? 422 : 400 })
  }

  const data = { status: 'created', request_id: requestId }
  return NextResponse.json({ ...data, autopilot_routing: parsed.data.autopilot ? 'pending' : undefined }, { status: 201 })
}
