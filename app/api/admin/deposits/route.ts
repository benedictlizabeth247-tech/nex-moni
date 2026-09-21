import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/admin'
import { z } from 'zod'
import { db } from '@/lib/db'
import { deposits as neonDeposits, wallets, ledgerEntries, auditLog } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'
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
  const admin = createAdminClient()
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid deposit action.' }, { status: 400 })

  const { data, error } = await admin.rpc('admin_review_deposit', {
    p_actor_user_id: user.id,
    p_deposit_id: parsed.data.depositId,
    p_action: parsed.data.action,
    p_note: parsed.data.note || null,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 422 })

  const result = Array.isArray(data) ? data[0] : data
  const status = parsed.data.action === 'approve' ? 'APPROVED' : 'REJECTED'
  const reviewedAt = new Date()
  const [deposit] = await db.select().from(neonDeposits).where(eq(neonDeposits.id, parsed.data.depositId)).limit(1)
  if (!deposit) return NextResponse.json({ error: 'Neon deposit record not found.' }, { status: 409 })

  await db.transaction(async (tx) => {
    await tx.update(neonDeposits).set({ status, reviewedAt, reviewedBy: user.id, rejectionReason: parsed.data.action === 'reject' ? parsed.data.note ?? null : null, updatedAt: reviewedAt }).where(eq(neonDeposits.id, parsed.data.depositId))
    if (parsed.data.action === 'approve') {
      await tx.insert(wallets).values({ id: randomUUID(), userId: deposit.userId, currency: deposit.currency, availableBalance: deposit.amount, updatedAt: reviewedAt }).onConflictDoUpdate({ target: [wallets.userId, wallets.currency], set: { availableBalance: sql`${wallets.availableBalance} + ${deposit.amount}`, updatedAt: reviewedAt } })
      await tx.insert(ledgerEntries).values({ id: randomUUID(), userId: deposit.userId, kind: 'DEPOSIT', direction: 'CREDIT', amount: deposit.amount, currency: deposit.currency, reference: `DEP-${deposit.reference}`, sourceId: deposit.id, metadata: { approvedBy: user.id } }).onConflictDoNothing({ target: ledgerEntries.reference })
    }
    await tx.insert(auditLog).values({ id: randomUUID(), actorUserId: user.id, action: `DEPOSIT_${status}`, resourceType: 'deposit', resourceId: deposit.id, metadata: { reference: deposit.reference, amount: deposit.amount, currency: deposit.currency } })
  })
  return NextResponse.json(result)
}
