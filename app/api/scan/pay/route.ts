import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ success: false, error: 'Authentication required.' }, { status: 401 })
  const body = await request.json().catch(() => null)
  const merchantId = String(body?.merchantId ?? '').trim(), merchantName = String(body?.merchantName ?? '').trim(), currency = String(body?.currency ?? 'NGN').trim()
  const amount = Number(body?.amount)
  if (!merchantId || !merchantName || !Number.isFinite(amount) || amount <= 0) return NextResponse.json({ success: false, error: 'Invalid merchant payment request.' }, { status: 400 })
  const { data, error } = await supabase.from('scan_payment_requests').insert({ user_id: user.id, merchant_id: merchantId, merchant_name: merchantName, amount, currency, status: 'pending' }).select('id,status,created_at').single()
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, pending: true, request: data, message: 'Merchant payment request sent to nexMonie operations for fulfilment.' })
}
