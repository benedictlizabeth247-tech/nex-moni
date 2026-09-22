"use client"

import { ChevronRight } from "lucide-react"
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

function PlatformCard({ platform }: { platform: PartnerPlatform }) {
  return <div className="group flex min-h-[78px] items-center gap-3 rounded-2xl border border-[#d9d0c8] bg-[#eee9e3] px-3.5 py-3 transition-colors hover:border-[#b9998e] sm:gap-4 sm:px-4">
    <a href={platform.route} aria-label={`Explore ${platform.name}`}><PlatformLogo platform={platform} /></a>
    <a href={platform.route} className="min-w-0 flex-1">
      <div className="flex min-w-0 items-center gap-2"><h3 className="truncate text-[15px] font-semibold tracking-[-0.01em] text-[#302b29]">{platform.name}</h3><span className="hidden truncate rounded-full border border-[#d2c5bc] px-2 py-0.5 text-[9px] font-medium tracking-[0.06em] text-[#786c66] sm:inline-flex">{platform.relationship}</span></div>
      <p className="mt-1 truncate text-xs leading-[1.45] text-[#726861]">{platform.description}</p>
      <span className="mt-1 block truncate text-[10px] text-[#988b83]">{platform.category}</span>
    </a>
    <a href={platform.route} aria-label={`Explore ${platform.name}`} className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-2 text-[11px] font-medium text-[#a6534a] transition-transform group-hover:translate-x-0.5">Explore <ChevronRight size={17} /></a>
  </div>
}

export function PartnerNetwork() {
  return <section aria-labelledby="partner-network-title" className="mt-10 rounded-[26px] border border-[#d9d0c8] bg-[#e5dfd8] p-4 sm:p-6">
    <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div className="max-w-xl"><p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[#a6534a]">Partner Network</p><h2 id="partner-network-title" className="mt-2 text-[20px] font-semibold leading-[1.18] tracking-[-0.02em] text-[#302b29] sm:text-[22px]">Explore More Ways to Earn</h2><p className="mt-2 max-w-[560px] text-[13px] leading-[1.55] text-[#625852]">NexMonie brings together trusted work, contributor, bounty, quest and Web3 ecosystems so you can discover more opportunities from one place.</p></div><EcosystemMotif /></div>
    <div className="mt-5 space-y-2.5">{partnerPlatforms.map((platform) => <PlatformCard key={platform.id} platform={platform} />)}</div>
    <p className="mt-5 text-center text-[11px] text-[#8a7d75]">More ecosystems are being added to the NexMonie Earn network.</p>
    <div className="mt-6 border-t border-[#d2c7bf] pt-5 text-[11px] leading-[1.6] text-[#6f625b]">
      <h3 className="font-semibold text-[#3e3632]">Third-Party Platforms</h3>
      <p className="mt-1.5">Platforms shown here are independently operated third parties. Inclusion does not necessarily mean endorsement, sponsorship or official partnership. Any affiliate or referral relationship will be disclosed where applicable. Review each platform&apos;s own terms and policies before continuing.</p>
      <p className="mt-2 text-[#8a7d75]">Select <span className="font-medium text-[#6f625b]">Explore</span> to continue to a platform.</p>
    </div>
  </section>
}
