import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { randomUUID } from 'node:crypto'

const schema = z.object({
  amount: z.number().finite().positive().max(1_000_000_000),
  senderBank: z.string().trim().min(2).max(120),
  bankId: z.string().trim().min(1).max(120).optional(),
  reference: z.string().trim().max(120).optional(),
  screenshotUrl: z.string().url().max(2000).nullable().optional(),
})

function configuredBanks(value: Record<string, unknown> | null) {
  const configured = value?.accounts
  if (Array.isArray(configured)) {
    return configured
      .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
      .map((item, index) => ({
        id: String(item.id || item.bankId || `bank-${index + 1}`),
        bankName: String(item.bankName || item.bank_name || '').trim(),
        accountNumber: String(item.accountNumber || item.account_number || '').trim(),
        accountName: String(item.accountName || item.account_name || '').trim(),
      }))
  }

  const bankName = String(value?.bankName || value?.bank_name || '').trim()
  const accountNumber = String(value?.accountNumber || value?.account_number || '').trim()
  const accountName = String(value?.accountName || value?.account_name || '').trim()
  return bankName || accountNumber || accountName ? [{ id: 'configured', bankName, accountNumber, accountName }] : []
}

async function requireUser() {
  const client = await createClient()
  const { data: { user } } = await client.auth.getUser()
  return user
}

async function getConfiguredBanks(admin: ReturnType<typeof createAdminClient>) {
  const { data, error } = await admin
    .from('operational_rail_config')
    .select('id,asset,network,label,config,active,updated_at')
    .eq('rail_type', 'fiat_deposit')
    .eq('active', true)
    .order('updated_at', { ascending: false })

  if (error) throw error

  const rail = (data ?? []).find((item) => {
    const asset = String(item.asset || '').toUpperCase()
    const label = String(item.label || '').toLowerCase()
    const config = item.config && typeof item.config === 'object' ? item.config as Record<string, unknown> : {}
    return asset === 'NGN' || label.includes('ngn') || String(config.currency || config.asset || '').toUpperCase() === 'NGN'
  }) ?? data?.[0]

  return configuredBanks(rail?.config && typeof rail.config === 'object' ? rail.config as Record<string, unknown> : null)
}

export async function GET() {
  const user = await requireUser()
  if (!user?.id) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

  const admin = createAdminClient()
  let banks: ReturnType<typeof configuredBanks>
  try {
    banks = await getConfiguredBanks(admin)
  } catch (error) {
    console.error('[v0] NGN deposit rail lookup failed', error)
    return NextResponse.json({ error: 'Deposit configuration could not be read from the operational backend.' }, { status: 503 })
  }
  const available = banks.filter((bank) => bank.accountNumber && bank.accountName)
  if (!available.length) return NextResponse.json({ error: 'Fiat funding account is not configured.' }, { status: 503 })

  return NextResponse.json({
    sessionId: randomUUID(),
    banks: available,
    ...available[0],
    expiryTime: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  }, { headers: { 'cache-control': 'no-store' } })
}

export async function POST(request: Request) {
  const user = await requireUser()
  if (!user?.id) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Enter a valid amount, sending bank and reference.' }, { status: 400 })

  const admin = createAdminClient()
  let banks: ReturnType<typeof configuredBanks>
  try {
    banks = await getConfiguredBanks(admin)
  } catch (error) {
    console.error('[v0] NGN deposit rail lookup failed during submit', error)
    return NextResponse.json({ error: 'Deposit configuration could not be read from the operational backend.' }, { status: 503 })
  }
  const selected = banks.find((bank) => bank.id === parsed.data.bankId) ?? banks[0]
  const bankName = String(selected?.bankName || '').trim()
  const accountNumber = String(selected?.accountNumber || '').trim()
  const accountName = String(selected?.accountName || '').trim()
  if (!bankName || !accountNumber || !accountName) return NextResponse.json({ error: 'Selected fiat funding account is not configured.' }, { status: 503 })

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
