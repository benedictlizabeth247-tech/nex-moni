import 'server-only'

import { createClient } from '@supabase/supabase-js'
import { expireStaleOpportunities, getSourceHealth, syncGigWorks } from './opportunityIngestion'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!)

export type DiscoveryCategory = 'Job' | 'Bounty' | 'Hackathon' | 'Grant' | 'Quest' | 'Project' | 'Task' | 'Open Source'

export interface DiscoveryOpportunity {
  id: string
  title: string
  organizationName: string
  source: string
  sourceUrl: string
  category: DiscoveryCategory
  shortDescription: string
  description: string
  imageUrl?: string
  creatorAvatarUrl?: string
  rewardLabel?: string
  deadline?: string
  tags: string[]
  isFeatured: boolean
  ecosystem?: string
  chain?: string
  location?: string
  remote?: boolean
  applicationUrl?: string
  lastSyncedAt?: string
}

function label(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function rewardText(row: Record<string, unknown>) {
  const explicit = label(row.reward_text)
  if (explicit) return explicit
  const amount = row.reward_amount
  const currency = label(row.reward_currency)
  if (amount !== null && amount !== undefined) return `${Number(amount).toLocaleString()}${currency ? ` ${currency}` : ''}`
  return undefined
}

function mapOpportunity(row: Record<string, unknown>): DiscoveryOpportunity {
  const description = label(row.description) || ''
  const category = (label(row.category) || label(row.type) || 'Project') as DiscoveryCategory
  return {
    id: String(row.id),
    title: String(row.title),
    organizationName: label(row.organization_name) || 'Verified Web3 organization',
    source: String(row.source),
    sourceUrl: String(row.source_url),
    category,
    shortDescription: description.slice(0, 180),
    description,
    imageUrl: label(row.organization_logo),
    creatorAvatarUrl: label(row.organization_logo),
    rewardLabel: rewardText(row),
    deadline: label(row.deadline),
    tags: Array.isArray(row.skills) ? row.skills.filter((tag): tag is string => typeof tag === 'string') : [],
    isFeatured: row.is_featured === true,
    ecosystem: label(row.ecosystem),
    chain: label(row.chain),
    location: label(row.location),
    remote: row.remote === true,
    applicationUrl: label(row.application_url),
    lastSyncedAt: label(row.last_synced_at),
  }
}

export async function getDiscoveryOpportunities(options: { page?: number; limit?: number; search?: string; category?: string; ecosystem?: string } = {}) {
  const page = Math.max(1, options.page || 1)
  const limit = Math.min(50, Math.max(1, options.limit || 24))
  const from = (page - 1) * limit
  const to = from + limit - 1
  const supabase = db

  await expireStaleOpportunities()
  const { count: liveCount } = await supabase.from('opportunities').select('id', { count: 'exact', head: true }).eq('status', 'LIVE').eq('is_verified', true).or(`deadline.is.null,deadline.gt.${new Date().toISOString()}`)
  const health = await getSourceHealth()
  const latestSync = health.reduce<string | null>((latest, row) => row.last_successful_sync && (!latest || row.last_successful_sync > latest) ? row.last_successful_sync : latest, null)
  const stale = !latestSync || Date.now() - Date.parse(latestSync) > 15 * 60 * 1000
  let sync: Awaited<ReturnType<typeof syncGigWorks>> | null = null
  if (stale || (liveCount || 0) === 0) sync = await syncGigWorks()

  let query = supabase
    .from('opportunities')
    .select('id,title,organization_name,source,source_url,type,description,organization_logo,reward_amount,reward_currency,reward_text,category,skills,ecosystem,chain,location,remote,deadline,application_url,is_featured,last_synced_at', { count: 'exact' })
    .eq('status', 'LIVE')
    .eq('is_verified', true)
    .or(`deadline.is.null,deadline.gt.${new Date().toISOString()}`)
    .order('is_featured', { ascending: false })
    .order('deadline', { ascending: true, nullsFirst: false })
    .range(from, to)

  if (options.search?.trim()) query = query.ilike('title', `%${options.search.trim()}%`)
  if (options.category && options.category !== 'All') query = query.ilike('category', options.category)
  if (options.ecosystem && options.ecosystem !== 'All') query = query.ilike('ecosystem', options.ecosystem)

  const { data, error, count } = await query
  if (error) throw error
  const opportunities = (data || []).map((row) => mapOpportunity(row as Record<string, unknown>))
  const refreshedHealth = sync ? await getSourceHealth() : health
  const providers = Object.fromEntries(refreshedHealth.map((row) => [row.source, row.status === 'CONNECTED']))
  const syncErrors = refreshedHealth.filter((row) => row.status === 'ERROR').map((row) => ({ source: row.source, message: row.error_message }))
  return { opportunities, providers, sourceHealth: refreshedHealth, syncErrors, syncRan: Boolean(sync), hasMore: from + opportunities.length < (count || 0), total: count || 0 }
}
