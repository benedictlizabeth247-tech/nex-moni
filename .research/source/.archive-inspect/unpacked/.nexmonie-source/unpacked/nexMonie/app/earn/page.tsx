"use client"

import { useEffect, useMemo, useState } from "react"
import { ArrowLeft, Bell, ChevronRight, Clock3, ExternalLink, Globe2, Search, SlidersHorizontal, User, X } from "lucide-react"
import { BottomNav } from "@/components/layout/BottomNav"
import { NexLogo } from "@/components/ui/NexLogo"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useUser } from "@/supabase"
import type { DiscoveryOpportunity } from "@/services/discovery"

const categories = ["All", "Bounty", "Project", "Job", "Grant", "Development", "Design", "Content", "Community", "Growth", "Other"]

export default function EarnScreen() {
  const { user } = useUser()
  const [items, setItems] = useState<DiscoveryOpportunity[]>([])
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState("All")
  const [selected, setSelected] = useState<DiscoveryOpportunity | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)

  async function load(nextPage = 1) {
    nextPage === 1 ? setLoading(true) : setLoadingMore(true)
    setError(false)
    try {
      const response = await fetch(`/api/discovery?page=${nextPage}&limit=24`, { cache: "no-store" })
      if (!response.ok) throw new Error()
      const data = await response.json()
      const incoming: DiscoveryOpportunity[] = data.opportunities ?? []
      // Only treat as an error when every provider is down and we have nothing to show.
      if (nextPage === 1 && incoming.length === 0 && data.available === false) throw new Error()
      setItems((current) => nextPage === 1 ? incoming : [...current, ...incoming.filter((item: DiscoveryOpportunity) => !current.some((old) => old.id === item.id))])
      setPage(nextPage)
      setHasMore(Boolean(data.hasMore))
    } catch { if (nextPage === 1) setError(true) } finally { setLoading(false); setLoadingMore(false) }
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => items.filter((item) => {
    const haystack = [item.title, item.organizationName, item.shortDescription, item.category, ...item.tags].join(" ").toLowerCase()
    const matchesQuery = !query.trim() || haystack.includes(query.toLowerCase().trim())
    const matchesCategory = category === "All" || item.category.toLowerCase() === category.toLowerCase() || item.tags.some((tag) => tag.toLowerCase() === category.toLowerCase())
    return matchesQuery && matchesCategory
  }), [items, query, category])

  return (
    <main className="min-h-screen bg-background pb-28">
      <header className="sticky top-0 z-30 border-b border-gray-100 bg-white/95 px-6 pb-5 pt-6 backdrop-blur">
        <div className="mb-6 flex items-center justify-between"><NexLogo /><div className="flex items-center gap-4"><Bell size={21} className="text-foreground" /><div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-gray-100 bg-gray-50"><User size={18} className="text-gray-300" /></div></div></div>
        <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.18em] text-accent">Opportunity marketplace</p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Discovery</h1>
        <p className="mt-2 max-w-sm text-sm leading-6 text-gray-500">Find real projects, bounties and ways to contribute across the open internet.</p>
      </header>

      <section className="px-6 pt-5">
        <div className="relative"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={17} /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search opportunities..." className="h-12 rounded-2xl border-gray-100 bg-white pl-11 shadow-nex-soft" /></div>
        <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">{categories.map((item) => <button key={item} onClick={() => setCategory(item)} className={`shrink-0 rounded-full border px-4 py-2 text-[11px] font-bold transition-colors ${category === item ? "border-primary bg-primary text-white" : "border-gray-100 bg-white text-gray-500"}`}>{item}</button>)}</div>
      </section>

      <section className="px-6 pt-7">
        <div className="mb-4 flex items-end justify-between"><div><h2 className="text-lg font-bold text-foreground">Open opportunities</h2><p className="mt-1 text-xs text-gray-400">Live listings from verified sources</p></div><SlidersHorizontal size={18} className="text-gray-400" /></div>
        {loading ? <div className="space-y-3">{[1,2,3,4].map((item) => <Skeleton key={item} className="h-32 w-full rounded-2xl" />)}</div> : error ? <div className="rounded-2xl border border-gray-100 bg-white p-6 text-center"><p className="text-sm font-semibold text-foreground">Discovery is temporarily unavailable.</p><p className="mt-1 text-xs text-gray-500">Try again to refresh the live sources.</p><Button onClick={() => load()} variant="outline" className="mt-4 rounded-xl">Try again</Button></div> : filtered.length === 0 ? <div className="rounded-2xl border border-gray-100 bg-white p-6 text-center"><Globe2 className="mx-auto text-gray-300" size={28} /><p className="mt-3 text-sm font-semibold text-foreground">No opportunities found</p><p className="mt-1 text-xs text-gray-500">Try another search or category.</p></div> : <div className="space-y-3">{filtered.map((item) => <OpportunityCard key={item.id} item={item} onClick={() => setSelected(item)} />)}</div>}
        {!loading && !error && hasMore && filtered.length > 0 && <Button onClick={() => load(page + 1)} disabled={loadingMore} variant="outline" className="mt-5 w-full rounded-xl">{loadingMore ? "Loading more..." : "Load more opportunities"}</Button>}
      </section>

      <BottomNav />
      {selected && <OpportunityDetail item={selected} onClose={() => setSelected(null)} />}
    </main>
  )
}

function OpportunityCard({ item, onClick }: { item: DiscoveryOpportunity; onClick: () => void }) {
  return <button onClick={onClick} className="flex w-full items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 text-left shadow-nex-soft transition-transform active:scale-[.99]">
    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-50">{item.imageUrl ? <img src={item.imageUrl} alt="" className="h-full w-full object-cover" /> : <Globe2 size={22} className="text-gray-300" />}</div>
    <div className="min-w-0 flex-1"><div className="mb-1 flex items-center gap-2"><span className="truncate text-[10px] font-bold uppercase tracking-wider text-accent">{item.source}</span>{item.creatorAvatarUrl && <img src={item.creatorAvatarUrl} alt="" className="h-4 w-4 rounded-full object-cover" />}</div><h3 className="truncate text-sm font-bold text-foreground">{item.title}</h3><p className="mt-1 truncate text-xs text-gray-500">{item.organizationName} · {item.category}</p><div className="mt-2 flex items-center gap-3 text-[10px] text-gray-400">{item.rewardLabel && <span className="font-semibold text-primary">{item.rewardLabel}</span>}{item.deadline && <span className="flex items-center gap-1"><Clock3 size={11} /> {item.deadline}</span>}</div></div><ChevronRight size={18} className="shrink-0 text-gray-300" />
  </button>
}

function OpportunityDetail({ item, onClose }: { item: DiscoveryOpportunity; onClose: () => void }) {
  return <div className="fixed inset-0 z-[60] overflow-y-auto bg-background"><div className="mx-auto min-h-screen max-w-screen-md bg-background"><header className="flex items-center justify-between border-b border-gray-100 bg-white px-6 py-5"><button onClick={onClose} aria-label="Close"><ArrowLeft size={20} /></button><span className="text-xs font-bold uppercase tracking-widest text-gray-400">Opportunity</span><button onClick={onClose} aria-label="Close"><X size={20} className="text-gray-400" /></button></header><div className="px-6 pb-12 pt-6"><div className="mb-6 flex h-40 items-center justify-center overflow-hidden rounded-2xl bg-gray-50">{item.imageUrl ? <img src={item.imageUrl} alt="" className="h-full w-full object-cover" /> : <Globe2 size={38} className="text-gray-300" />}</div><span className="text-[10px] font-bold uppercase tracking-[0.16em] text-accent">{item.source}</span><h1 className="mt-2 text-2xl font-bold leading-tight text-foreground">{item.title}</h1><p className="mt-2 text-sm text-gray-500">{item.organizationName}</p><div className="mt-5 flex flex-wrap gap-2">{[item.category, ...item.tags.slice(0, 3)].map((tag) => <Badge key={tag} variant="outline" className="rounded-full text-[10px]">{tag}</Badge>)}</div><div className="mt-8 space-y-6"><div><h2 className="text-sm font-bold text-foreground">About</h2><p className="mt-2 whitespace-pre-line text-sm leading-6 text-gray-600">{item.description || item.shortDescription}</p></div>{item.rewardLabel && <div><h2 className="text-sm font-bold text-foreground">Compensation</h2><p className="mt-2 text-sm text-gray-600">{item.rewardLabel}</p></div>}{item.deadline && <div><h2 className="text-sm font-bold text-foreground">Deadline</h2><p className="mt-2 text-sm text-gray-600">{item.deadline}</p></div>}</div><Button asChild className="mt-9 h-12 w-full rounded-xl"><a href={item.sourceUrl} target="_blank" rel="noreferrer">View on {item.source}<ExternalLink size={16} /></a></Button></div></div></div>
}
