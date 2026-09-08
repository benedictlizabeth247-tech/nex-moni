import { NextResponse } from 'next/server'

import { logger } from '@/lib/logger'
import { getDetail, getProviderStatus } from '@/services/market-data/router'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/** `{ detail, providers }` — quote + profile + headlines + capabilities. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id') ?? ''
  if (!id) return NextResponse.json({ error: 'missing_id', detail: null }, { status: 400 })

  try {
    const detail = await getDetail(id)
    if (!detail) {
      return NextResponse.json({ error: 'unknown_asset', detail: null }, { status: 404 })
    }
    return NextResponse.json(
      { detail, providers: getProviderStatus() },
      { headers: { 'cache-control': 'no-store' } },
    )
  } catch (error) {
    logger.error('GET /api/market/detail failed', { reason: (error as Error).message })
    return NextResponse.json(
      { error: 'provider_unavailable', detail: null },
      { status: 502, headers: { 'cache-control': 'no-store' } },
    )
  }
}
