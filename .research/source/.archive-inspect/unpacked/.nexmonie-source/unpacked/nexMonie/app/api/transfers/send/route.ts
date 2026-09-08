import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Operational request rail for sends. It records an authenticated user's
 * transfer intent; it never fabricates an external bank/blockchain execution.
 * Actual settlement is performed by the configured operational/admin rail.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ success: false, error: 'Authentication required.' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const amount = Number(body?.amount)
  const kind = body?.kind
  const destination = String(body?.destination ?? '').trim()
  const currency = String(body?.currency ?? '').trim()
  const network = body?.network ? String(body.network) : null

  if (!['nex', 'fiat', 'crypto'].includes(kind) || !Number.isFinite(amount) || amount <= 0 || !destination || !currency) {
    return NextResponse.json({ success: false, error: 'Invalid send request.' }, { status: 400 })
  }

  const { data, error } = await supabase.from('send_requests').insert({
    user_id: user.id,
    kind,
    amount,
    currency,
    destination,
    network,
    status: 'pending',
  }).select('id,status,created_at').single()

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, request: data })
}
