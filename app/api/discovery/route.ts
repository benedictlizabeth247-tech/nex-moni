import { NextResponse } from 'next/server'
import { getDiscoveryOpportunities } from '@/services/discovery'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const page = Math.max(1, Number(searchParams.get('page') || '1'))
  const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit') || '24')))
  try {
    const result = await getDiscoveryOpportunities({
      page,
      limit,
      search: searchParams.get('search') || undefined,
      category: searchParams.get('category') || undefined,
      ecosystem: searchParams.get('ecosystem') || undefined,
      source: searchParams.get('source') || undefined,
      remote: searchParams.get('remote') === 'true',
      reward: searchParams.get('reward') === 'true',
      skill: searchParams.get('skill') || undefined,
    })
    const available = Object.values(result.providers).some(Boolean) || result.opportunities.length > 0
    return NextResponse.json({ ...result, page, limit, available, generatedAt: new Date().toISOString() }, { headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=600' } })
  } catch (error) {
    console.error('[discovery] read failed', error)
    return NextResponse.json({ opportunities: [], providers: {}, sourceHealth: [], page, limit, hasMore: false, available: false, total: 0 }, { status: 503 })
  }
}
