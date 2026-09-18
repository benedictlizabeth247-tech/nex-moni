import 'server-only'

import { createClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!)
const TIMEOUT_MS = 12_000
const MAX_RECORDS = 400

export type OpportunityType = 'bounty' | 'job' | 'project' | 'grant' | 'hackathon' | 'dao_task' | 'open_source' | 'quest' | 'campaign'
export type SourceName = 'superteam_earn' | 'web3_career' | 'gitcoin' | 'onlydust' | 'layer3' | 'dorahacks' | 'dework' | 'github'

type NormalizedOpportunity = {
  source: SourceName
  external_id: string
  title: string
  description: string | null
  organization: string | null
  organization_name: string | null
  type: OpportunityType
  category: string
  reward_amount: number | null
  reward_currency: string | null
  reward_text: string | null
  deadline: string | null
  location: string | null
  remote: boolean
  skills: string[]
  source_url: string
  application_url: string
  status: 'LIVE'
  published_at: string | null
  last_synced_at: string
  is_verified: boolean
  is_featured: boolean
  metadata: Record<string, unknown>
  content_hash: string
}

type AdapterResult = { source: SourceName; rows: NormalizedOpportunity[]; error?: string }

const SOURCE_LABELS: Record<SourceName, string> = {
  superteam_earn: 'Superteam Earn', web3_career: 'Web3.career', gitcoin: 'Gitcoin', onlydust: 'OnlyDust',
  layer3: 'Layer3', dorahacks: 'DoraHacks', dework: 'Dework', github: 'GitHub',
}

async function fetchJson(url: string, headers: Record<string, string> = {}) {
  let lastError: unknown
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      const response = await fetch(url, { signal: controller.signal, cache: 'no-store', headers: { Accept: 'application/json', 'User-Agent': 'nexMonie-GigWorks/1.0', ...headers } })
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
      return await response.json()
    } catch (error) { lastError = error; if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt)) }
    finally { clearTimeout(timer) }
  }
  throw lastError instanceof Error ? lastError : new Error('Source request failed')
}

function text(value: unknown) { return typeof value === 'string' && value.trim() ? value.trim() : null }
function isoDate(value: unknown) { const raw = text(value); if (!raw || Number.isNaN(Date.parse(raw))) return null; return new Date(raw).toISOString() }
function number(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null }
function hash(value: unknown) { return createHash('sha256').update(JSON.stringify(value)).digest('hex') }
function safeType(value: unknown, fallback: OpportunityType): OpportunityType { const type = text(value)?.toLowerCase().replace(/[- ]/g, '_'); return ['bounty','job','project','grant','hackathon','dao_task','open_source','quest','campaign'].includes(type || '') ? type as OpportunityType : fallback }

function normalizeSuperteam(row: Record<string, unknown>, syncedAt: string): NormalizedOpportunity | null {
  const status = String(row.status || 'OPEN').toUpperCase()
  const id = text(row.id) || text(row.slug)
  const title = text(row.title)
  const slug = text(row.slug)
  if (!id || !title || ['CLOSED','EXPIRED','ARCHIVED','CANCELLED','FILLED'].includes(status)) return null
  const sponsor = (row.sponsor || {}) as Record<string, unknown>
  const sourceUrl = slug ? `https://superteam.fun/earn/${slug}` : 'https://superteam.fun/earn'
  return { source: 'superteam_earn', external_id: id, title, description: text(row.description), organization: text(sponsor.name), organization_name: text(sponsor.name), type: safeType(row.type, 'bounty'), category: text(row.type) || 'Bounty', reward_amount: number(row.rewardAmount ?? row.maxRewardAsk ?? row.minRewardAsk), reward_currency: text(row.token), reward_text: text(row.rewardText), deadline: isoDate(row.deadline), location: text(row.location), remote: row.remote === true, skills: Array.isArray(row.skills) ? row.skills.filter((v): v is string => typeof v === 'string') : [], source_url: sourceUrl, application_url: text(row.applicationUrl) || sourceUrl, status: 'LIVE', published_at: isoDate(row.createdAt || row.publishedAt), last_synced_at: syncedAt, is_verified: true, is_featured: row.isFeatured === true, metadata: { providerStatus: status, organizationLogo: text(sponsor.logo) }, content_hash: hash(row) }
}

export async function syncSuperteam(syncedAt: string): Promise<AdapterResult> {
  const payload = await fetchJson(process.env.SUPERTEAM_EARN_LISTINGS_URL || 'https://earn.superteam.fun/api/listings/?take=400&skip=0')
  const rows = (Array.isArray(payload) ? payload : payload?.listings || payload?.data || []).map((row: Record<string, unknown>) => normalizeSuperteam(row, syncedAt)).filter(Boolean) as NormalizedOpportunity[]
  return { source: 'superteam_earn', rows: rows.slice(0, MAX_RECORDS) }
}

export async function syncGitHub(syncedAt: string): Promise<AdapterResult> {
  const payload = await fetchJson('https://api.github.com/search/issues?q=is:issue+is:open+(label:bounty+OR+label:reward+OR+label:funded)+-label:good-first-issue&per_page=100', { Accept: 'application/vnd.github+json' })
  const rows = (payload.items || []).map((row: Record<string, unknown>) => ({ source: 'github' as const, external_id: String(row.id), title: text(row.title) || '', description: text(row.body), organization: text((row.repository_url as string | undefined)?.split('/').pop()), organization_name: text((row.repository_url as string | undefined)?.split('/').pop()), type: 'open_source' as const, category: 'Open Source', reward_amount: null, reward_currency: null, reward_text: null, deadline: null, location: 'Remote', remote: true, skills: [], source_url: String(row.html_url), application_url: String(row.html_url), status: 'LIVE' as const, published_at: isoDate(row.created_at), last_synced_at: syncedAt, is_verified: true, is_featured: false, metadata: { labels: row.labels }, content_hash: hash(row) })).filter((row: NormalizedOpportunity) => row.title && row.source_url)
  return { source: 'github', rows: rows.slice(0, MAX_RECORDS) }
}

async function unavailable(source: SourceName): Promise<AdapterResult> { return { source, rows: [], error: 'No verified public feed configured for this provider' } }

const adapters: Record<SourceName, (syncedAt: string) => Promise<AdapterResult>> = {
  superteam_earn: syncSuperteam,
  web3_career: async () => unavailable('web3_career'),
  gitcoin: async () => unavailable('gitcoin'),
  onlydust: async () => unavailable('onlydust'),
  layer3: async () => unavailable('layer3'),
  dorahacks: async () => unavailable('dorahacks'),
  dework: async () => unavailable('dework'),
  github: syncGitHub,
}

async function persist(result: AdapterResult, syncedAt: string) {
  const base = { source: result.source, status: result.error ? 'ERROR' : 'CONNECTED', last_attempted_sync: syncedAt, updated_at: syncedAt, records_fetched: result.rows.length, error_message: result.error || null }
  if (result.error) { await db.from('opportunity_source_health').upsert(base, { onConflict: 'source' }); return }
  const { error } = await db.from('opportunities').upsert(result.rows, { onConflict: 'source,external_id', ignoreDuplicates: false })
  if (error) throw error
  await db.from('opportunity_source_health').upsert({ ...base, last_successful_sync: syncedAt, records_inserted: result.rows.length, records_updated: result.rows.length }, { onConflict: 'source' })
}

export async function syncGigWorks() {
  const startedAt = new Date().toISOString()
  const results = await Promise.all(Object.entries(adapters).map(async ([source, adapter]) => {
    try { const result = await adapter(startedAt); await persist(result, startedAt); return result }
    catch (error) { const result: AdapterResult = { source: source as SourceName, rows: [], error: error instanceof Error ? error.message : 'Source sync failed' }; await persist(result, startedAt).catch(() => undefined); return result }
  }))
  return { startedAt, completedAt: new Date().toISOString(), results: Object.fromEntries(results.map((result) => [result.source, { ok: !result.error, count: result.rows.length, error: result.error }])) }
}

export const syncOpportunitySources = syncGigWorks
export { SOURCE_LABELS }

export async function expireStaleOpportunities() {
  await db.from('opportunities').update({ status: 'EXPIRED', updated_at: new Date().toISOString() }).eq('status', 'LIVE').lt('deadline', new Date().toISOString())
}

export type { NormalizedOpportunity }

// Unconfigured providers are isolated so one unavailable source cannot block others.
export const syncWeb3Career = (at = new Date().toISOString()) => adapters.web3_career(at)
export const syncGitcoin = (at = new Date().toISOString()) => adapters.gitcoin(at)
export const syncOnlyDust = (at = new Date().toISOString()) => adapters.onlydust(at)
export const syncLayer3 = (at = new Date().toISOString()) => adapters.layer3(at)
export const syncDoraHacks = (at = new Date().toISOString()) => adapters.dorahacks(at)
export const syncDework = (at = new Date().toISOString()) => adapters.dework(at)

export async function getSourceHealth() {
  const { data } = await db.from('opportunity_source_health').select('*').order('source')
  return data || []
}
