import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ success: false, error: 'Authentication required.' }, { status: 401 })
  const body = await request.json().catch(() => null)
  const category = String(body?.category ?? '').trim(), provider = String(body?.provider ?? '').trim(), accountNumber = String(body?.accountNumber ?? '').trim()
  const amount = Number(body?.amount)
  if (!category || !provider || !accountNumber || !Number.isFinite(amount) || amount <= 0) return NextResponse.json({ success: false, error: 'Invalid bill request.' }, { status: 400 })
  const { data, error } = await supabase.from('bill_payment_requests').insert({ user_id: user.id, category, provider, account_number: accountNumber, package_id: body?.packageId || null, package_name: body?.packageName || null, amount, status: 'pending' }).select('id,status,created_at').single()
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, pending: true, request: data, message: 'Bill payment request sent to nexMonie operations for fulfilment.' })
}
