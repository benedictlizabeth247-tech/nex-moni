import 'server-only'

export type DiscoveryCategory = 'Job' | 'Bounty' | 'Hackathon' | 'Grant' | 'Quest' | 'Project' | 'Task'

export interface DiscoveryOpportunity {
  id: string
  title: string
  organizationName: string
  source: 'Superteam Earn' | 'Gibwork' | 'Galxe' | 'Dework'
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
}

type ProviderResult = { opportunities: DiscoveryOpportunity[]; available: boolean; hasMore: boolean }

const BROWSER_HEADERS = {
  Accept: 'application/json',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}
function first(...values: unknown[]) {
  return values.map(text).find(Boolean)
}
function stripHtml(value: unknown, max = 220) {
  const clean = text(value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  return clean.length > max ? `${clean.slice(0, max).trim()}…` : clean
}
function category(value: unknown): DiscoveryCategory {
  const normalized = text(value).toLowerCase()
  if (normalized.includes('job')) return 'Job'
  if (normalized.includes('grant')) return 'Grant'
  if (normalized.includes('quest')) return 'Quest'
  if (normalized.includes('project')) return 'Project'
  if (normalized.includes('hack')) return 'Hackathon'
  if (normalized.includes('task') || normalized.includes('service')) return 'Task'
  return 'Bounty'
}
function formatDeadline(value: unknown) {
  const raw = text(value)
  if (!raw) return undefined
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return undefined
  const now = Date.now()
  const days = Math.round((date.getTime() - now) / 86_400_000)
  if (days < 0) return 'Closed'
  if (days === 0) return 'Closes today'
  if (days === 1) return '1 day left'
  if (days <= 60) return `${days} days left`
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

async function fetchJson(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: { ...BROWSER_HEADERS, ...(init?.headers || {}) },
    next: { revalidate: 300 },
  })
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
  return response.json()
}

// --- Superteam Earn -------------------------------------------------------
// Public listings endpoint used by the official earn.superteam.fun frontend.
async function superteam(page: number, limit: number): Promise<ProviderResult> {
  const base = process.env.SUPERTEAM_EARN_LISTINGS_URL || 'https://earn.superteam.fun/api/listings/'
  const url = `${base}${base.includes('?') ? '&' : '?'}take=${limit}&skip=${(page - 1) * limit}`
  try {
    const payload = await fetchJson(
      url,
      process.env.SUPERTEAM_API_KEY ? { headers: { Authorization: `Bearer ${process.env.SUPERTEAM_API_KEY}` } } : undefined,
    )
    const rows: any[] = Array.isArray(payload) ? payload : Array.isArray(payload?.listings) ? payload.listings : Array.isArray(payload?.data) ? payload.data : []
    const opportunities = rows
      .filter((row) => (row.status ? String(row.status).toUpperCase() === 'OPEN' : true))
      .map((row): DiscoveryOpportunity => {
        const token = text(row.token)
        const min = row.minRewardAsk
        const max = row.maxRewardAsk
        let rewardLabel: string | undefined
        if (typeof row.rewardAmount === 'number' && row.rewardAmount > 0) rewardLabel = `${row.rewardAmount.toLocaleString()} ${token}`.trim()
        else if (min && max) rewardLabel = `${Number(min).toLocaleString()}–${Number(max).toLocaleString()} ${token}`.trim()
        else if (String(row.compensationType).toLowerCase() === 'variable') rewardLabel = 'Variable reward'
        return {
          id: `superteam-${row.id || row.slug || row.title}`,
          title: first(row.title) || 'Untitled opportunity',
          organizationName: first(row.sponsor?.name) || 'Superteam ecosystem',
          source: 'Superteam Earn',
          sourceUrl: row.slug ? `https://earn.superteam.fun/listing/${row.slug}/` : 'https://earn.superteam.fun/',
          category: category(row.type),
          shortDescription: `${category(row.type)} · ${first(row.sponsor?.name) || 'Superteam'}`,
          description: '',
          imageUrl: first(row.sponsor?.logo),
          creatorAvatarUrl: first(row.sponsor?.logo),
          rewardLabel,
          deadline: formatDeadline(row.deadline),
          tags: [text(row.type)].filter(Boolean),
          isFeatured: Boolean(row.isFeatured),
        }
      })
    return { available: true, opportunities, hasMore: rows.length >= limit }
  } catch {
    return { available: false, opportunities: [], hasMore: false }
  }
}

// --- Gibwork --------------------------------------------------------------
// Official public explore endpoint (api.gib.work) with page/limit pagination.
async function gibwork(page: number, limit: number): Promise<ProviderResult> {
  const base = process.env.GIBWORK_EXPLORE_URL || 'https://api.gib.work/explore'
  try {
    const payload = await fetchJson(`${base}?page=${page}&limit=${limit}`)
    const rows: any[] = Array.isArray(payload) ? payload : Array.isArray(payload?.results) ? payload.results : []
    const lastPage = Number(payload?.lastPage) || page
    const opportunities = rows
      .filter((row) => row.isOpen !== false && row.isHidden !== true)
      .map((row): DiscoveryOpportunity => {
        const symbol = first(row.asset?.symbol)
        const amount = row.remainingAmount ?? row.asset?.price
        return {
          id: `gibwork-${row.id}`,
          title: first(row.title) || 'Untitled task',
          organizationName: first(row.user?.username) || 'Gibwork creator',
          source: 'Gibwork',
          sourceUrl: `https://gib.work/tasks/${row.id}`,
          category: category(row.type),
          shortDescription: stripHtml(row.content, 120) || 'Open task on Gibwork.',
          description: stripHtml(row.content, 1200),
          imageUrl: first(row.user?.profilePicture),
          creatorAvatarUrl: first(row.user?.profilePicture),
          rewardLabel: amount != null ? `${Number(amount).toLocaleString()} ${symbol || ''}`.trim() : undefined,
          deadline: formatDeadline(row.deadline),
          tags: Array.isArray(row.tags) ? row.tags.map(text).filter(Boolean) : [],
          isFeatured: Boolean(row.isFeatured),
        }
      })
    return { available: true, opportunities, hasMore: page < lastPage }
  } catch {
    return { available: false, opportunities: [], hasMore: false }
  }
}

async function optionalProvider(_source: 'Galxe' | 'Dework'): Promise<ProviderResult> {
  // Adapter placeholder — reports pending instead of fabricating data.
  return { available: false, opportunities: [], hasMore: false }
}

// Interleave provider results so the feed feels aggregated rather than grouped.
function interleave(groups: DiscoveryOpportunity[][]) {
  const merged: DiscoveryOpportunity[] = []
  const max = Math.max(0, ...groups.map((group) => group.length))
  for (let index = 0; index < max; index += 1) {
    for (const group of groups) if (group[index]) merged.push(group[index])
  }
  return merged
}

export async function getDiscoveryOpportunities(
  page = 1,
  limit = 24,
): Promise<{ opportunities: DiscoveryOpportunity[]; providers: Record<string, boolean>; hasMore: boolean }> {
  const half = Math.max(6, Math.ceil(limit / 2))
  const [superteamResult, gibworkResult, galxeResult, deworkResult] = await Promise.all([
    superteam(page, half),
    gibwork(page, half),
    optionalProvider('Galxe'),
    optionalProvider('Dework'),
  ])

  const seen = new Set<string>()
  const opportunities = interleave([superteamResult.opportunities, gibworkResult.opportunities]).filter((item) => {
    if (seen.has(item.id)) return false
    seen.add(item.id)
    return true
  })

  return {
    opportunities,
    providers: {
      superteam: superteamResult.available,
      gibwork: gibworkResult.available,
      galxe: galxeResult.available,
      dework: deworkResult.available,
    },
    hasMore: superteamResult.hasMore || gibworkResult.hasMore,
  }
}
