import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { search } from '@/services/market-data/router'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = (searchParams.get('q') ?? '').trim()
  const limit = Math.min(Number(searchParams.get('limit') ?? 12) || 12, 30)

  if (!query) return NextResponse.json({ results: [] }, { headers: { 'cache-control': 'no-store' } })

  try {
    const results = await search(query, limit)
    return NextResponse.json({ results }, { headers: { 'cache-control': 'no-store' } })
  } catch (error) {
    logger.error('GET /api/market/search failed', { reason: (error as Error).message })
    return NextResponse.json({ results: [] }, { status: 200 })
  }
}
