"use client"

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { ChevronLeft, TrendingDown, TrendingUp } from 'lucide-react'
import { BottomNav } from '@/components/layout/BottomNav'
import { useMarketBoard } from '@/hooks/use-market-data'
import { formatPercent, formatQuotePrice } from '@/lib/market-format'

export default function MarketsOverviewPage() {
  const router = useRouter()
  const board = useMarketBoard({ trending: true, limit: 8 })

  return (
    <main className="min-h-screen bg-[#F3EEEC] pb-32">
      <header className="sticky top-0 z-30 border-b border-[#E1D5D1] bg-[#FFFDFB]/95 px-5 pb-4 pt-6 backdrop-blur">
        <div className="flex items-center justify-between">
          <button onClick={() => router.back()} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#E6DCD8] bg-[#F8F2F0]" aria-label="Go back"><ChevronLeft size={20} /></button>
          <div className="text-center"><p className="text-[8px] font-black uppercase tracking-[.18em] text-[#9A7772]">nexMonie</p><h1 className="mt-1 text-[18px] font-black text-[#342A28]">Markets</h1></div>
          <div className="w-10" />
        </div>
      </header>

      <div className="space-y-4 px-4 py-5">
        <div className="rounded-[22px] border border-[#E1D5D1] bg-[#FFFDFB] p-4">
          <p className="text-[9px] font-black uppercase tracking-[.18em] text-[#9A7772]">Live market engine</p>
          <p className="mt-1 text-[11px] leading-5 text-[#6F5C57]">Real quotes are resolved through the existing provider chain. Each instrument keeps its canonical symbol and visual identity.</p>
        </div>

        <div className="space-y-3">
          {board.quotes.map((quote) => (
            <button key={quote.id} onClick={() => router.push(`/markets/${encodeURIComponent(quote.id)}`)} className="w-full rounded-[22px] border border-[#E5D9D6] bg-[#FFFDFB] p-4 text-left shadow-[0_8px_28px_rgba(80,55,50,.05)] transition-transform active:scale-[.995]">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#F4EEEC]">
                  {quote.iconUrl ? <Image src={quote.iconUrl} alt="" width={34} height={34} className="h-8 w-8 object-contain" unoptimized /> : <span className="text-[10px] font-black text-[#7A5E58]">{quote.symbol.slice(0,3)}</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-black text-[#342A28]">{quote.display}</p>
                  <p className="mt-1 truncate text-[9px] text-[#9A7772]">{quote.name} · {quote.type}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[13px] font-black tabular-nums text-[#342A28]">{formatQuotePrice(quote)}</p>
                  <span className={`mt-1 inline-flex items-center gap-1 text-[9px] font-black ${quote.changePercent >= 0 ? 'text-[#087F5B]' : 'text-[#D86F68]'}`}>
                    {quote.changePercent >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                    {formatPercent(quote.changePercent)}
                  </span>
                </div>
              </div>
            </button>
          ))}
          {board.isLoading && !board.quotes.length && <div className="rounded-[22px] bg-[#FFFDFB] p-8 text-center text-[10px] font-bold text-[#9A7772]">Loading current market data…</div>}
          {!board.isLoading && !board.quotes.length && <div className="rounded-[22px] bg-[#FFFDFB] p-8 text-center text-[10px] font-bold text-[#9A7772]">Live market data is temporarily unavailable.</div>}
        </div>
      </div>
      <BottomNav />
    </main>
  )
}
