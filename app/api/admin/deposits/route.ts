import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { z } from 'zod'
import { db } from '@/lib/db'
import { deposits as neonDeposits, wallets, ledgerEntries, auditLog } from '@/lib/db/schema'
import { and, eq, sql } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'

const schema = z.object({
  depositId: z.string().uuid(),
  action: z.enum(['approve', 'reject']),
  note: z.string().trim().max(500).optional(),
})

export async function POST(request: Request) {
  let adminContext: Awaited<ReturnType<typeof requireAdmin>>
  try {
    adminContext = await requireAdmin()
  } catch {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })
  }
  const user = adminContext.user
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid deposit action.' }, { status: 400 })

  const status = parsed.data.action === 'approve' ? 'APPROVED' : 'REJECTED'
  const reviewedAt = new Date()
  const [deposit] = await db.select().from(neonDeposits).where(eq(neonDeposits.id, parsed.data.depositId)).limit(1)
  if (!deposit) return NextResponse.json({ error: 'Neon deposit record not found.' }, { status: 409 })
  if (deposit.status !== 'PENDING') return NextResponse.json({ error: 'Deposit has already been reviewed.' }, { status: 409 })

  await db.transaction(async (tx) => {
    await tx.update(neonDeposits).set({ status, reviewedAt, reviewedBy: user.id, rejectionReason: parsed.data.action === 'reject' ? parsed.data.note ?? null : null, updatedAt: reviewedAt }).where(and(eq(neonDeposits.id, parsed.data.depositId), eq(neonDeposits.status, 'PENDING')))
    if (parsed.data.action === 'approve') {
      const [wallet] = await tx.select().from(wallets).where(and(eq(wallets.userId, deposit.userId), eq(wallets.currency, deposit.currency))).limit(1)
      if (wallet) {
        await tx.update(wallets).set({ availableBalance: sql`${wallets.availableBalance} + ${deposit.amount}`, updatedAt: reviewedAt }).where(eq(wallets.id, wallet.id))
      } else {
        await tx.insert(wallets).values({ id: randomUUID(), userId: deposit.userId, currency: deposit.currency, availableBalance: deposit.amount, updatedAt: reviewedAt })
      }
      await tx.insert(ledgerEntries).values({ id: randomUUID(), userId: deposit.userId, kind: 'DEPOSIT', direction: 'CREDIT', amount: deposit.amount, currency: deposit.currency, reference: `DEP-${deposit.reference}`, sourceId: deposit.id, metadata: { approvedBy: user.id } }).onConflictDoNothing({ target: ledgerEntries.reference })
    }
    await tx.insert(auditLog).values({ id: randomUUID(), actorUserId: user.id, action: `DEPOSIT_${status}`, resourceType: 'deposit', resourceId: deposit.id, metadata: { reference: deposit.reference, amount: deposit.amount, currency: deposit.currency } })
  })
  return NextResponse.json({ success: true, status, depositId: deposit.id })
}
