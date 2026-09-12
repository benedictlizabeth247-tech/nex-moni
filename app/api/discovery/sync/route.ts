import { NextResponse } from 'next/server'
import { syncOpportunitySources } from '@/services/opportunityIngestion'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const expected = process.env.DISCOVERY_SYNC_SECRET
  if (expected && request.headers.get('authorization') !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json(await syncOpportunitySources())
}
