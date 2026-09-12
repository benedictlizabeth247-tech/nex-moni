import 'server-only'

import { createClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'

const sources = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!)
const timeoutMs = 12_000

type NormalizedOpportunity = {
  source: string; source_id: string; source_url: string; type: string; title: string
  description: string | null; organization_name: string | null; organization_logo: string | null
  reward_amount: number | null; reward_currency: string | null; reward_text: string | null
  category: string; skills: string[]; ecosystem: string | null; chain: string | null
  location: string | null; remote: boolean | null; published_at: string | null; deadline: string | null
  status: string; application_url: string | null; submission_url: string | null; is_verified: boolean
  metadata: Record<string, unknown>; content_hash: string
}

async function json(url: string) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json', 'User-Agent': 'APEDAT-opportunity-sync/1.0' }, cache: 'no-store' })
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
    return await response.json()
  } finally { clearTimeout(timer) }
}

function text(value: unknown) { return typeof value === 'string' && value.trim() ? value.trim() : null }
function date(value: unknown) { const valueText = text(value); if (!valueText || Number.isNaN(Date.parse(valueText))) return null; return new Date(valueText).toISOString() }
function hash(row: Record<string, unknown>) { return createHash('sha256').update(JSON.stringify(row)).digest('hex') }

async function discoverSuperteam(): Promise<NormalizedOpportunity[]> {
  const endpoint = process.env.SUPERTEAM_EARN_LISTINGS_URL || 'https://earn.superteam.fun/api/listings/?take=400&skip=0'
  const payload = await json(endpoint)
  const rows = Array.isArray(payload) ? payload : Array.isArray(payload?.listings) ? payload.listings : Array.isArray(payload?.data) ? payload.data : []
  return rows.flatMap((row: Record<string, unknown>) => {
    const status = String(row.status || 'OPEN').toUpperCase()
    if (['CLOSED', 'EXPIRED', 'ARCHIVED', 'CANCELLED', 'FILLED'].includes(status)) return []
    const id = text(row.id) || text(row.slug) || text(row.title)
    const title = text(row.title)
    if (!id || !title) return []
    const sourceUrl = text(row.slug) ? `https://earn.superteam.fun/listing/${row.slug}/` : 'https://earn.superteam.fun/'
    const sponsor = row.sponsor as Record<string, unknown> | undefined
    const reward = row.rewardAmount ?? row.maxRewardAsk ?? row.minRewardAsk
    const currency = text(row.token)
    const normalized = { source: 'superteam_earn', source_id: id, source_url: sourceUrl, type: text(row.type) || 'Bounty', title, description: text(row.description), organization_name: text(sponsor?.name) || 'Superteam ecosystem', organization_logo: text(sponsor?.logo), reward_amount: typeof reward === 'number' ? reward : Number.isFinite(Number(reward)) ? Number(reward) : null, reward_currency: currency, reward_text: text(row.rewardText), category: text(row.type) || 'Bounty', skills: Array.isArray(row.skills) ? row.skills.filter((skill): skill is string => typeof skill === 'string') : [], ecosystem: text(row.ecosystem), chain: text(row.chain), location: text(row.location), remote: row.remote === true, published_at: date(row.createdAt || row.publishedAt), deadline: date(row.deadline), status: 'LIVE', application_url: text(row.applicationUrl) || sourceUrl, submission_url: text(row.submissionUrl), is_verified: true, metadata: { providerStatus: status }, content_hash: hash(row) }
    return [normalized]
  })
}

export async function syncOpportunitySources() {
  const startedAt = new Date().toISOString()
  const results: Record<string, { ok: boolean; count: number; error?: string }> = {}
  try {
    const rows = await discoverSuperteam()
    const { error } = await sources.from('opportunities').upsert(rows, { onConflict: 'source,source_id', ignoreDuplicates: false })
    if (error) throw error
    await sources.from('opportunity_sources').upsert({ source: 'superteam_earn', name: 'Superteam Earn', enabled: true, api_status: 'healthy', last_success_at: startedAt, last_sync_at: startedAt, records_seen: rows.length, records_updated: rows.length, error_message: null }, { onConflict: 'source' })
    results.superteam_earn = { ok: true, count: rows.length }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown source error'
    await sources.from('opportunity_sources').upsert({ source: 'superteam_earn', name: 'Superteam Earn', enabled: true, api_status: 'error', last_failure_at: startedAt, last_sync_at: startedAt, error_message: message }, { onConflict: 'source' })
    results.superteam_earn = { ok: false, count: 0, error: message }
  }
  return { startedAt, results }
}
