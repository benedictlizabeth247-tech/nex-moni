import 'server-only'

import { createHash } from 'node:crypto'
import { and, eq, lt, notInArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { opportunities, opportunitySources, type OpportunityInsert } from '@/lib/db/schema'

const timeoutMs = 15000
const text = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : null
const date = (value: unknown) => { const valueText = text(value); if (!valueText || Number.isNaN(Date.parse(valueText))) return null; return new Date(valueText) }
const asStrings = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && !!item.trim()).map((item) => item.trim()) : []
const hash = (value: string) => createHash('sha256').update(value).digest('hex')
const statusIsLive = (row: Record<string, unknown>) => !['closed', 'expired', 'completed', 'cancelled', 'unavailable', 'draft'].includes(String(row.status || '').toLowerCase())

async function json(url: string, headers: Record<string, string> = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json', 'User-Agent': 'nexMonie-discovery/1.0', ...headers }, cache: 'no-store' })
    if (response.status === 401 || response.status === 403) throw new Error(`unauthorized:${response.status}`)
    if (response.status === 429) throw new Error('rate_limited:429')
    if (!response.ok) throw new Error(`error:${response.status}`)
    return await response.json()
  } finally { clearTimeout(timer) }
}

type NormalizedOpportunity = Omit<OpportunityInsert, 'id' | 'discoveredAt' | 'updatedAt'> & { id?: string }

const approvedSourceProfiles: Record<string, string> = {
  superteam_earn: 'https://superteam.fun/earn',
  railway: 'https://railway.com/',
  web3_career: 'https://web3.career/',
  gitcoin: 'https://grants.gitcoin.co/',
  onlydust: 'https://app.onlydust.com/',
  layer3: 'https://layer3.xyz/',
  dorahacks: 'https://dorahacks.io/',
  dework: 'https://dework.xyz/',
}

type SourceInput = { source: string; sourceId: string; sourceUrl: string; applicationUrl?: string | null; projectName?: string | null; projectLogo?: string | null; projectProfileUrl?: string | null; projectWebsiteUrl?: string | null; sourceProfileUrl?: string | null; title: string; description?: string | null; opportunityType: string; category: string; rewardDescription?: string | null; rewardAmount?: string | null; rewardCurrency?: string | null; deadline?: Date | null; ecosystem?: string | null; location?: string | null; remote?: boolean | null; skills?: string[]; tags?: string[]; metadata?: Record<string, unknown> }

function normalize(input: SourceInput): NormalizedOpportunity {
  const deduplicationKey = `${input.source}:${input.sourceId}`
  const expired = Boolean(input.deadline && input.deadline <= new Date())
  return { id: hash(deduplicationKey), source: input.source, sourceId: input.sourceId, sourceUrl: input.sourceUrl || approvedSourceProfiles[input.source] || '#', applicationUrl: input.applicationUrl || input.sourceUrl || approvedSourceProfiles[input.source] || '#', projectName: input.projectName || null, projectLogo: input.projectLogo || null, projectProfileUrl: input.projectProfileUrl || null, projectWebsiteUrl: input.projectWebsiteUrl || null, sourceProfileUrl: input.sourceProfileUrl || approvedSourceProfiles[input.source] || null, title: input.title, description: input.description || null, opportunityType: input.opportunityType, category: input.category, ecosystem: input.ecosystem || null, rewardAmount: input.rewardAmount || null, rewardCurrency: input.rewardCurrency || null, rewardDescription: input.rewardDescription || null, deadline: input.deadline || null, location: input.location || null, remote: input.remote ?? null, skills: input.skills || [], tags: input.tags || [], verificationStatus: 'validated', liveStatus: expired ? 'expired' : 'live', publishedAt: null, expiresAt: input.deadline || null, deduplicationKey, metadata: input.metadata || {} }
}

async function fetchConfiguredPages(endpoint: string, headers?: Record<string, string>) {
  const rows: Record<string, unknown>[] = []
  for (let page = 1; page <= 100; page += 1) {
    const separator = endpoint.includes('?') ? '&' : '?'
    const payload = await json(`${endpoint}${separator}page=${page}&limit=100`, headers)
    const batch = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.items) ? payload.items : Array.isArray(payload?.listings) ? payload.listings : []
    rows.push(...batch as Record<string, unknown>[])
    const next = text(payload?.next) || text(payload?.nextPage) || text(payload?.pagination?.next)
    if (!next && batch.length < 100) break
  }
  return rows
}

async function superteam() {
  const endpoint = process.env.SUPERTEAM_EARN_LISTINGS_URL
  if (!endpoint) return []
  return (await fetchConfiguredPages(endpoint)).flatMap((row) => {
    const title = text(row.title); const sourceId = text(row.id) || text(row.slug); if (!title || !sourceId || !statusIsLive(row)) return []
    const slug = text(row.slug); const sourceUrl = text(row.url) || (slug ? `https://earn.superteam.fun/listing/${slug}/` : 'https://superteam.fun/earn')
    const sponsor = row.sponsor as Record<string, unknown> | undefined
    const project = row.project as Record<string, unknown> | undefined
    const profile = row.profile as Record<string, unknown> | undefined
    const projectLogo = text(sponsor?.logo) || text(sponsor?.logoUrl) || text(sponsor?.image) || text(sponsor?.avatar) || text(project?.logo) || text(project?.logoUrl) || text(project?.image) || text(project?.avatar) || text(profile?.image) || text(profile?.avatar) || text(row.projectLogo) || text(row.logo) || text(row.image)
    const projectName = text(sponsor?.name) || text(project?.name) || text(row.project) || text(row.organization)
    const projectProfileUrl = text(sponsor?.url) || text(sponsor?.profileUrl) || text(project?.url) || text(project?.profileUrl)
    const deadline = date(row.deadline || row.endsAt || row.endDate)
    return [normalize({ source: 'superteam_earn', sourceId, sourceUrl, applicationUrl: text(row.applicationUrl) || sourceUrl, projectName, projectLogo, projectProfileUrl, projectWebsiteUrl: text(sponsor?.website) || text(project?.website), sourceProfileUrl: projectProfileUrl || 'https://superteam.fun/earn', title, description: text(row.description), opportunityType: text(row.type) || 'Bounty', category: text(row.type) || 'Bounty', rewardAmount: text(row.rewardAmount ?? row.maxRewardAsk ?? row.minRewardAsk), rewardCurrency: text(row.token) || text(row.currency), rewardDescription: text(row.rewardText), deadline, ecosystem: text(row.ecosystem), location: text(row.location), remote: row.remote === true, skills: asStrings(row.skills), metadata: { providerStatus: String(row.status || 'OPEN'), profileImage: projectLogo, sourceProfile: projectProfileUrl } })]
  })
}

const unavailable = (source: string) => async (): Promise<NormalizedOpportunity[]> => { void source; return [] }
const availability: Record<string, string> = {
  railway: 'No verified public opportunity feed configured.', superteam_earn: 'Set SUPERTEAM_EARN_LISTINGS_URL to the official feed.', web3_career: 'No official public API/feed configured; no scraping performed.', gitcoin: 'Official API/feed credentials are not configured; no guessed GraphQL query used.', onlydust: 'No verified public API/feed configured; no scraping performed.', layer3: 'No verified public API/feed configured; no scraping performed.', dorahacks: 'No verified public API/feed configured; no scraping performed.', dework: 'No verified public API/feed configured; no scraping performed.', freelancer: 'Official API credentials are not configured.', upwork: 'Official API credentials and permitted access are not configured.', fiverr: 'No suitable official public API/feed is configured; no scraping performed.',
}
const providers = [
  { key: 'superteam_earn', discover: superteam }, { key: 'railway', discover: unavailable('railway') }, { key: 'web3_career', discover: unavailable('web3_career') }, { key: 'gitcoin', discover: unavailable('gitcoin') }, { key: 'onlydust', discover: unavailable('onlydust') }, { key: 'layer3', discover: unavailable('layer3') }, { key: 'dorahacks', discover: unavailable('dorahacks') }, { key: 'dework', discover: unavailable('dework') }, { key: 'freelancer', discover: unavailable('freelancer') }, { key: 'upwork', discover: unavailable('upwork') }, { key: 'fiverr', discover: unavailable('fiverr') },
]

function statusForError(error: unknown) { const message = error instanceof Error ? error.message : 'error:unknown'; return message.startsWith('unauthorized:') ? 'unauthorized' : message.startsWith('rate_limited:') ? 'rate_limited' : 'error' }

export async function syncOpportunitySources() {
  const results: Record<string, { ok: boolean; count: number; status: string; error?: string }> = {}
  const attemptedAt = new Date()
  for (const provider of providers) {
    try {
      const rows = await provider.discover()
      const sourceIds = rows.map((row) => row.sourceId)
      for (const row of rows) await db.insert(opportunities).values({ ...(row as OpportunityInsert), lastSyncedAt: attemptedAt }).onConflictDoUpdate({ target: [opportunities.source, opportunities.sourceId], set: { ...row, lastSyncedAt: attemptedAt, updatedAt: attemptedAt } })
      if (rows.length > 0) await db.update(opportunities).set({ liveStatus: 'closed', closedAt: attemptedAt, updatedAt: attemptedAt }).where(and(eq(opportunities.source, provider.key), eq(opportunities.liveStatus, 'live'), notInArray(opportunities.sourceId, sourceIds)))
      await db.insert(opportunitySources).values({ provider: provider.key, status: rows.length ? 'healthy' : 'unavailable', lastSuccessfulSync: rows.length ? attemptedAt : null, lastAttemptedSync: attemptedAt, error: rows.length ? null : availability[provider.key], recordsDiscovered: rows.length, recordsValid: rows.length, updatedAt: attemptedAt }).onConflictDoUpdate({ target: opportunitySources.provider, set: { status: rows.length ? 'healthy' : 'unavailable', lastSuccessfulSync: rows.length ? attemptedAt : undefined, lastAttemptedSync: attemptedAt, error: rows.length ? null : availability[provider.key], recordsDiscovered: rows.length, recordsValid: rows.length, updatedAt: attemptedAt } })
      results[provider.key] = { ok: true, count: rows.length, status: rows.length ? 'healthy' : 'unavailable' }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Source request failed'; const status = statusForError(error)
      await db.insert(opportunitySources).values({ provider: provider.key, status, lastAttemptedSync: attemptedAt, error: message, updatedAt: attemptedAt }).onConflictDoUpdate({ target: opportunitySources.provider, set: { status, lastAttemptedSync: attemptedAt, error: message, updatedAt: attemptedAt } })
      results[provider.key] = { ok: false, count: 0, status, error: message }
    }
  }
  await db.update(opportunities).set({ liveStatus: 'expired', closedAt: attemptedAt, updatedAt: attemptedAt }).where(and(eq(opportunities.liveStatus, 'live'), lt(opportunities.deadline, attemptedAt)))
  return { results }
}
