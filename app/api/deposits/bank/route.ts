import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { randomUUID } from 'node:crypto'

const schema = z.object({
  amount: z.number().finite().positive().max(1_000_000_000),
  senderBank: z.string().trim().min(2).max(120),
  bankAccountId: z.string().trim().min(1).optional(),
  reference: z.string().trim().max(120).optional(),
  screenshotUrl: z.string().url().max(2000).nullable().optional(),
})

type BankAccount = { id: string; bankName: string; accountNumber: string; accountName: string }

function readBankAccounts(value: unknown): BankAccount[] {
  if (!value || typeof value !== 'object') return []
  const record = value as Record<string, unknown>
  const source = Array.isArray(record.accounts) ? record.accounts : [record]
  return source.flatMap((item, index) => {
    if (!item || typeof item !== 'object') return []
    const entry = item as Record<string, unknown>
    const bankName = String(entry.bankName ?? entry.bank_name ?? '').trim()
    const accountNumber = String(entry.accountNumber ?? entry.account_number ?? '').trim()
    const accountName = String(entry.accountName ?? entry.account_name ?? '').trim()
    if (!bankName || !accountNumber || !accountName) return []
    return [{ id: String(entry.id ?? entry.accountId ?? `${bankName}-${accountNumber}`), bankName, accountNumber, accountName }]
  })
}

async function requireUser() {
  const client = await createClient()
  const { data: { user } } = await client.auth.getUser()
  return user
}

export async function GET() {
  const user = await requireUser()
  if (!user?.id) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await admin.from('app_config').select('value').eq('id', 'bank_details').maybeSingle()
  if (error) return NextResponse.json({ error: 'Deposit configuration unavailable.' }, { status: 503 })

  const accounts = readBankAccounts(data?.value)
  const account = accounts[0]
  if (!account) return NextResponse.json({ error: 'Fiat funding account is not configured.' }, { status: 503 })

  return NextResponse.json({
    sessionId: randomUUID(),
    ...account,
    accounts,
    expiryTime: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  }, { headers: { 'cache-control': 'no-store' } })
}

export async function POST(request: Request) {
  const user = await requireUser()
  if (!user?.id) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Enter a valid amount, sending bank and reference.' }, { status: 400 })

  const admin = createAdminClient()
  const { data: config, error: configError } = await admin.from('app_config').select('value').eq('id', 'bank_details').maybeSingle()
  if (configError) return NextResponse.json({ error: 'Deposit configuration unavailable.' }, { status: 503 })
  const accounts = readBankAccounts(config?.value)
  const account = accounts.find((item) => item.id === parsed.data.bankAccountId) ?? accounts[0]
  if (!account) return NextResponse.json({ error: 'Fiat funding account is not configured.' }, { status: 503 })

  const reference = parsed.data.reference?.trim() || `DEP-${randomUUID().replaceAll('-', '').slice(0, 20).toUpperCase()}`
  const { data, error } = await admin.from('deposits').insert({
    user_id: user.id,
    bank_name: account.bankName,
    account_number: account.accountNumber,
    account_name: account.accountName,
    amount: parsed.data.amount,
    sender_bank: parsed.data.senderBank.trim(),
    reference,
    screenshot_url: parsed.data.screenshotUrl ?? null,
    status: 'pending',
    expiry_time: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  }).select('id,reference').single()

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'That transfer reference has already been submitted.' }, { status: 409 })
    return NextResponse.json({ error: 'Deposit request could not be recorded.' }, { status: 422 })
  }

  return NextResponse.json({ success: true, depositId: data.id, referenceId: data.reference })
}
