import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/**
 * Checks the server-side admin registry before the browser asks Supabase to
 * send a password-recovery email. The registry, not an email allowlist in the
 * client, is authoritative.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const email = String(body?.email ?? '').trim().toLowerCase()
    if (!email || !email.includes('@')) return NextResponse.json({ authorized: false })

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('admin_staff')
      .select('user_id')
      .eq('email', email)
      .eq('active', true)
      .maybeSingle()

    if (error) return NextResponse.json({ authorized: false }, { status: 200 })
    return NextResponse.json({ authorized: Boolean(data?.user_id) })
  } catch {
    return NextResponse.json({ authorized: false }, { status: 200 })
  }
}
