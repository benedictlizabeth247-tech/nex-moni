import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { randomUUID } from 'node:crypto'
import { db } from '@/lib/db'
import { deposits, merchantAccounts, merchantAssignments } from '@/lib/db/schema'
import { and, asc, eq, gt, lte, sql } from 'drizzle-orm'

const schema = z.object({
  amount: z.number().finite().positive().max(1_000_000_000),
  senderBank: z.string().trim().min(2).max(120),
  senderAccountName: z.string().trim().min(2).max(120),
  senderAccountNumber: z.string().regex(/^\d{10}$/),
  senderBranch: z.string().trim().max(120).optional(),
  senderBankCode: z.string().trim().max(32).optional(),
  reference: z.string().trim().max(120).optional(),
  screenshotUrl: z.string().url().max(2000).nullable().optional(),
  receivingBank: z.enum(['UBA', 'Access Bank']).optional(),
})

async function requireUser() {
  const session = await auth.api.getSession({ headers: await headers() })
  return session?.user ?? null
}

export async function GET() {
  const user = await requireUser()
  if (!user?.id) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

  const existing = await db.select({ deposit: deposits, assignment: merchantAssignments }).from(deposits).innerJoin(merchantAssignments, eq(merchantAssignments.depositId, deposits.id)).where(and(eq(deposits.userId, user.id), eq(merchantAssignments.status, 'active'), gt(merchantAssignments.expiresAt, new Date()))).orderBy(sql`${merchantAssignments.createdAt} desc`).limit(1)
  const active = existing[0]
  if (!active) return NextResponse.json({ error: 'No active deposit transaction found.' }, { status: 404 })
  return NextResponse.json({ sessionId: active.deposit.id, bankName: active.assignment.assignedBankName, accountNumber: active.assignment.assignedAccountNumber, accountName: active.assignment.assignedAccountName, branchName: active.assignment.assignedBranchName, receivingAccounts: [{ bankName: active.assignment.assignedBankName, accountNumber: active.assignment.assignedAccountNumber, accountName: active.assignment.assignedAccountName, branchName: active.assignment.assignedBranchName }], expiryTime: active.assignment.expiresAt.toISOString(), reference: active.deposit.reference, amount: active.deposit.amount }, { headers: { 'cache-control': 'no-store' } })
}

export async function POST(request: Request) {
  const user = await requireUser()
  if (!user?.id) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Enter a valid amount, sending bank and reference.' }, { status: 400 })

  const depositId = randomUUID()
  const reference = `NEX-DEP-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase()}`
  try {
    const created = await db.transaction(async (tx) => {
      const existing = await tx.select({ deposit: deposits, assignment: merchantAssignments }).from(deposits).innerJoin(merchantAssignments, eq(merchantAssignments.depositId, deposits.id)).where(and(eq(deposits.userId, user.id), eq(merchantAssignments.status, 'active'), gt(merchantAssignments.expiresAt, new Date()))).limit(1)
      if (existing[0]) throw new Error('ACTIVE_DEPOSIT_EXISTS')
      const candidates = await tx.select().from(merchantAccounts).where(and(eq(merchantAccounts.isActive, true), eq(merchantAccounts.depositEnabled, true), eq(merchantAccounts.verified, true), eq(merchantAccounts.currency, 'NGN'), eq(merchantAccounts.currentStatus, 'available'), lte(merchantAccounts.minimumDepositNgn, String(parsed.data.amount)), gt(merchantAccounts.maximumDepositNgn, String(parsed.data.amount)), sql`${merchantAccounts.dailyReceivedNgn} + ${merchantAccounts.reservedNgn} + ${parsed.data.amount} <= ${merchantAccounts.dailyLimitNgn}`)).orderBy(asc(merchantAccounts.priority), asc(merchantAccounts.lastAssignedAt)).limit(10)
      const selected = candidates.find((merchant) => Number(merchant.dailyLimitNgn) - Number(merchant.dailyReceivedNgn) - Number(merchant.reservedNgn) >= parsed.data.amount)
      if (!selected) throw new Error('NO_MERCHANT_AVAILABLE')
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000)
      await tx.insert(deposits).values({ id: depositId, userId: user.id, amount: parsed.data.amount.toFixed(2), currency: 'NGN', method: 'bank_transfer', senderBank: parsed.data.senderBank.trim(), senderBankCode: parsed.data.senderBankCode ?? null, senderAccountName: parsed.data.senderAccountName.trim(), senderAccountNumber: parsed.data.senderAccountNumber, senderBranch: parsed.data.senderBranch ?? null, receivingBank: selected.bankName, receivingAccountNumber: selected.accountNumber, receivingAccountName: selected.accountName, reference, status: 'PENDING', screenshotUrl: parsed.data.screenshotUrl ?? null, expiryTime: expiresAt, updatedAt: new Date() })
      await tx.insert(merchantAssignments).values({ id: randomUUID(), depositId, userId: user.id, merchantId: selected.id, amountNgn: parsed.data.amount.toFixed(2), assignedBankName: selected.bankName, assignedAccountName: selected.accountName, assignedAccountNumber: selected.accountNumber, assignedBranchName: selected.branchName, status: 'active', expiresAt, updatedAt: new Date() })
      await tx.update(merchantAccounts).set({ reservedNgn: sql`${merchantAccounts.reservedNgn} + ${parsed.data.amount}`, assignmentCount: sql`${merchantAccounts.assignmentCount} + 1`, lastAssignedAt: new Date(), updatedAt: new Date() }).where(eq(merchantAccounts.id, selected.id))
      return { bankName: selected.bankName, accountNumber: selected.accountNumber, accountName: selected.accountName, branchName: selected.branchName, expiresAt }
    })
    return NextResponse.json({ success: true, depositId, referenceId: reference, merchant: created })
  } catch (error) {
    if (error instanceof Error && error.message === 'ACTIVE_DEPOSIT_EXISTS') return NextResponse.json({ error: 'You already have an active deposit transaction.' }, { status: 409 })
    if (error instanceof Error && error.message === 'NO_MERCHANT_AVAILABLE') return NextResponse.json({ error: 'No merchant account is currently available for this amount.' }, { status: 409 })
    return NextResponse.json({ error: 'Deposit request could not be recorded.' }, { status: 422 })
  }
}
