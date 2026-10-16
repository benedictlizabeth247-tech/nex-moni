import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { randomUUID } from 'node:crypto'
import { db } from '@/lib/db'
import { deposits } from '@/lib/db/schema'

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

  const receivingAccounts = [
    { bankName: 'UBA', accountNumber: '2295345512', accountName: 'Benjamin Arinze Atuchukwu' },
    { bankName: 'Access Bank', accountNumber: '1841089139', accountName: 'Benjamin Arinze' },
  ]
  const selected = receivingAccounts[0] as { bankName: string; accountNumber: string; accountName: string }

  return NextResponse.json({
    sessionId: randomUUID(),
    bankName: selected.bankName,
    accountNumber: selected.accountNumber,
    accountName: selected.accountName,
    receivingAccounts,
    expiryTime: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  }, { headers: { 'cache-control': 'no-store' } })
}

export async function POST(request: Request) {
  const user = await requireUser()
  if (!user?.id) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Enter a valid amount, sending bank and reference.' }, { status: 400 })

  const receivingAccounts = [
    { bankName: 'UBA', accountNumber: '2295345512', accountName: 'Benjamin Arinze Atuchukwu' },
    { bankName: 'Access Bank', accountNumber: '1841089139', accountName: 'Benjamin Arinze' },
  ]
  const selected = receivingAccounts.find((account: any) => account.bankName === parsed.data.receivingBank) ?? receivingAccounts[0]
  const bankName = String(selected.bankName)
  const accountNumber = String(selected.accountNumber)
  const accountName = String(selected.accountName)
  const reference = `NXM-${randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase()}`
  const depositId = randomUUID()
  try {
    await db.insert(deposits).values({
      id: depositId,
      userId: user.id,
      amount: parsed.data.amount.toFixed(2),
      currency: 'NGN',
      method: 'bank_transfer',
      senderBank: parsed.data.senderBank.trim(),
      senderBankCode: parsed.data.senderBankCode ?? null,
      senderAccountName: parsed.data.senderAccountName.trim(),
      senderAccountNumber: parsed.data.senderAccountNumber,
      senderBranch: parsed.data.senderBranch ?? null,
      receivingBank: bankName,
      receivingAccountNumber: accountNumber,
      receivingAccountName: accountName,
      reference,
      status: 'PENDING',
      screenshotUrl: parsed.data.screenshotUrl ?? null,
      expiryTime: new Date(Date.now() + 15 * 60 * 1000),
      updatedAt: new Date(),
    })
  } catch {
    return NextResponse.json({ error: 'Deposit request could not be recorded.' }, { status: 422 })
  }

  return NextResponse.json({ success: true, depositId, referenceId: reference })
}
