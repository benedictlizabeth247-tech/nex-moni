import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { custody } from '@/services/custody/index'

export async function POST(request: Request) {
  const client = await createClient()
  const { data: auth } = await client.auth.getUser()
  if (!auth.user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const body = await request.json()
  const amount = Number(body.amount)
  if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
  try {
    const result = await custody.createWithdrawal({ userId: auth.user.id, asset: String(body.asset), network: String(body.network), address: String(body.address), amount, tag: body.tag ? String(body.tag) : undefined })
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Custody rail unavailable' }, { status: 503 })
  }
}
