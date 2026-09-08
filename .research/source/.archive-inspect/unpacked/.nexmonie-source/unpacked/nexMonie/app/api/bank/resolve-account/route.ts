import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const schema = z.object({
  accountNumber: z.string().regex(/^\d{10}$/, 'A Nigerian account number must contain 10 digits.'),
  bankCode: z.string().trim().min(2).max(10),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) return NextResponse.json({ success: false, error: 'Not authenticated.' }, { status: 401 })

  const secret = process.env.PAYSTACK_SECRET_KEY
  if (!secret) return NextResponse.json({ success: false, error: 'Bank verification is not configured.' }, { status: 503 })

  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Valid bank code and 10-digit account number are required.' }, { status: 400 })

  const params = new URLSearchParams({ account_number: parsed.data.accountNumber, bank_code: parsed.data.bankCode })
  const response = await fetch(`https://api.paystack.co/bank/resolve?${params.toString()}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${secret}` },
    cache: 'no-store',
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok || !payload?.status || !payload?.data?.account_name) {
    return NextResponse.json({ success: false, error: payload?.message || 'Unable to resolve this bank account.' }, { status: 422 })
  }

  return NextResponse.json({
    success: true,
    accountNumber: payload.data.account_number,
    accountName: payload.data.account_name,
    bankCode: parsed.data.bankCode,
  })
}
