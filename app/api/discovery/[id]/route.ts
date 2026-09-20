import { NextResponse } from 'next/server'
import { getDiscoveryOpportunity } from '@/services/discovery'

export const dynamic = 'force-dynamic'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const opportunity = await getDiscoveryOpportunity(id)
  return opportunity ? NextResponse.json({ opportunity }) : NextResponse.json({ error: 'Opportunity not found' }, { status: 404 })
}
