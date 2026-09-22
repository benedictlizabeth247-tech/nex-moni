"use client"

import { useState } from "react"
import { ArrowUpRight, ChevronRight, Info, X } from "lucide-react"
import { partnerPlatforms, type PartnerPlatform } from "./partner-network-data"

function EcosystemMotif() {
  return <div aria-label="NexMonie gateway to partner ecosystems" className="relative hidden min-h-[92px] flex-1 items-center justify-center overflow-hidden rounded-2xl border border-[#d9d0c8] bg-[#ebe6df] px-5 sm:flex">
    <div className="absolute left-5 top-1/2 h-px w-[calc(100%-2.5rem)] bg-[#c9bdb4]" />
    <div className="relative flex w-full items-center justify-between gap-3">
      <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-[#cbbcb3] bg-[#f1ede8] text-[#a6534a]"><span className="text-[10px] font-semibold tracking-[0.12em]">NEX</span></div>
      {partnerPlatforms.slice(0, 6).map((platform) => <div key={platform.id} className="relative flex size-8 shrink-0 items-center justify-center rounded-lg border border-[#d5cbc3] bg-[#f7f3ee] p-1.5"><img src={platform.logoUrl} alt="" className="max-h-full max-w-full object-contain" /></div>)}
    </div>
  </div>
}

function PlatformLogo({ platform }: { platform: PartnerPlatform }) {
  return <div className="flex size-11 shrink-0 items-center justify-center rounded-[13px] border border-[#d9d0c8] bg-[#f0ebe5] p-2.5"><img src={platform.logoUrl} alt={`${platform.name} logo`} className="max-h-full max-w-full object-contain" /></div>
}

function PlatformCard({ platform, onInfo }: { platform: PartnerPlatform; onInfo: () => void }) {
  return <div className="group flex min-h-[78px] items-center gap-3 rounded-2xl border border-[#d9d0c8] bg-[#eee9e3] px-3.5 py-3 transition-colors hover:border-[#b9998e] sm:gap-4 sm:px-4">
    <a href={platform.route} aria-label={`Explore ${platform.name}`}><PlatformLogo platform={platform} /></a>
    <a href={platform.route} className="min-w-0 flex-1">
      <div className="flex min-w-0 items-center gap-2"><h3 className="truncate text-[15px] font-semibold tracking-[-0.01em] text-[#302b29]">{platform.name}</h3><span className="hidden truncate rounded-full border border-[#d2c5bc] px-2 py-0.5 text-[9px] font-medium tracking-[0.06em] text-[#786c66] sm:inline-flex">{platform.relationship}</span></div>
      <p className="mt-1 truncate text-xs leading-[1.45] text-[#726861]">{platform.description}</p>
      <span className="mt-1 block truncate text-[10px] text-[#988b83]">{platform.category}</span>
    </a>
    <div className="flex shrink-0 items-center gap-1"><button type="button" onClick={onInfo} aria-label={`About ${platform.name}`} className="rounded-lg p-2 text-[#8f8179] transition-colors hover:bg-[#e2d9d1] hover:text-[#a6534a]"><Info size={15} /></button><a href={platform.route} aria-label={`Explore ${platform.name}`} className="rounded-lg p-2 text-[#a6534a] transition-transform group-hover:translate-x-0.5"><ChevronRight size={19} /></a></div>
  </div>
}

function PlatformInfo({ platform, onClose }: { platform: PartnerPlatform; onClose: () => void }) {
  return <div className="fixed inset-0 z-[70] flex items-end justify-center bg-[#302b29]/25 p-3 sm:items-center"><div role="dialog" aria-modal="true" aria-labelledby="partner-dialog-title" className="w-full max-w-md rounded-3xl border border-[#d9d0c8] bg-[#f1ede8] p-5 shadow-[0_20px_60px_rgba(48,43,41,.18)]"><div className="flex items-start justify-between gap-4"><div className="flex items-center gap-3"><PlatformLogo platform={platform} /><div><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#a6534a]">About this ecosystem</p><h2 id="partner-dialog-title" className="mt-1 text-lg font-semibold text-[#302b29]">{platform.name}</h2></div></div><button type="button" onClick={onClose} aria-label="Close information" className="rounded-lg p-2 text-[#786c66] hover:bg-[#e2d9d1]"><X size={17} /></button></div><p className="mt-5 text-sm leading-6 text-[#625852]">{platform.extendedDescription}</p><div className="mt-5 grid gap-3 rounded-2xl border border-[#d9d0c8] bg-[#ebe6df] p-3 text-xs"><div className="flex items-center justify-between gap-3"><span className="text-[#8a7d75]">Relationship</span><span className="font-medium text-[#3e3632]">{platform.relationship}</span></div><div className="flex items-center justify-between gap-3"><span className="text-[#8a7d75]">Source</span><span className="font-medium text-[#3e3632]">Official {platform.name}</span></div></div><a href={platform.officialUrl} target="_blank" rel="noopener noreferrer" className="mt-5 flex h-11 items-center justify-center gap-2 rounded-xl bg-[#a6534a] text-xs font-medium text-[#fff8f2]">Open Platform <ArrowUpRight size={15} /></a></div></div>
}

export function PartnerNetwork() {
  const [selected, setSelected] = useState<PartnerPlatform | null>(null)
  return <section aria-labelledby="partner-network-title" className="mt-10 rounded-[26px] border border-[#d9d0c8] bg-[#e5dfd8] p-4 sm:p-6">
    <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div className="max-w-xl"><p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[#a6534a]">Partner Network</p><h2 id="partner-network-title" className="mt-2 text-[20px] font-semibold leading-[1.18] tracking-[-0.02em] text-[#302b29] sm:text-[22px]">Explore More Ways to Earn</h2><p className="mt-2 max-w-[560px] text-[13px] leading-[1.55] text-[#625852]">NexMonie brings together trusted work, contributor, bounty, quest and Web3 ecosystems so you can discover more opportunities from one place.</p></div><EcosystemMotif /></div>
    <div className="mt-5 space-y-2.5">{partnerPlatforms.map((platform) => <PlatformCard key={platform.id} platform={platform} onInfo={() => setSelected(platform)} />)}</div>
    <p className="mt-5 text-center text-[11px] text-[#8a7d75]">More ecosystems are being added to the NexMonie Earn network.</p>
    {selected && <PlatformInfo platform={selected} onClose={() => setSelected(null)} />}
  </section>
}
