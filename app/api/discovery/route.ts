import { NextResponse } from 'next/server'
import { getDiscoveryOpportunities } from '@/services/discovery'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const page = Math.max(1, Number(searchParams.get('page') || '1'))
  const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit') || '24')))

  try {
    const supabase = await createClient()
    const from = (page - 1) * limit
    const to = from + limit - 1
    const { data: rows, error: databaseError } = await supabase
      .from('opportunities')
      .select('id,source,source_id,source_url,type,title,description,organization_name,organization_logo,reward_text,category,skills,ecosystem,chain,location,remote,deadline,application_url,is_verified,is_featured')
      .eq('status', 'LIVE')
      .or(`deadline.is.null,deadline.gt.${new Date().toISOString()}`)
      .order('is_featured', { ascending: false })
      .order('deadline', { ascending: true, nullsFirst: false })
      .range(from, to)

    if (!databaseError && rows) {
      return NextResponse.json({
        opportunities: rows.map((row) => ({
          id: row.id,
          title: row.title,
          organizationName: row.organization_name || 'Independent organization',
          source: row.source,
          sourceUrl: row.source_url,
          applicationUrl: row.application_url || row.source_url,
          category: row.category || row.type,
          shortDescription: row.description?.slice(0, 180) || `${row.type} from ${row.source}`,
          description: row.description || '',
          imageUrl: row.organization_logo || undefined,
          rewardLabel: row.reward_text || undefined,
          deadline: row.deadline ? new Date(row.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : undefined,
          tags: [row.ecosystem, row.chain, ...(row.skills || [])].filter(Boolean),
          isFeatured: Boolean(row.is_featured),
          isVerified: Boolean(row.is_verified),
        })),
        providers: { apedat: true }, page, limit,
        hasMore: rows.length === limit, available: true,
        generatedAt: new Date().toISOString(),
      }, { headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=300' } })
    }

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
