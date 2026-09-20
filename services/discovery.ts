import 'server-only'

import { and, asc, count, desc, eq, ilike, lt, or, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { opportunities, opportunitySources, type Opportunity } from '@/lib/db/schema'
import { syncOpportunitySources } from './opportunityIngestion'

export type DiscoveryCategory = 'Job' | 'Bounty' | 'Hackathon' | 'Grant' | 'Gig' | 'Quest' | 'Project' | 'Task' | 'Open Source' | 'Other'
export interface DiscoveryOpportunity { id: string; title: string; organizationName: string; source: string; sourceUrl: string; category: DiscoveryCategory; shortDescription: string; description: string; imageUrl?: string; creatorAvatarUrl?: string; rewardLabel?: string; deadline?: string; tags: string[]; isFeatured: boolean; ecosystem?: string; location?: string; remote?: boolean; applicationUrl?: string; verificationStatus: string; opportunityType: string; projectName?: string; sourceId: string }
const text = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : undefined
function map(row: Opportunity): DiscoveryOpportunity { const description = row.description || ''; const reward = row.rewardDescription || (row.rewardAmount ? `${Number(row.rewardAmount).toLocaleString()}${row.rewardCurrency ? ` ${row.rewardCurrency}` : ''}` : undefined); return { id: row.id, title: row.title, organizationName: row.projectName || 'Web3 opportunity', source: row.source, sourceUrl: row.sourceUrl, category: row.category as DiscoveryCategory, shortDescription: description.slice(0, 180), description, imageUrl: row.projectLogo || undefined, creatorAvatarUrl: row.projectLogo || undefined, rewardLabel: reward || undefined, deadline: row.deadline?.toISOString(), tags: [...(row.skills || []), ...(row.tags || [])], isFeatured: row.verificationStatus === 'validated', ecosystem: row.ecosystem || undefined, location: row.location || undefined, remote: row.remote || undefined, applicationUrl: row.applicationUrl || undefined, verificationStatus: row.verificationStatus, opportunityType: row.opportunityType, projectName: row.projectName || undefined, sourceId: row.sourceId } }

export async function getDiscoveryOpportunities(options: { page?: number; limit?: number; search?: string; category?: string; ecosystem?: string; source?: string } = {}) {
  const page = Math.max(1, options.page || 1); const limit = Math.min(50, Math.max(1, options.limit || 24)); const offset = (page - 1) * limit; const now = new Date()
  const conditions = [eq(opportunities.liveStatus, 'live'), or(sql`${opportunities.deadline} is null`, sql`${opportunities.deadline} > ${now}`)]
  const query = options.search?.trim(); if (query) conditions.push(or(ilike(opportunities.title, `%${query}%`), ilike(opportunities.description, `%${query}%`), ilike(opportunities.projectName, `%${query}%`), ilike(opportunities.source, `%${query}%`), sql`${query} = any(${opportunities.skills})`, sql`${query} = any(${opportunities.tags})`) as any)
  if (options.category && options.category !== 'All') conditions.push(eq(opportunities.category, options.category))
  if (options.ecosystem && options.ecosystem !== 'All') conditions.push(eq(opportunities.ecosystem, options.ecosystem))
  if (options.source && options.source !== 'All') conditions.push(eq(opportunities.source, options.source))
  let rows = await db.select().from(opportunities).where(and(...conditions)).orderBy(asc(opportunities.deadline), desc(opportunities.updatedAt)).limit(limit).offset(offset)
  const totalResult = await db.select({ total: count() }).from(opportunities).where(and(...conditions)); const total = Number(totalResult[0]?.total || 0)
  if (total === 0 && page === 1 && !query && !options.category) { try { await syncOpportunitySources(); rows = await db.select().from(opportunities).where(and(...conditions)).orderBy(asc(opportunities.deadline), desc(opportunities.updatedAt)).limit(limit) } catch {} }
  const sources = await db.select().from(opportunitySources).orderBy(asc(opportunitySources.provider))
  return { opportunities: rows.map(map), providers: Object.fromEntries(sources.map((source) => [source.provider, source.status === 'healthy'])), sourceHealth: sources, hasMore: offset + rows.length < total, total: Math.max(total, rows.length) }
}

export async function getDiscoveryOpportunity(id: string) { const rows = await db.select().from(opportunities).where(eq(opportunities.id, id)).limit(1); return rows[0] ? map(rows[0]) : null }
