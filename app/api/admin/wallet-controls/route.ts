import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/admin'
import { db } from '@/lib/db'
import { wallets, auditLog } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'

const schema = z.object({ userId: z.string().trim().min(1).max(128), currency: z.string().trim().min(3).max(10).transform((value) => value.toUpperCase()), action: z.enum(['freeze','unfreeze','restrict_withdrawals','allow_withdrawals','restrict_trading','allow_trading','reconcile']), reason: z.string().trim().max(500).optional().nullable() })
export async function POST(request: Request) {
  let context: Awaited<ReturnType<typeof requireAdmin>>
  try {
    context = await requireAdmin()
  } catch {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })
  }
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid wallet control request.' }, { status: 400 })
  const now = new Date()
  try {
    const [existing] = await db.select().from(wallets).where(and(eq(wallets.userId, parsed.data.userId), eq(wallets.currency, parsed.data.currency))).limit(1)
    const wallet = existing ?? (await db.insert(wallets).values({ id: randomUUID(), userId: parsed.data.userId, currency: parsed.data.currency, updatedAt: now }).returning())[0]
    if (!wallet) return NextResponse.json({ error: 'Wallet could not be initialized.' }, { status: 422 })
    if (parsed.data.action === 'freeze' || parsed.data.action === 'unfreeze') {
      const [updated] = await db.update(wallets).set({ isFrozen: parsed.data.action === 'freeze', updatedAt: now }).where(eq(wallets.id, wallet.id)).returning()
      await db.insert(auditLog).values({ id: randomUUID(), actorUserId: context.user.id, action: parsed.data.action === 'freeze' ? 'WALLET_FROZEN' : 'WALLET_UNFROZEN', resourceType: 'wallet', resourceId: wallet.id, metadata: { userId: parsed.data.userId, currency: parsed.data.currency, reason: parsed.data.reason ?? null } })
      return NextResponse.json({ ...updated, status: parsed.data.action })
    }
    await db.insert(auditLog).values({ id: randomUUID(), actorUserId: context.user.id, action: `WALLET_${parsed.data.action.toUpperCase()}`, resourceType: 'wallet', resourceId: wallet.id, metadata: { userId: parsed.data.userId, currency: parsed.data.currency, reason: parsed.data.reason ?? null } })
    return NextResponse.json({ ...wallet, status: parsed.data.action })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Wallet control failed.' }, { status: 422 })
  }
}
