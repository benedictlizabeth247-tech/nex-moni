import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ success: false, error: 'Authentication required.' }, { status: 401 })
  const body = await request.json().catch(() => null)
  const phoneNumber = String(body?.phoneNumber ?? '').replace(/\D/g, '')
  const network = String(body?.network ?? '').trim()
  const amount = Number(body?.amount)
  if (phoneNumber.length < 10 || !network || !Number.isFinite(amount) || amount <= 0) return NextResponse.json({ success: false, error: 'Invalid airtime request.' }, { status: 400 })
  const { data, error } = await supabase.from('airtime_purchase_requests').insert({ user_id: user.id, phone_number: phoneNumber, network, amount, status: 'pending' }).select('id,status,created_at').single()
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, pending: true, request: data, message: 'Airtime request sent to nexMonie operations for fulfilment.' })
}
