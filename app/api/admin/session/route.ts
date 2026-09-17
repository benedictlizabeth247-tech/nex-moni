import { NextRequest, NextResponse } from 'next/server'
import { getAdminContext } from '@/lib/admin'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/** Server-side confirmation that the current Supabase session is an active admin. */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body?.password === 'string' ? body.password : ''
  if (!email || !password) return NextResponse.json({ code: 'invalid_credentials' }, { status: 400 })

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error || !data.user || !data.session) {
    console.error('[v0] AUTH_FAILURE', { message: error?.message, status: error?.status, code: error?.code })
    return NextResponse.json({ code: error?.code || 'invalid_credentials' }, { status: 401 })
  }
  const context = await getAdminContext()
  if (!context) {
    console.error('[v0] ADMIN_RECORD_FAILURE', { userId: data.user.id })
    await supabase.auth.signOut()
    return NextResponse.json({ code: 'ADMIN_ACCESS_REQUIRED' }, { status: 403 })
  }
  return NextResponse.json({ authorized: true, userId: data.user.id }, { headers: { 'cache-control': 'no-store' } })
}

export async function GET() {
  const context = await getAdminContext()
  if (!context) return NextResponse.json({ authorized: false }, { status: 403 })
  return NextResponse.json({ authorized: true }, { headers: { 'cache-control': 'no-store' } })
}
