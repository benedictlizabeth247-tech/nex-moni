import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/admin'
import { db } from '@/lib/db'
import { deposits as neonDeposits } from '@/lib/db/schema'

export async function POST(request: Request) {
  try {
    await requireAdmin()
  } catch {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })
  }

  const body = await request.json().catch(() => null) as { confirm?: string } | null
  if (body?.confirm !== 'SYNC_DEPOSITS') {
    return NextResponse.json({ error: 'Explicit sync confirmation required.' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: rows, error } = await admin
    .from('deposits')
    .select('id,user_id,bank_name,account_number,account_name,amount,sender_bank,reference,screenshot_url,status,expiry_time,created_at')
    .order('created_at', { ascending: true })
    .limit(5000)

  if (error) return NextResponse.json({ error: 'Existing deposit records could not be read.' }, { status: 422 })

  let synced = 0
  for (const row of rows ?? []) {
    const result = await db.insert(neonDeposits).values({
      id: String(row.id),
      userId: String(row.user_id),
      amount: String(row.amount),
      currency: 'NGN',
      method: 'bank_transfer',
      senderBank: String(row.sender_bank ?? row.bank_name ?? 'Unknown bank'),
      senderAccountName: String(row.account_name ?? 'Not supplied'),
      senderAccountNumber: String(row.account_number ?? '0000000000'),
      receivingBank: String(row.bank_name ?? 'Configured receiving account'),
      receivingAccountNumber: 'Not available',
      receivingAccountName: 'Not available',
      reference: String(row.reference),
      status: String(row.status ?? 'PENDING').toUpperCase(),
      screenshotUrl: row.screenshot_url ?? null,
      expiryTime: row.expiry_time ? new Date(row.expiry_time) : null,
      createdAt: row.created_at ? new Date(row.created_at) : undefined,
      updatedAt: new Date(),
    }).onConflictDoNothing({ target: neonDeposits.id })
    if (result.rowCount) synced += result.rowCount
  }

  return NextResponse.json({ success: true, scanned: rows?.length ?? 0, synced })
}
