import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ success: false, error: 'Authentication required.' }, { status: 401 })
  const { qrData } = await request.json().catch(() => ({}))
  const raw = String(qrData ?? '').trim()
  if (!raw) return NextResponse.json({ success: false, error: 'QR data is required.' }, { status: 400 })
  try {
    const parsed = raw.startsWith('{') ? JSON.parse(raw) : null
    const merchantId = parsed?.merchantId || parsed?.merchant_id
    const merchantName = parsed?.merchantName || parsed?.merchant_name
    const amount = parsed?.amount == null ? null : Number(parsed.amount)
    const currency = parsed?.currency || 'NGN'
    if (!merchantId || !merchantName) throw new Error('Unsupported QR payload')
    return NextResponse.json({ success: true, merchantId: String(merchantId), merchantName: String(merchantName), amount: Number.isFinite(amount) ? amount : null, currency })
  } catch {
    return NextResponse.json({ success: false, error: 'Unsupported QR payload. Use a nexMonie-compatible merchant QR.' }, { status: 400 })
  }
}
