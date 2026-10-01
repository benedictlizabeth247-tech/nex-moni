"use client"

import { useMemo, useState } from "react"
import { ArrowUpRight, Search, SlidersHorizontal } from "lucide-react"
import { BottomNav } from "@/components/layout/BottomNav"

type Extension = { name: string; category: string; description: string; url: string; domain: string }

const extensions: Extension[] = [
  { name: "Chrome", category: "Browsers", description: "Fast web browsing", url: "https://www.google.com/chrome/", domain: "google.com" },
  { name: "Phoenix", category: "Browsers", description: "Private mobile browsing", url: "https://www.phoenix-browser.com/", domain: "phoenix-browser.com" },
  { name: "DuckDuckGo", category: "Browsers", description: "Search without tracking", url: "https://duckduckgo.com/", domain: "duckduckgo.com" },
  { name: "Opera Mini", category: "Browsers", description: "Lightweight web access", url: "https://www.opera.com/mini", domain: "opera.com" },
  { name: "Bybit", category: "Exchanges", description: "Digital asset markets", url: "https://www.bybit.com/", domain: "bybit.com" },
  { name: "Binance", category: "Exchanges", description: "Global crypto exchange", url: "https://www.binance.com/", domain: "binance.com" },
  { name: "OKX", category: "Exchanges", description: "Trade crypto globally", url: "https://www.okx.com/", domain: "okx.com" },
  { name: "ChatGPT", category: "AI", description: "Explore ideas with AI", url: "https://chatgpt.com/", domain: "chatgpt.com" },
  { name: "Gemini", category: "AI", description: "Google's AI assistant", url: "https://gemini.google.com/", domain: "gemini.google.com" },
  { name: "Claude", category: "AI", description: "Thoughtful AI assistance", url: "https://claude.ai/", domain: "claude.ai" },
  { name: "X", category: "Social", description: "What is happening now", url: "https://x.com/", domain: "x.com" },
  { name: "Coinbase", category: "Social", description: "Simple crypto access", url: "https://www.coinbase.com/", domain: "coinbase.com" },
  { name: "Spotify", category: "Media", description: "Music for every moment", url: "https://open.spotify.com/", domain: "spotify.com" },
  { name: "YouTube", category: "Media", description: "Watch and discover", url: "https://www.youtube.com/", domain: "youtube.com" },
]

export default function ExtensionsPage() {
  const [query, setQuery] = useState("")
  const visible = useMemo(() => extensions.filter((item) => `${item.name} ${item.category} ${item.description}`.toLowerCase().includes(query.toLowerCase())), [query])
  const categories = [...new Set(visible.map((item) => item.category))]
  const searchWeb = (event: React.FormEvent) => { event.preventDefault(); if (query.trim()) window.open(`https://www.google.com/search?q=${encodeURIComponent(query.trim())}`, "_blank", "noopener,noreferrer") }

  return <main className="min-h-screen bg-[#f4efeb] pb-28 text-[#302825]">
    <header className="border-b border-[#e5dad4] bg-[#f8f4f0] px-4 pb-5 pt-6">
      <div className="mx-auto max-w-2xl"><div className="flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.22em] text-[#9b7169]">The 3rd Exchange</p><h1 className="mt-1 text-2xl font-black tracking-tight">Extensions</h1></div><button aria-label="Extension controls" className="grid size-10 place-items-center rounded-xl border border-[#ded2cc] bg-[#fffdfa]"><SlidersHorizontal size={17}/></button></div>
        <form onSubmit={searchWeb} className="mt-5 flex items-center gap-2 rounded-2xl border border-[#ded2cc] bg-[#fffdfa] p-2 shadow-sm"><Search size={17} className="ml-2 text-[#907c75]"/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search the web or extensions" aria-label="Search the web or extensions" className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm outline-none placeholder:text-[#aa9a92]"/><button type="submit" className="rounded-xl bg-[#302825] px-3 py-2 text-xs font-bold text-white">Search</button></form>
      </div>
    </header>
    <div className="mx-auto max-w-2xl px-4 py-5">{categories.map((category) => <section key={category} className="mb-6"><div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-black">{category}</h2><span className="text-[10px] font-semibold text-[#a0877f]">{visible.filter((item) => item.category === category).length} apps</span></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{visible.filter((item) => item.category === category).map((item) => <a key={item.name} href={item.url} target="_blank" rel="noopener noreferrer" className="group rounded-2xl border border-[#e5dad4] bg-[#fffdfa] p-3 transition hover:-translate-y-0.5 hover:border-[#d77b70] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d77b70]"><div className="flex items-start justify-between gap-2"><img src={`https://www.google.com/s2/favicons?domain=${item.domain}&sz=64`} alt="" className="size-9 rounded-xl" loading="lazy"/><ArrowUpRight size={14} className="text-[#a0877f] transition group-hover:text-[#d77b70]"/></div><p className="mt-3 text-sm font-black">{item.name}</p><p className="mt-1 text-[10px] leading-4 text-[#8f7c75]">{item.description}</p></a>)}</div></section>)}{visible.length === 0 && <p className="rounded-2xl border border-dashed border-[#d7c9c2] bg-[#fffdfa] p-6 text-center text-sm text-[#8f7c75]">No extensions match your search.</p>}</div><BottomNav/></main>
}
