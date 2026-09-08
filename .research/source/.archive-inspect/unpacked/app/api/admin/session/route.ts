import { NextResponse } from 'next/server'
import { getAdminContext } from '@/lib/admin'

export const dynamic = 'force-dynamic'

/** Server-side confirmation that the current Supabase session is an active admin. */
export async function GET() {
  const context = await getAdminContext()
  if (!context) return NextResponse.json({ authorized: false }, { status: 403 })
  return NextResponse.json({ authorized: true }, { headers: { 'cache-control': 'no-store' } })
}
