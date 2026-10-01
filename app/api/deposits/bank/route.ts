import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { randomUUID } from 'node:crypto'

const schema = z.object({
  amount: z.string().trim().regex(/^\d+(?:\.\d{1,2})?$/).refine((value) => Number(value) > 0 && Number(value) <= 1_000_000_000),
  senderBank: z.string().trim().min(2).max(120),
  sourceAccountName: z.string().trim().min(2).max(160),
  reference: z.string().trim().max(120).optional(),
  screenshotUrl: z.string().url().max(2000).nullable().optional(),
  merchantAccountId: z.string().uuid(),
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
  const { data: merchant, error } = await admin.rpc('allocate_merchant_account', { p_payment_method: 'bank_transfer' })
  if (error || !merchant?.id) return NextResponse.json({ error: 'No active merchant account is available.' }, { status: 503 })
  return NextResponse.json({ sessionId: String(merchant.id), merchantAccountId: String(merchant.id), bankName: merchant.bank_name, accountNumber: merchant.account_number, accountName: merchant.account_name, expiryTime: new Date(Date.now() + 15 * 60 * 1000).toISOString() }, { headers: { 'cache-control': 'no-store' } })
}

export async function POST(request: Request) {
  const user = await requireUser()
  if (!user?.id) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Enter a valid amount, sending bank and reference.' }, { status: 400 })

  const admin = createAdminClient()
  const { data: merchant, error: merchantError } = await admin.from('merchant_accounts').select('id,bank_name,account_number,account_name,active,payment_method').eq('id', parsed.data.merchantAccountId).eq('active', true).eq('payment_method', 'bank_transfer').maybeSingle()
  if (merchantError || !merchant?.id) return NextResponse.json({ error: 'The assigned merchant account is no longer available. Please restart the deposit.' }, { status: 409 })
  const reference = parsed.data.reference?.trim() || `DEP-${randomUUID().replaceAll('-', '').slice(0, 20).toUpperCase()}`
  const { data, error } = await admin.from('deposits').insert({
    user_id: user.id,
    merchant_account_id: merchant.id,
    payment_method: 'bank_transfer',
    bank_name: merchant.bank_name,
    account_number: merchant.account_number,
    account_name: merchant.account_name,
    amount: parsed.data.amount,
    sender_bank: parsed.data.senderBank.trim(),
    source_account_name: parsed.data.sourceAccountName.trim(),
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
