import 'server-only'

import { createClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'

function getSources() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Opportunity sync data source is not configured.')
  return createClient(url, key)
}

const timeoutMs = 12_000
const pageSize = 100
const maxPages = 100
const staleAfterMinutes = Number(process.env.OPPORTUNITY_STALE_MINUTES || 45)

type NormalizedOpportunity = {
  source: string; source_id: string; source_url: string; type: string; title: string
  description: string | null; organization_name: string | null; organization_logo: string | null
  reward_amount: number | null; reward_currency: string | null; reward_text: string | null
  category: string; skills: string[]; ecosystem: string | null; chain: string | null
  location: string | null; remote: boolean | null; published_at: string | null; deadline: string | null
  status: string; application_url: string | null; submission_url: string | null; is_verified: boolean
  metadata: Record<string, unknown>; content_hash: string; is_active: boolean; is_expired: boolean
  last_seen_at: string; last_synced_at: string
}

async function json(url: string, init?: RequestInit) {
  let lastError: unknown
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetch(url, { ...init, signal: controller.signal, headers: { Accept: 'application/json', 'User-Agent': 'nexMonie-opportunity-sync/1.0', ...(init?.headers || {}) }, cache: 'no-store' })
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
      const payload = await response.json()
      if (!payload || typeof payload !== 'object') throw new Error('Malformed JSON response')
      return payload
    } catch (error) {
      lastError = error
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt))
    } finally { clearTimeout(timer) }
  }
  throw lastError instanceof Error ? lastError : new Error('Source request failed')
}

function text(value: unknown) { return typeof value === 'string' && value.trim() ? value.trim() : null }
function date(value: unknown) { const valueText = text(value); if (!valueText || Number.isNaN(Date.parse(valueText))) return null; return new Date(valueText).toISOString() }
function hash(row: Record<string, unknown>) { return createHash('sha256').update(JSON.stringify(row)).digest('hex') }
function rows(payload: any): Record<string, unknown>[] { return Array.isArray(payload) ? payload : Array.isArray(payload?.listings) ? payload.listings : Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.projects) ? payload.projects : [] }
function isLive(row: Record<string, unknown>) {
  const status = String(row.status || row.state || row.lifecycle || 'OPEN').toUpperCase()
  const deadline = date(row.deadline || row.dueDate || row.endDate)
  return !['CLOSED', 'EXPIRED', 'ARCHIVED', 'CANCELLED', 'FILLED', 'COMPLETED', 'WINNER_ANNOUNCED'].includes(status) && (!deadline || Date.parse(deadline) > Date.now())
}
function buildBase(source: string, row: Record<string, unknown>, now: string, defaults: Partial<NormalizedOpportunity> = {}): NormalizedOpportunity | null {
  if (!isLive(row)) return null
  const id = text(row.id) || text(row.uuid) || text(row.slug)
  const title = text(row.title) || text(row.name)
  const url = text(row.url) || text(row.source_url) || text(row.link) || (text(row.slug) ? defaults.source === 'superteam_earn' ? `https://earn.superteam.fun/listing/${row.slug}/` : null : null)
  if (!id || !title || !url) return null
  const reward = row.rewardAmount ?? row.reward_amount ?? row.maxRewardAsk ?? row.minRewardAsk
  const amount = typeof reward === 'number' || Number.isFinite(Number(reward)) ? Number(reward) : null
  const description = text(row.description) || text(row.content)
  return { source, source_id: id, source_url: url, type: text(row.type) || defaults.type || 'Opportunity', title, description, organization_name: text((row.sponsor as any)?.name) || text(row.organization) || defaults.organization_name || source, organization_logo: text((row.sponsor as any)?.logo) || null, reward_amount: amount, reward_currency: text(row.token) || text(row.currency), reward_text: text(row.rewardText) || text(row.reward_text), category: text(row.category) || text(row.type) || defaults.category || 'Project', skills: Array.isArray(row.skills) ? row.skills.filter((skill): skill is string => typeof skill === 'string') : [], ecosystem: text(row.ecosystem), chain: text(row.chain), location: text(row.location), remote: row.remote === true, published_at: date(row.createdAt || row.publishedAt), deadline: date(row.deadline || row.dueDate || row.endDate), status: 'LIVE', application_url: text(row.applicationUrl) || url, submission_url: text(row.submissionUrl), is_verified: true, metadata: { providerStatus: String(row.status || row.state || 'OPEN').toUpperCase(), provider: source }, content_hash: hash(row), is_active: true, is_expired: false, last_seen_at: now, last_synced_at: now }
}

async function discoverSuperteam(now: string) {
  const discovered: Record<string, unknown>[] = []
  const apiKey = process.env.SUPERTEAM_API_KEY
  if (apiKey) {
    try {
      const payload = await json('https://superteam.fun/api/agents/listings/live?take=100', { headers: { Authorization: `Bearer ${apiKey}` } })
      discovered.push(...rows(payload))
    } catch (error) { console.warn('[opportunity-sync] Superteam agent feed degraded:', error instanceof Error ? error.message : error) }
  }
  const publicBase = process.env.SUPERTEAM_EARN_LISTINGS_URL || 'https://earn.superteam.fun/api/listings'
  for (let page = 0; page < maxPages; page += 1) {
    const separator = publicBase.includes('?') ? '&' : '?'
    const payload = await json(`${publicBase}${separator}take=${pageSize}&skip=${page * pageSize}`)
    const pageRows = rows(payload)
    discovered.push(...pageRows)
    if (pageRows.length < pageSize) break
  }
  const unique = new Map<string, Record<string, unknown>>()
  for (const row of discovered) { const id = text(row.id) || text(row.uuid) || text(row.slug); if (id) unique.set(id, row) }
  return Array.from(unique.values()).flatMap((row) => { const item = buildBase('superteam_earn', row, now, { type: text(row.type) || 'Bounty', category: text(row.type) || 'Bounty' }); return item ? [item] : [] })
}

async function discoverGigwork(now: string) {
  const discovered: NormalizedOpportunity[] = []
  for (const endpoint of ['project', 'task']) {
    for (let page = 0; page < maxPages; page += 1) {
      const payload = await json(`https://www.gigwork.net/api/${endpoint}?limit=${pageSize}&offset=${page * pageSize}`)
      const pageRows = rows(payload)
      for (const row of pageRows) { const item = buildBase(`gigwork_${endpoint}`, row, now, { type: endpoint === 'task' ? 'Task' : 'Project', category: 'Crowdsourcing / Microtasks', organization_name: 'GIGwork' }); if (item) discovered.push(item) }
      if (pageRows.length < pageSize) break
    }
  }
  return Array.from(new Map(discovered.map((item) => [`${item.source}:${item.source_id}`, item])).values())
}

async function syncSource(source: string, name: string, rowsToUpsert: NormalizedOpportunity[], startedAt: string) {
  const supabase = getSources()
  const { error } = await supabase.from('opportunities').upsert(rowsToUpsert, { onConflict: 'source,source_id', ignoreDuplicates: false })
  if (error) throw error
  const staleBefore = new Date(Date.now() - staleAfterMinutes * 60_000).toISOString()
  await supabase.from('opportunities').update({ status: 'STALE', is_active: false, is_expired: true }).eq('source', source).eq('is_active', true).lt('last_seen_at', staleBefore)
  await supabase.from('opportunity_sources').upsert({ source, name, enabled: true, api_status: 'healthy', last_success_at: startedAt, last_sync_at: startedAt, records_seen: rowsToUpsert.length, records_updated: rowsToUpsert.length, error_message: null }, { onConflict: 'source' })
}

export async function syncOpportunitySources() {
  const startedAt = new Date().toISOString()
  const supabase = getSources()
  const run = await supabase.from('opportunity_sync_runs').insert({ source: 'opportunity_router', status: 'RUNNING', started_at: startedAt }).select('id').maybeSingle()
  const runId = run.data?.id ?? null
  const results: Record<string, { ok: boolean; count: number; error?: string }> = {}
  for (const [source, name, discover] of [['superteam_earn', 'Superteam Earn', discoverSuperteam], ['gigwork', 'GIGwork', discoverGigwork] ] as const) {
    try { const sourceRows = await discover(startedAt); await syncSource(source, name, sourceRows, startedAt); results[source] = { ok: true, count: sourceRows.length } }
    catch (error) { const message = error instanceof Error ? error.message : 'Unknown source error'; await supabase.from('opportunity_sources').upsert({ source, name, enabled: true, api_status: 'error', last_failure_at: startedAt, last_sync_at: startedAt, error_message: message }, { onConflict: 'source' }); results[source] = { ok: false, count: 0, error: message } }
  }
  const failed = Object.values(results).some((result) => !result.ok)
  if (runId) await supabase.from('opportunity_sync_runs').update({ status: failed ? 'PARTIAL' : 'SUCCEEDED', finished_at: new Date().toISOString(), records_seen: Object.values(results).reduce((sum, result) => sum + result.count, 0) }).eq('id', runId)
  return { startedAt, results }
}

export { discoverSuperteam, discoverGigwork }
