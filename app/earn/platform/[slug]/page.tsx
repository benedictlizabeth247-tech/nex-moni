import Link from 'next/link'
import { ArrowLeft, ArrowUpRight, Info } from 'lucide-react'
import { notFound } from 'next/navigation'
import { getEarnPlatform } from '@/data/earn-platforms'

export default async function EarnPlatformPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const platform = getEarnPlatform(slug)
  if (!platform) notFound()

  return (
    <main className="min-h-screen bg-[#F2F1EF] px-5 pb-12 pt-6 text-[#343536] sm:px-8">
      <div className="mx-auto max-w-2xl">
        <Link href="/earn" className="inline-flex items-center gap-2 text-[12px] font-medium text-[#7B706C] hover:text-[#8D554D]"><ArrowLeft size={16} /> Back to Discovery</Link>
        <section className="mt-8 rounded-[28px] border border-[#D9D1CC] bg-[#EDEAE6] p-6 shadow-[0_10px_30px_rgba(93,78,70,.05)] sm:p-8">
          <div className="flex items-start gap-4"><span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-[#D9D1CC] bg-[#E7E3DE] p-3"><img src={platform.logoUrl} alt={`${platform.name} logo`} className="h-full w-full object-contain" /></span><div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9B5B52]">{platform.category}</p><h1 className="mt-1 text-2xl font-semibold tracking-[-0.02em]">{platform.name}</h1><span className="mt-2 inline-flex rounded-full border border-[#D5C7C1] bg-[#EEE8E4] px-2 py-1 text-[9px] font-medium tracking-[0.06em] text-[#795B53]">{platform.relationshipStatus}</span></div></div>
          <p className="mt-7 text-[14px] leading-7 text-[#696664]">{platform.extendedDescription}</p>
          <div className="mt-7 rounded-2xl border border-[#D9D1CC] bg-[#F3F1EE] p-4"><div className="flex items-start gap-3"><Info size={17} className="mt-0.5 shrink-0 text-[#9B5B52]" /><div><h2 className="text-[13px] font-semibold">About this ecosystem</h2><p className="mt-1 text-[12px] leading-5 text-[#696664]">{platform.name} is included in the 3rdExchange Earn ecosystem to give users access to {platform.description.toLowerCase()} beyond opportunities surfaced directly in NexMonie.</p><p className="mt-3 text-[10px] text-[#918A86]">Relationship: {platform.relationshipStatus}</p></div></div></div>
          <a href={platform.officialUrl} target="_blank" rel="noreferrer" className="mt-7 flex h-12 items-center justify-center gap-2 rounded-xl bg-[#9B5B52] px-4 text-[13px] font-semibold text-white hover:bg-[#82483F]">{platform.name === 'MetaMask' ? 'Open MetaMask' : `Continue to ${platform.name}`}<ArrowUpRight size={16} /></a>
          <p className="mt-4 text-center text-[10px] text-[#918A86]">You are leaving 3rdExchange to open the official platform.</p>
        </section>
      </div>
    </main>
  )
}
