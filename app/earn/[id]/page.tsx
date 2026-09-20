import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ExternalLink, Globe2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { getDiscoveryOpportunity } from '@/services/discovery'

export const dynamic = 'force-dynamic'

export default async function OpportunityProfile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const item = await getDiscoveryOpportunity(id)
  if (!item) notFound()
  const destination = item.applicationUrl || item.sourceUrl
  const tags = [item.category, item.opportunityType, ...item.tags].filter(Boolean)

  return (
    <main className="min-h-screen bg-background px-6 pb-16 pt-6">
      <div className="mx-auto max-w-3xl">
        <Link href="/earn" className="inline-flex items-center gap-2 text-sm font-semibold text-gray-500"><ArrowLeft size={16} /> Back to Discovery</Link>
        <section className="mt-6 rounded-3xl border border-gray-100 bg-white p-6 shadow-nex-soft sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-gray-50">
                {item.imageUrl ? <img src={item.imageUrl} alt={`${item.organizationName} logo`} className="h-full w-full object-cover" /> : <Globe2 className="text-gray-300" />}
              </div>
              <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-accent">{item.source}</p><p className="mt-1 text-sm text-gray-500">{item.organizationName}</p></div>
            </div>
            <Badge variant="outline" className="rounded-full">{item.verificationStatus}</Badge>
          </div>
          <h1 className="mt-7 text-3xl font-bold leading-tight text-foreground">{item.title}</h1>
          <div className="mt-4 flex flex-wrap gap-2">{tags.map((tag) => <Badge key={tag} variant="secondary" className="rounded-full">{tag}</Badge>)}</div>
          <div className="mt-8 grid gap-5 border-y border-gray-100 py-6 sm:grid-cols-3">
            <div><p className="text-xs text-gray-400">Reward</p><p className="mt-1 text-sm font-semibold">{item.rewardLabel || 'Not provided by source'}</p></div>
            <div><p className="text-xs text-gray-400">Deadline</p><p className="mt-1 text-sm font-semibold">{item.deadline ? new Date(item.deadline).toLocaleString() : 'No deadline provided'}</p></div>
            <div><p className="text-xs text-gray-400">Location</p><p className="mt-1 text-sm font-semibold">{item.remote ? 'Remote' : item.location || 'Not provided by source'}</p></div>
          </div>
          <div className="mt-8"><h2 className="text-base font-bold">Opportunity details</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-gray-600">{item.description || item.shortDescription || 'The source did not provide a description.'}</p></div>
          <div className="mt-8 flex flex-wrap gap-3">
            <a className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground" href={destination} target="_blank" rel="noopener noreferrer">Apply on {item.source} <ExternalLink size={15} /></a>
            {item.projectWebsiteUrl && <a className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 text-sm font-semibold" href={item.projectWebsiteUrl} target="_blank" rel="noopener noreferrer">Project website <ExternalLink size={15} /></a>}
            {item.projectProfileUrl && <a className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 text-sm font-semibold" href={item.projectProfileUrl} target="_blank" rel="noopener noreferrer">Project profile <ExternalLink size={15} /></a>}
            {item.sourceProfileUrl && <a className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 text-sm font-semibold" href={item.sourceProfileUrl} target="_blank" rel="noopener noreferrer">Source profile <ExternalLink size={15} /></a>}
          </div>
          <p className="mt-5 text-xs text-gray-400">Original source: <a className="underline" href={item.sourceUrl} target="_blank" rel="noopener noreferrer">{item.sourceUrl}</a></p>
        </section>
      </div>
    </main>
  )
}
