import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { db } from "@/lib/db"
import { wallets, ledgerEntries, auditLog, transactions } from "@/lib/db/schema"
import { sql } from "drizzle-orm"
import { randomUUID } from "node:crypto"
import { z } from "zod"

const schema = z.object({
  userId: z.string().trim().min(1).max(128),
  amount: z.number().finite().refine((value) => value !== 0 && Math.abs(value) <= 1000000000, "Amount must be non-zero and within the allowed limit").refine((value) => Number.isInteger(value * 100000000), "Amount supports up to 8 decimal places"),
  currency: z.enum(["NGN", "USD", "USDT"]).default("USDT"),
  reference: z.string().trim().max(120).optional(),
  reason: z.string().trim().min(3).max(500),
})

export async function POST(request: Request) {
  let adminContext: Awaited<ReturnType<typeof requireAdmin>>
  try {
    adminContext = await requireAdmin()
  } catch {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 })
  }
  const user = adminContext.user
  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse({
    userId: body?.userId,
    amount: typeof body?.amount === "string" ? Number(body.amount.trim()) : Number(body?.amount),
    currency: typeof body?.currency === "string" ? body.currency.trim().toUpperCase() : body?.currency || "USDT",
    reason: typeof body?.reason === "string" ? body.reason.trim() : body?.reason,
    reference: body?.reference,
  })
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid amount, currency and reason." }, { status: 400 })

  try {
    const now = new Date()
    const walletId = randomUUID()
    const reference = parsed.data.reference?.trim() || `ADMIN-${randomUUID()}`
    const amount = parsed.data.amount.toFixed(2)
    const direction = parsed.data.amount > 0 ? 'CREDIT' : 'DEBIT'
    const absoluteAmount = Math.abs(parsed.data.amount).toFixed(2)

    const result = await db.transaction(async (tx) => {
      const [wallet] = await tx.insert(wallets).values({ id: walletId, userId: parsed.data.userId, currency: parsed.data.currency, availableBalance: '0', updatedAt: now }).onConflictDoNothing().returning()
      const [updated] = await tx.update(wallets).set({ availableBalance: sql`${wallets.availableBalance} + ${amount}`, updatedAt: now }).where(sql`${wallets.userId} = ${parsed.data.userId} AND ${wallets.currency} = ${parsed.data.currency} AND ${wallets.availableBalance} + ${amount} >= 0`).returning()
      if (!updated) throw new Error('Insufficient available balance for this debit.')
      await tx.insert(ledgerEntries).values({ id: randomUUID(), userId: parsed.data.userId, walletId: updated.id, kind: 'ADMIN_ADJUSTMENT', direction, amount: absoluteAmount, currency: parsed.data.currency, reference, metadata: { reason: parsed.data.reason, actorUserId: user.id } }).onConflictDoNothing({ target: ledgerEntries.reference })
      await tx.insert(transactions).values({ id: randomUUID(), userId: parsed.data.userId, walletId: updated.id, type: direction === 'CREDIT' ? 'deposit' : 'withdrawal', amount: absoluteAmount, currency: parsed.data.currency, status: 'completed', description: parsed.data.reason, updatedAt: now })
      await tx.insert(auditLog).values({ id: randomUUID(), actorUserId: user.id, action: 'ADMIN_WALLET_ADJUSTMENT', resourceType: 'wallet', resourceId: updated.id, metadata: { userId: parsed.data.userId, amount, currency: parsed.data.currency, reason: parsed.data.reason, reference } })
      return updated
    })
    return NextResponse.json({ success: true, committed: true, wallet: { ...result, balance_after: result.availableBalance, available: result.availableBalance, currency: result.currency, transaction_id: reference } })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Wallet adjustment failed.' }, { status: 422 })
  }
}
