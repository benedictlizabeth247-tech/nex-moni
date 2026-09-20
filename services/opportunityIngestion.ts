import 'server-only'

import { createHash } from 'node:crypto'
import { and, eq, lt } from 'drizzle-orm'
import { db } from '@/lib/db'
import { opportunities, opportunitySources, type OpportunityInsert } from '@/lib/db/schema'

type NormalizedOpportunity = Omit<OpportunityInsert, 'id' | 'discoveredAt' | 'updatedAt'> & { id?: string }
const timeoutMs = 12000
const text = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : null
const date = (value: unknown) => { const valueText = text(value); if (!valueText || Number.isNaN(Date.parse(valueText))) return null; return new Date(valueText) }
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
async function json(url: string) { const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs); try { const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json', 'User-Agent': 'nexMonie-discovery/1.0' }, cache: 'no-store' }); if (!response.ok) throw new Error(`${response.status} ${response.statusText}`); return await response.json() } finally { clearTimeout(timer) } }

const asStrings = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && !!item.trim()).map((item) => item.trim()) : []
const statusIsLive = (row: Record<string, unknown>) => !['closed', 'expired', 'completed', 'cancelled', 'draft'].includes(String(row.status || '').toLowerCase())
const normalized = (input: { source: string; sourceId: string; sourceUrl: string; applicationUrl?: string | null; title: string; description?: string | null; projectName?: string | null; opportunityType: string; category: string; rewardDescription?: string | null; rewardAmount?: string | null; rewardCurrency?: string | null; deadline?: Date | null; ecosystem?: string | null; location?: string | null; remote?: boolean | null; skills?: string[]; tags?: string[]; metadata?: Record<string, unknown> }): NormalizedOpportunity => { const deduplicationKey = `${input.source}:${input.sourceId}`; return { id: hash(deduplicationKey), source: input.source, sourceId: input.sourceId, sourceUrl: input.sourceUrl, applicationUrl: input.applicationUrl || input.sourceUrl, projectName: input.projectName || null, projectLogo: null, title: input.title, description: input.description || null, opportunityType: input.opportunityType, category: input.category, ecosystem: input.ecosystem || null, rewardAmount: input.rewardAmount || null, rewardCurrency: input.rewardCurrency || null, rewardDescription: input.rewardDescription || null, deadline: input.deadline || null, location: input.location || null, remote: input.remote ?? null, skills: input.skills || [], tags: input.tags || [], verificationStatus: 'validated', liveStatus: input.deadline ? (input.deadline <= new Date() ? 'expired' : 'live') : 'live', publishedAt: null, expiresAt: input.deadline || null, deduplicationKey, metadata: input.metadata || {} } }

async function superteam(): Promise<NormalizedOpportunity[]> { const configuredEndpoint = process.env.SUPERTEAM_EARN_LISTINGS_URL; if (!configuredEndpoint) return []; const endpoints = [configuredEndpoint]; const rows: Record<string, unknown>[] = []; for (const endpoint of endpoints) { const payload = await json(endpoint); const batch = Array.isArray(payload) ? payload : Array.isArray(payload?.listings) ? payload.listings : Array.isArray(payload?.data) ? payload.data : []; rows.push(...batch as Record<string, unknown>[]) } return rows.flatMap((row) => { const title = text(row.title); const sourceId = text(row.id) || text(row.slug); if (!title || !sourceId || !statusIsLive(row)) return []; const slug = text(row.slug); const sourceUrl = text(row.url) || (slug ? `https://earn.superteam.fun/listing/${slug}/` : 'https://earn.superteam.fun/'); const sponsor = row.sponsor as Record<string, unknown> | undefined; const deadline = date(row.deadline || row.endsAt || row.endDate); return [normalized({ source: 'superteam_earn', sourceId, sourceUrl, applicationUrl: text(row.applicationUrl) || sourceUrl, projectName: text(sponsor?.name) || text(row.project), title, description: text(row.description), opportunityType: text(row.type) || 'Bounty', category: text(row.type) || 'Bounty', rewardAmount: Number.isFinite(Number(row.rewardAmount ?? row.maxRewardAsk ?? row.minRewardAsk)) ? String(row.rewardAmount ?? row.maxRewardAsk ?? row.minRewardAsk) : null, rewardCurrency: text(row.token) || text(row.currency), rewardDescription: text(row.rewardText), deadline, ecosystem: text(row.ecosystem), location: text(row.location), remote: row.remote === true, skills: asStrings(row.skills), metadata: { providerStatus: String(row.status || 'OPEN') } })] }) }

const unavailable = (provider: string) => async (): Promise<NormalizedOpportunity[]> => { void provider; return [] }
const providerAvailability: Record<string, string> = {
  railway: 'No verified public opportunity feed configured; no scraping or guessed endpoint used.',
  superteam_earn: 'Requires SUPERTEAM_EARN_LISTINGS_URL or the configured official feed.',
  web3_career: 'No official public API/feed configured; no scraping performed.',
  gitcoin: 'Official GraphQL indexer requires schema-specific integration configuration; no guessed query used.',
  onlydust: 'No verified public API/feed configured; no scraping performed.',
  layer3: 'No verified public API/feed configured; no scraping performed.',
  dorahacks: 'No verified public API/feed configured; no scraping performed.',
  dework: 'No verified public API/feed configured; no scraping performed.',
}
const providers = [
  { key: 'superteam_earn', discover: superteam },
  { key: 'railway', discover: unavailable('railway') },
  { key: 'web3_career', discover: unavailable('web3_career') },
  { key: 'gitcoin', discover: unavailable('gitcoin') },
  { key: 'onlydust', discover: unavailable('onlydust') },
  { key: 'layer3', discover: unavailable('layer3') },
  { key: 'dorahacks', discover: unavailable('dorahacks') },
  { key: 'dework', discover: unavailable('dework') },
]

export async function syncOpportunitySources() { const results: Record<string, { ok: boolean; count: number; error?: string }> = {}; const attemptedAt = new Date(); for (const provider of providers) { try { const rows = await provider.discover(); for (const row of rows) await db.insert(opportunities).values(row as OpportunityInsert).onConflictDoUpdate({ target: [opportunities.source, opportunities.sourceId], set: { ...row, updatedAt: attemptedAt } }); await db.insert(opportunitySources).values({ provider: provider.key, status: rows.length ? 'healthy' : 'unavailable', lastSuccessfulSync: rows.length ? attemptedAt : null, lastAttemptedSync: attemptedAt, error: providerAvailability[provider.key] || null, recordsDiscovered: rows.length, recordsValid: rows.length, updatedAt: attemptedAt }).onConflictDoUpdate({ target: opportunitySources.provider, set: { status: rows.length ? 'healthy' : 'unavailable', lastSuccessfulSync: rows.length ? attemptedAt : undefined, lastAttemptedSync: attemptedAt, error: providerAvailability[provider.key] || null, recordsDiscovered: rows.length, recordsValid: rows.length, updatedAt: attemptedAt } }); results[provider.key] = { ok: true, count: rows.length } } catch (error) { const message = error instanceof Error ? error.message : 'Source request failed'; await db.insert(opportunitySources).values({ provider: provider.key, status: 'error', lastAttemptedSync: attemptedAt, error: message, updatedAt: attemptedAt }).onConflictDoUpdate({ target: opportunitySources.provider, set: { status: 'error', lastAttemptedSync: attemptedAt, error: message, updatedAt: attemptedAt } }); results[provider.key] = { ok: false, count: 0, error: message } } } await db.update(opportunities).set({ liveStatus: 'expired', updatedAt: attemptedAt }).where(and(eq(opportunities.liveStatus, 'live'), lt(opportunities.deadline, attemptedAt))); return { results } }
