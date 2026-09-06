import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const client = await createClient()
  const { data: auth } = await client.auth.getUser()
  if (!auth.user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const { data, error } = await client.from('autopilot_allocations').select('id,profile_name,amount,reserved_amount,funding_source,status,created_at,updated_at').eq('user_id', auth.user.id).order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data: data ?? [] }, { headers: { 'cache-control': 'no-store' } })
}

export async function POST(request: Request) {
  const client = await createClient()
  const { data: auth } = await client.auth.getUser()
  if (!auth.user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const body = await request.json()
  const amount = Number(body?.amount)
  if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: 'Enter a valid amount.' }, { status: 400 })
  const { data, error } = await client.rpc('create_autopilot_allocation', { p_profile_name: String(body?.profileName ?? '').slice(0, 120), p_amount: amount, p_funding_source: body?.fundingSource === 'demo' ? 'demo' : 'live' })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data })
}

export async function PATCH(request: Request) {
  const client = await createClient()
  const { data: auth } = await client.auth.getUser()
  if (!auth.user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const body = await request.json()
  const { data, error } = await client.rpc('set_autopilot_allocation_status', { p_allocation_id: body?.id, p_status: body?.status })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data })
}
