import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient as createServerClient } from '@/lib/supabase/server'

const schema = z.object({
  amount: z.number().finite().positive(),
  currency: z.string().trim().min(3).max(10),
  destinationType: z.enum(['bank', 'nex', 'card_refund', 'mobile_money', 'crypto']),
  destination: z.string().trim().min(1).max(255),
  network: z.string().trim().max(64).nullable().optional(),
  autopilot: z.boolean().optional().default(false),
  idempotencyKey: z.string().trim().min(16).max(128),
})

export async function POST(request: Request) {
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user?.id) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid withdrawal request.', details: parsed.error.flatten() }, { status: 400 })
  }

  if (parsed.data.destinationType === 'crypto' && !parsed.data.network) {
    return NextResponse.json({ error: 'Crypto network is required.' }, { status: 400 })
  }

  const { data, error } = await supabase.rpc('create_withdrawal_request', {
    p_amount: parsed.data.amount,
    p_currency: parsed.data.currency.toUpperCase(),
    p_destination_type: parsed.data.destinationType,
    p_destination: parsed.data.destination,
    p_network: parsed.data.network || null,
    p_autopilot: parsed.data.autopilot,
    p_idempotency_key: parsed.data.idempotencyKey,
  })

  if (error) {
    const message = error.message || 'Unable to create withdrawal request.'
    const status = /insufficient available|wallet is not available/i.test(message) ? 422 : 400
    return NextResponse.json({ error: message }, { status })
  }

  if (data?.status === 'created' && parsed.data.autopilot && data?.request_id) {
    const { data: routed, error: routeError } = await supabase.rpc('route_autopilot_withdrawal', { p_withdrawal_id: data.request_id })
    if (routeError) {
      // The financial reservation remains safe and pending; autopilot never makes
      // a failed routing attempt look like a failed withdrawal.
      return NextResponse.json({ ...data, autopilot_routing: 'pending', autopilot_error: routeError.message }, { status: 201 })
    }
    return NextResponse.json({ ...data, ...routed, autopilot_routing: 'processing' }, { status: 201 })
  }

  return NextResponse.json(data, { status: data?.status === 'already_created' ? 200 : 201 })
}
