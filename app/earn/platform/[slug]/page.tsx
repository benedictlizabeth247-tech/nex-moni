import { ArrowLeft, ArrowUpRight } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { BottomNav } from "@/components/layout/BottomNav"
import { NexLogo } from "@/components/ui/NexLogo"
import { partnerPlatforms } from "@/components/earn/partner-network-data"

export function generateStaticParams() {
  return partnerPlatforms.map((platform) => ({ slug: platform.slug }))
}

export default async function PartnerPlatformPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const platform = partnerPlatforms.find((item) => item.slug === slug)
  if (!platform) notFound()

  return <main className="min-h-screen bg-[#e5dfd8] pb-28 text-[#302b29]"><header className="border-b border-[#d9d0c8] bg-[#eee9e3] px-6 pb-5 pt-6"><div className="flex items-center justify-between"><Link href="/earn" aria-label="Back to Earn" className="rounded-xl p-2 text-[#786c66] hover:bg-[#e2d9d1]"><ArrowLeft size={19} /></Link><NexLogo /></div></header><section className="mx-auto max-w-2xl px-6 pt-8"><div className="flex items-center gap-4"><div className="flex size-16 items-center justify-center rounded-2xl border border-[#d9d0c8] bg-[#f0ebe5] p-3"><img src={platform.logoUrl} alt={`${platform.name} logo`} className="max-h-full max-w-full object-contain" /></div><div><p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[#a6534a]">{platform.category}</p><h1 className="mt-1 text-2xl font-semibold tracking-[-0.02em]">{platform.name}</h1></div></div><div className="mt-7 rounded-3xl border border-[#d9d0c8] bg-[#eee9e3] p-5"><p className="text-sm leading-6 text-[#625852]">{platform.extendedDescription}</p><div className="mt-5 flex items-center justify-between rounded-2xl border border-[#d9d0c8] bg-[#e5dfd8] px-4 py-3 text-xs"><span className="text-[#8a7d75]">Relationship</span><span className="font-medium">{platform.relationship}</span></div><a href={platform.officialUrl} target="_blank" rel="noopener noreferrer" className="mt-5 flex h-12 items-center justify-center gap-2 rounded-xl bg-[#a6534a] text-sm font-medium text-[#fff8f2]">Continue to {platform.name} <ArrowUpRight size={16} /></a></div><p className="mt-5 text-center text-xs leading-5 text-[#8a7d75]">You are leaving NexMonie to visit the official {platform.name} platform.</p></section><BottomNav /></main>
}
