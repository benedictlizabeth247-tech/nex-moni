import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { logger } from '@/lib/logger'
import { getTrades } from '@/services/market-data/router'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  try {
    const feed = await getTrades(id)
    if (!feed) return NextResponse.json({ trades: [], supported: false })
    return NextResponse.json({ ...feed, supported: true })
  } catch (error) {
    logger.error('GET /api/market/trades failed', { reason: (error as Error).message })
    return NextResponse.json({ trades: [], supported: false })
  }
}
