import { NextResponse } from 'next/server'
import { syncOpportunitySources } from '@/services/opportunityIngestion'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET || process.env.DISCOVERY_SYNC_SECRET
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try { return NextResponse.json(await syncOpportunitySources()) }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Sync failed' }, { status: 502 }) }
}
