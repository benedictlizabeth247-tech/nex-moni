import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ success: false, error: 'Authentication required.' }, { status: 401 })
  const body = await request.json().catch(() => null)
  const accountNumber = String(body?.accountNumber ?? '').replace(/\D/g, '')
  if (accountNumber.length < 8) return NextResponse.json({ success: false, error: 'Enter a valid account or meter number.' }, { status: 400 })
  return NextResponse.json({ success: true, verified: false, customerName: null, message: 'Number format accepted. Provider identity will be verified by operations before fulfilment.' })
}
