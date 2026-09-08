import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const schema = z.object({
  recipient: z.string().trim().min(1).max(200),
  amount: z.number().positive().finite(),
  currency: z.string().trim().min(1).max(10),
  idempotencyKey: z.string().trim().min(8).max(120),
})

export async function POST(request: Request) {
  const client = await createClient()
  const { data: { user } } = await client.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid internal transfer.' }, { status: 400 })
  const { data, error } = await client.rpc('create_internal_transfer', {
    p_recipient: parsed.data.recipient,
    p_amount: parsed.data.amount,
    p_currency: parsed.data.currency,
    p_idempotency_key: parsed.data.idempotencyKey,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 422 })
  return NextResponse.json(data)
}
