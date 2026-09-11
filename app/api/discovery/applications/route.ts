import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const statuses = new Set(['VIEWED','STARTED','REDIRECTED','SUBMITTED','CONFIRMED','WITHDRAWN','UNKNOWN'])

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const opportunityId = typeof body?.opportunityId === 'string' ? body.opportunityId : ''
  const status = typeof body?.status === 'string' && statuses.has(body.status) ? body.status : 'STARTED'
  const applicationUrl = typeof body?.applicationUrl === 'string' ? body.applicationUrl : null
  if (!opportunityId) return NextResponse.json({ error: 'Opportunity is required' }, { status: 400 })

  const { data: opportunity } = await supabase.from('opportunities').select('id,source,application_url,source_url').eq('id', opportunityId).eq('status', 'LIVE').maybeSingle()
  if (!opportunity) return NextResponse.json({ error: 'Opportunity is no longer live' }, { status: 404 })

  const { data, error } = await supabase.from('opportunity_applications').upsert({
    user_id: user.id,
    opportunity_id: opportunity.id,
    source: opportunity.source,
    status,
    application_url: applicationUrl || opportunity.application_url || opportunity.source_url,
    started_at: new Date().toISOString(),
    submitted_at: status === 'SUBMITTED' || status === 'CONFIRMED' ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,opportunity_id' }).select('id,status,application_url,started_at,submitted_at').single()

  if (error) return NextResponse.json({ error: 'Unable to track application' }, { status: 500 })
  return NextResponse.json({ application: data })
}
