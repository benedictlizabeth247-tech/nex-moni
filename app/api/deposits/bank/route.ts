import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { randomUUID } from 'node:crypto'

const schema = z.object({
  amount: z.number().finite().positive().max(1_000_000_000),
  senderBank: z.string().trim().min(2).max(120),
  reference: z.string().trim().max(120).optional(),
  screenshotUrl: z.string().url().max(2000).nullable().optional(),
})

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

  const value = data?.value as Record<string, unknown> | null
  const bankName = typeof value?.bankName === 'string' ? value.bankName.trim() : ''
  const accountNumber = typeof value?.accountNumber === 'string' ? value.accountNumber.trim() : ''
  const accountName = typeof value?.accountName === 'string' ? value.accountName.trim() : ''
  if (!bankName || !accountNumber || !accountName) {
    return NextResponse.json({ error: 'Fiat funding account is not configured.' }, { status: 503 })
  }

  return NextResponse.json({
    sessionId: randomUUID(),
    bankName,
    accountNumber,
    accountName,
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
  const value = config?.value as Record<string, unknown> | null
  const bankName = typeof value?.bankName === 'string' ? value.bankName.trim() : ''
  const accountNumber = typeof value?.accountNumber === 'string' ? value.accountNumber.trim() : ''
  const accountName = typeof value?.accountName === 'string' ? value.accountName.trim() : ''
  if (!bankName || !accountNumber || !accountName) return NextResponse.json({ error: 'Fiat funding account is not configured.' }, { status: 503 })

  const reference = parsed.data.reference?.trim() || `DEP-${randomUUID().replaceAll('-', '').slice(0, 20).toUpperCase()}`
  const { data, error } = await admin.from('deposits').insert({
    user_id: user.id,
    bank_name: bankName,
    account_number: accountNumber,
    account_name: accountName,
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
