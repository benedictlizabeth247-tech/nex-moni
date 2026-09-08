import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  const body = await request.json()
  const { phoneNumber, network, planId, amount, planTitle } = body
  if (!phoneNumber || !network || !planId || !amount) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  const { data, error } = await supabase.from('data_purchase_requests').insert({
    user_id: user.id, phone_number: phoneNumber, network, plan_id: planId,
    plan_title: planTitle || planId, amount: Number(amount), status: 'pending'
  }).select('id, created_at').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, pending: true, requestId: data.id, createdAt: data.created_at, message: 'Purchase request sent to operations for fulfillment.' })
}
