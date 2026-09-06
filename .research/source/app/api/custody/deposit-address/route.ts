import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { custody } from '@/services/custody/index'

export async function POST(request: Request) {
  const client = await createClient()
  const { data: auth } = await client.auth.getUser()
  if (!auth.user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const body = await request.json()
  try {
    const address = await custody.getDepositAddress(auth.user.id, String(body.asset), String(body.network))
    return NextResponse.json(address)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Custody rail unavailable' }, { status: 503 })
  }
}
