import 'server-only'

import { createHash } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { opportunities, opportunitySources, type OpportunityInsert } from '@/lib/db/schema'

type NormalizedOpportunity = Omit<OpportunityInsert, 'id' | 'discoveredAt' | 'updatedAt'> & { id?: string }
const timeoutMs = 12000
const text = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : null
const date = (value: unknown) => { const valueText = text(value); if (!valueText || Number.isNaN(Date.parse(valueText))) return null; return new Date(valueText) }
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
async function json(url: string) { const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs); try { const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json', 'User-Agent': 'nexMonie-discovery/1.0' }, cache: 'no-store' }); if (!response.ok) throw new Error(`${response.status} ${response.statusText}`); return await response.json() } finally { clearTimeout(timer) } }

async function superteam(): Promise<NormalizedOpportunity[]> { const endpoint = process.env.SUPERTEAM_EARN_LISTINGS_URL; if (!endpoint) return []; const payload = await json(endpoint); const rows = Array.isArray(payload) ? payload : Array.isArray(payload?.listings) ? payload.listings : Array.isArray(payload?.data) ? payload.data : []; return rows.flatMap((row: Record<string, unknown>) => { const title = text(row.title); const sourceId = text(row.id) || text(row.slug); if (!title || !sourceId) return []; const sponsor = row.sponsor as Record<string, unknown> | undefined; const sourceUrl = text(row.slug) ? `https://earn.superteam.fun/listing/${row.slug}/` : 'https://earn.superteam.fun/'; const reward = row.rewardAmount ?? row.maxRewardAsk ?? row.minRewardAsk; const amount = Number(reward); const deduplicationKey = `superteam_earn:${sourceId}`; return [{ id: hash(deduplicationKey), source: 'superteam_earn', sourceId, sourceUrl, applicationUrl: text(row.applicationUrl) || sourceUrl, projectName: text(sponsor?.name), projectLogo: text(sponsor?.logo), title, description: text(row.description), opportunityType: text(row.type) || 'Bounty', category: text(row.type) || 'Bounty', ecosystem: text(row.ecosystem), rewardAmount: Number.isFinite(amount) ? String(amount) : null, rewardCurrency: text(row.token), rewardDescription: text(row.rewardText), deadline: date(row.deadline), location: text(row.location), remote: row.remote === true, skills: Array.isArray(row.skills) ? row.skills.filter((skill): skill is string => typeof skill === 'string') : [], tags: [], verificationStatus: 'validated', liveStatus: 'live', publishedAt: date(row.createdAt || row.publishedAt), expiresAt: date(row.deadline), deduplicationKey, metadata: { providerStatus: String(row.status || 'OPEN') } }] }) }

const providers = [
  { key: 'superteam_earn', name: 'Superteam Earn', discover: superteam },
  { key: 'web3_career', name: 'Web3.career', discover: async () => [] },
  { key: 'gitcoin', name: 'Gitcoin Grants Stack', discover: async () => [] },
  { key: 'onlydust', name: 'OnlyDust', discover: async () => [] },
  { key: 'layer3', name: 'Layer3', discover: async () => [] },
  { key: 'dorahacks', name: 'DoraHacks', discover: async () => [] },
  { key: 'dework', name: 'Dework', discover: async () => [] },
]

export async function syncOpportunitySources() { const results: Record<string, { ok: boolean; count: number; error?: string }> = {}; for (const provider of providers) { const attemptedAt = new Date(); try { const rows = await provider.discover(); for (const row of rows) { await db.insert(opportunities).values(row as OpportunityInsert).onConflictDoUpdate({ target: [opportunities.source, opportunities.sourceId], set: { ...row, updatedAt: attemptedAt } }) } await db.insert(opportunitySources).values({ provider: provider.key, status: rows.length || provider.key === 'superteam_earn' ? 'healthy' : 'unavailable', lastSuccessfulSync: rows.length ? attemptedAt : null, lastAttemptedSync: attemptedAt, error: null, recordsDiscovered: rows.length, recordsValid: rows.length, updatedAt: attemptedAt }).onConflictDoUpdate({ target: opportunitySources.provider, set: { status: rows.length ? 'healthy' : 'unavailable', lastSuccessfulSync: rows.length ? attemptedAt : undefined, lastAttemptedSync: attemptedAt, error: null, recordsDiscovered: rows.length, recordsValid: rows.length, updatedAt: attemptedAt } }); results[provider.key] = { ok: true, count: rows.length } } catch (error) { const message = error instanceof Error ? error.message : 'Source request failed'; await db.insert(opportunitySources).values({ provider: provider.key, status: 'error', lastAttemptedSync: attemptedAt, error: message, updatedAt: attemptedAt }).onConflictDoUpdate({ target: opportunitySources.provider, set: { status: 'error', lastAttemptedSync: attemptedAt, error: message, updatedAt: attemptedAt } }); results[provider.key] = { ok: false, count: 0, error: message } } } return { results } }
