import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const schema = z.object({
  amount: z.number().finite().positive(),
  portfolioId: z.string().uuid(),
  idempotencyKey: z.string().trim().min(16).max(128).optional(),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Enter a valid allocation amount and portfolio.' }, { status: 400 })
  const idempotencyKey = parsed.data.idempotencyKey || `copy-${user.id}-${parsed.data.portfolioId}-${crypto.randomUUID()}`
  const { data, error } = await supabase.rpc('create_copy_trade_allocation', {
    p_portfolio_id: parsed.data.portfolioId,
    p_amount: parsed.data.amount,
    p_idempotency_key: idempotencyKey,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 422 })
  return NextResponse.json({ data })
}
