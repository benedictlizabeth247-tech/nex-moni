import Link from 'next/link'
import { ArrowUpRight, ChevronRight, Network } from 'lucide-react'
import { earnPlatforms } from '@/data/earn-platforms'

export function PartnerNetwork() {
  return (
    <section className="mt-12 rounded-[28px] border border-[#D9D1CC] bg-[#EDEAE6] p-5 shadow-[0_10px_30px_rgba(93,78,70,.05)] sm:p-7" aria-labelledby="partner-network-heading">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)] lg:items-end">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9B5B52]">Partner Network</p>
          <h2 id="partner-network-heading" className="mt-2 text-[22px] font-semibold leading-[1.18] tracking-[-0.02em] text-[#343536] sm:text-2xl">Explore More Ways to Earn</h2>
          <p className="mt-3 max-w-xl text-[13px] leading-6 text-[#696664]">NexMonie brings together trusted work, contributor, bounty, quest and Web3 ecosystems so you can discover more opportunities from one place.</p>
        </div>
        <div className="relative hidden min-h-24 items-center justify-center overflow-hidden rounded-2xl border border-[#D9D1CC] bg-[#E7E3DE] px-5 lg:flex" aria-label="NexMonie gateway to partner ecosystems">
          <div className="flex items-center gap-3 text-[#9B5B52]"><Network size={18} strokeWidth={1.7} /><span className="text-[10px] font-semibold uppercase tracking-[0.12em]">nexMonie</span><span className="h-px w-12 bg-[#C9BDB7]" aria-hidden="true" /><div className="flex -space-x-1.5">{earnPlatforms.slice(0, 5).map((platform) => <span key={platform.platformId} className="flex h-7 w-7 items-center justify-center rounded-full border border-[#D9D1CC] bg-[#F1EFEC] p-1.5"><img src={platform.logoUrl} alt="" className="h-full w-full object-contain" /></span>)}</div></div>
        </div>
      </div>
      <div className="mt-7 space-y-2.5">{earnPlatforms.map((platform) => <Link key={platform.platformId} href={platform.route} className="group flex min-h-[78px] items-center gap-3 rounded-2xl border border-[#D9D1CC] bg-[#F3F1EE] px-3.5 py-3 transition-colors hover:border-[#BDA49B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9B5B52] sm:px-4"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] border border-[#D9D1CC] bg-[#EAE7E3] p-2.5"><img src={platform.logoUrl} alt={`${platform.name} logo`} className="h-full w-full object-contain" /></span><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><span className="text-[15px] font-semibold leading-tight text-[#343536]">{platform.name}</span><span className="rounded-full border border-[#D5C7C1] bg-[#EEE8E4] px-2 py-0.5 text-[9px] font-medium tracking-[0.06em] text-[#795B53]">{platform.relationshipStatus}</span></span><span className="mt-1 block truncate text-[12px] leading-5 text-[#696664]">{platform.description}</span><span className="mt-0.5 block text-[10px] text-[#918A86]">{platform.category}</span></span><span className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-[#8D554D]"><span className="hidden sm:inline">Explore</span><ChevronRight size={17} className="transition-transform group-hover:translate-x-0.5" /></span></Link>)}</div>
      <p className="mt-6 flex items-center justify-center gap-1 text-center text-[11px] text-[#918A86]">More ecosystems are being added to the NexMonie Earn network. <ArrowUpRight size={13} /></p>
    </section>
  )
}
