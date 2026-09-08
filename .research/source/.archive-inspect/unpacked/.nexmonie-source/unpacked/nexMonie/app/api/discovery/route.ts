import { NextResponse } from 'next/server'
import { getDiscoveryOpportunities } from '@/services/discovery'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const page = Math.max(1, Number(searchParams.get('page') || '1'))
  const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit') || '24')))

  try {
    const result = await getDiscoveryOpportunities(page, limit)
    const anyProviderUp = Object.values(result.providers).some(Boolean)
    return NextResponse.json(
      {
        opportunities: result.opportunities,
        providers: result.providers,
        page,
        limit,
        hasMore: result.hasMore,
        available: anyProviderUp,
        generatedAt: new Date().toISOString(),
      },
      { headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=600' } },
    )
  } catch {
    return NextResponse.json(
      { opportunities: [], providers: {}, page, limit, hasMore: false, available: false },
      { status: 502 },
    )
  }
}
