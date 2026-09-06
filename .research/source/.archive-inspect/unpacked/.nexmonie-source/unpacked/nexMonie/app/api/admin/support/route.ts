import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/admin'
import { z } from 'zod'

const schema = z.object({ action: z.enum(['reply','close']), ticketId: z.string().uuid(), body: z.string().trim().max(2000).optional() })

export async function GET() {
  try {
    const ctx = await requireAdmin()
    const admin = createAdminClient()
    const { data: tickets, error } = await admin.from('support_tickets').select('*').order('updated_at', { ascending: false }).limit(200)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ tickets: tickets ?? [], actorId: ctx.user.id })
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'Access denied.' }, { status: 403 }) }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireAdmin()
    const parsed = schema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: 'Invalid support operation.' }, { status: 400 })
    const admin = createAdminClient()
    if (parsed.data.action === 'reply') {
      if (!parsed.data.body) return NextResponse.json({ error: 'Message is required.' }, { status: 400 })
      const { data, error } = await admin.rpc('support_staff_reply', { p_ticket_id: parsed.data.ticketId, p_body: parsed.data.body, p_actor_user_id: ctx.user.id })
      if (error) return NextResponse.json({ error: error.message }, { status: 422 })
      return NextResponse.json(data)
    }
    const { data, error } = await admin.rpc('support_close_ticket', { p_ticket_id: parsed.data.ticketId, p_actor_user_id: ctx.user.id })
    if (error) return NextResponse.json({ error: error.message }, { status: 422 })
    return NextResponse.json(data)
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'Support operation failed.' }, { status: 422 }) }
}
