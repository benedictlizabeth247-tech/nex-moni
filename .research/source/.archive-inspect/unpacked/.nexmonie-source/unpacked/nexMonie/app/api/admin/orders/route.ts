import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminContext } from '@/lib/admin'

export async function GET() {
  const client = await createServerClient()
  const adminContext = await getAdminContext()
  if (!adminContext) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })
  const admin = createAdminClient()
  const { data, error } = await admin.from('orders').select('id,user_id,market,side,order_type,quantity,requested_price,filled_quantity,leverage,margin_mode,status,demo,execution_venue,admin_note,created_at,reviewed_at').in('status', ['pending_admin','open','partially_filled','filled','rejected','cancelled']).order('created_at', { ascending: false }).limit(100)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [] }, { headers: { 'cache-control': 'no-store' } })
}

export async function PATCH(request: Request) {
  const client = await createServerClient()
  const { data: { user } } = await client.auth.getUser()
  const adminContext = await getAdminContext()
  if (!adminContext) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })
  const body = await request.json()
  const status = String(body?.status ?? '')
  const allowed = ['open','filled','partially_filled','rejected','cancelled']
  if (!allowed.includes(status)) return NextResponse.json({ error: 'Invalid order status.' }, { status: 400 })
  const admin = createAdminClient()
  const { data, error } = await admin.rpc('admin_settle_order', { p_order_id: body?.id, p_status: status, p_filled_quantity: body?.filled_quantity ?? null, p_admin_note: String(body?.admin_note ?? '') })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data })
}

export const dynamic = 'force-dynamic'
