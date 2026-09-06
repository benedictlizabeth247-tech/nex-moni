"use client"

/**
 * @fileOverview Asset Detail screen.
 *
 * Every value on this screen is served by the Market Data Service through
 * `/api/market/*`. Nothing is hardcoded and no provider is called directly.
 */

import React, { useMemo, useState } from 'react'
import Image from 'next/image'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Star, TrendingUp, TrendingDown, ExternalLink } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { BottomNav } from '@/components/layout/BottomNav'
import {
  useAssetDetail,
  useCandles,
  useOrderBook,
  useRecentTrades,
} from '@/hooks/use-market-data'
import { getWatchlist, toggleWatchlist } from '@/services/watchlistService'
import { useUser } from '@/supabase'
import {
  formatQuotePrice,
  formatPercent,
  formatChange,
  formatCompact,
  formatMoneyCompact,
  formatClock,
  formatRelative,
  formatPrice,
} from '@/lib/market-format'
import { CATEGORY_LABEL, type Timeframe } from '@/services/market-data/types'
import { TIMEFRAMES } from '@/services/market-data/symbols'
import { cn } from '@/lib/utils'
import { CandleChart } from './candle-chart'

export default function AssetDetailScreen() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = useMemo(() => {
    const raw = params?.id
    const value = Array.isArray(raw) ? raw[0] : raw
    return value ? decodeURIComponent(value) : null
  }, [params])

  const { user } = useUser()
  const userId = user?.id ?? null

  const [timeframe, setTimeframe] = useState<Timeframe>('1D')
  const [favorites, setFavorites] = useState<string[]>(() => getWatchlist(userId))

  // Recompute once the session resolves so favorites always match the signed-in user.
  React.useEffect(() => {
    setFavorites(getWatchlist(userId))
  }, [userId])

  const { detail, quote, isLoading, isLive, isOffline, error } = useAssetDetail(id)
  const { candles, provider: chartProvider, isLoading: chartLoading, error: chartError } =
    useCandles(id, timeframe)

  const supportsBook = Boolean(detail?.capabilities.orderBook)
  const supportsTrades = Boolean(detail?.capabilities.trades)
  const { book } = useOrderBook(id, { enabled: supportsBook })
  const trades = useRecentTrades(id, { enabled: supportsTrades })

  const isFavorite = id ? favorites.includes(id) : false
  const up = (quote?.changePercent ?? 0) >= 0

  return (
    <main className="min-h-screen pb-40 bg-background">
      <header className="px-6 pt-10 pb-5 bg-white sticky top-0 z-40 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.back()}
            aria-label="Go back"
            className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center"
          >
            <ArrowLeft size={18} className="text-slate-700" />
          </button>

          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#F4EEEC]">
              {quote?.iconUrl ? <Image src={quote.iconUrl} alt="" width={30} height={30} className="h-7 w-7 object-contain" unoptimized /> : <span className="text-[9px] font-black text-[#7A5E58]">{quote?.symbol?.slice(0,3)}</span>}
            </div>
            <div className="min-w-0 text-left">
              <h1 className="truncate text-[15px] font-black text-slate-900">{quote?.display ?? '—'}</h1>
              <p className="truncate text-[10px] text-gray-500">
                {quote ? CATEGORY_LABEL[quote.type] : 'Market'}
                {quote?.exchange ? ` · ${quote.exchange}` : ''}
              </p>
            </div>
          </div>

          <button
            onClick={() => id && setFavorites(toggleWatchlist(id, userId))}
            aria-label={isFavorite ? 'Remove from watchlist' : 'Add to watchlist'}
            className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center"
          >
            <Star
              size={18}
              className={cn(isFavorite ? 'text-[#FF8882]' : 'text-gray-400')}
              fill={isFavorite ? '#FF8882' : 'none'}
            />
          </button>
        </div>
      </header>

      <div className="px-6 py-6 space-y-8">
        {/* Price header */}
        <section>
          {isLoading && !quote ? (
            <div className="space-y-2">
              <Skeleton className="h-9 w-40" />
              <Skeleton className="h-4 w-32" />
            </div>
          ) : quote ? (
            <>
              <div className="flex items-end gap-3">
                <p className="text-[32px] font-bold text-slate-900 leading-none">
                  {formatQuotePrice(quote)}
                </p>
                <span
                  className={cn(
                    'flex items-center gap-1 text-[14px] font-bold pb-1',
                    up ? 'text-[#008D83]' : 'text-[#FF8882]',
                  )}
                >
                  {up ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  {formatPercent(quote.changePercent)}
                </span>
              </div>
              <p className="text-[12px] text-gray-500 mt-2">
                {formatChange(quote.change, quote.currency)} today ·{' '}
                <span className={isLive ? 'text-[#008D83]' : 'text-gray-400'}>
                  {isOffline
                    ? 'Offline'
                    : isLive
                      ? 'Live'
                      : quote.stale
                        ? 'Delayed'
                        : formatRelative(quote.timestamp)}
                </span>
                {' · '}
                {quote.provider}
              </p>
            </>
          ) : (
            <p className="text-[13px] text-gray-500">{error ?? 'Market data unavailable'}</p>
          )}
        </section>

        {/* Chart */}
        <section>
          <div className="flex items-center gap-1.5 mb-4 overflow-x-auto scrollbar-hide">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-[12px] font-bold shrink-0 transition-colors',
                  tf === timeframe
                    ? 'bg-[#008D83] text-white'
                    : 'bg-white text-slate-600 border border-gray-100',
                )}
              >
                {tf}
              </button>
            ))}
          </div>

          <Card className="p-4 rounded-[24px] border-none shadow-sm">
            {chartLoading && !candles.length ? (
              <Skeleton className="h-56 w-full rounded-2xl" />
            ) : candles.length ? (
              <>
                <CandleChart candles={candles} up={up} />
                {chartProvider && (
                  <p className="text-[10px] text-gray-400 mt-2 text-right">
                    Source: {chartProvider}
                  </p>
                )}
              </>
            ) : (
              <div className="h-56 flex items-center justify-center">
                <p className="text-[13px] text-gray-500">
                  {chartError ?? 'Chart data unavailable'}
                </p>
              </div>
            )}
          </Card>
        </section>

        {/* Key statistics */}
        {quote && (
          <section>
            <h2 className="text-[18px] font-bold text-slate-900 mb-4">Statistics</h2>
            <Card className="p-4 rounded-[24px] border-none shadow-sm">
              <StatRow label="Open" value={statPrice(quote.open, quote.currency)} />
              <StatRow label="High" value={statPrice(quote.high, quote.currency)} />
              <StatRow label="Low" value={statPrice(quote.low, quote.currency)} />
              <StatRow
                label="Prev. close"
                value={statPrice(quote.previousClose, quote.currency)}
              />
              <StatRow label="Volume" value={formatCompact(quote.volume)} />
              <StatRow label="Market cap" value={formatMoneyCompact(quote.marketCap)} />
            </Card>
          </section>
        )}

        {/* Order book (crypto) */}
        {supportsBook && book && (book.bids.length > 0 || book.asks.length > 0) && (
          <section>
            <h2 className="text-[18px] font-bold text-slate-900 mb-4">Order Book</h2>
            <Card className="p-4 rounded-[24px] border-none shadow-sm">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-[11px] font-bold text-gray-400 uppercase mb-2">Bids</p>
                  {book.bids.slice(0, 8).map((level, i) => (
                    <div key={`b-${i}`} className="flex justify-between text-[12px] py-1">
                      <span className="text-[#008D83] font-bold">
                        {formatPrice(level.price, '')}
                      </span>
                      <span className="text-gray-500">{formatCompact(level.size)}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="text-[11px] font-bold text-gray-400 uppercase mb-2">Asks</p>
                  {book.asks.slice(0, 8).map((level, i) => (
                    <div key={`a-${i}`} className="flex justify-between text-[12px] py-1">
                      <span className="text-[#FF8882] font-bold">
                        {formatPrice(level.price, '')}
                      </span>
                      <span className="text-gray-500">{formatCompact(level.size)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </section>
        )}

        {/* Recent trades (crypto) */}
        {supportsTrades && trades.length > 0 && (
          <section>
            <h2 className="text-[18px] font-bold text-slate-900 mb-4">Recent Trades</h2>
            <Card className="p-4 rounded-[24px] border-none shadow-sm">
              {trades.slice(0, 10).map((trade) => (
                <div key={trade.id} className="flex justify-between text-[12px] py-1.5">
                  <span
                    className={cn(
                      'font-bold',
                      trade.side === 'buy' ? 'text-[#008D83]' : 'text-[#FF8882]',
                    )}
                  >
                    {formatPrice(trade.price, '')}
                  </span>
                  <span className="text-gray-500">{formatCompact(trade.size)}</span>
                  <span className="text-gray-400">{formatClock(trade.time)}</span>
                </div>
              ))}
            </Card>
          </section>
        )}

        {/* Profile */}
        {detail?.profile && (
          <section>
            <h2 className="text-[18px] font-bold text-slate-900 mb-4">About</h2>
            <Card className="p-4 rounded-[24px] border-none shadow-sm">
              <h3 className="font-bold text-slate-900 mb-1">{detail.profile.name}</h3>
              {detail.profile.sector && (
                <p className="text-[11px] text-gray-400 uppercase mb-3">
                  {detail.profile.sector}
                  {detail.profile.industry ? ` · ${detail.profile.industry}` : ''}
                </p>
              )}
              {detail.profile.description && (
                <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
                  {detail.profile.description}
                </p>
              )}
              {detail.profile.metrics.map((metric) => (
                <StatRow key={metric.label} label={metric.label} value={metric.value} />
              ))}
            </Card>
          </section>
        )}

        {/* Headlines */}
        {detail?.headlines?.length ? (
          <section>
            <h2 className="text-[18px] font-bold text-slate-900 mb-4">News</h2>
            <div className="space-y-3">
              {detail.headlines.slice(0, 6).map((headline) => (
                <a
                  key={headline.id}
                  href={headline.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <Card className="p-4 rounded-[24px] border-none shadow-sm">
                    <p className="text-[13px] font-bold text-slate-900 leading-snug mb-1 text-pretty">
                      {headline.title}
                    </p>
                    <p className="text-[11px] text-gray-400 flex items-center gap-1">
                      {headline.publisher} · {formatRelative(headline.time)}
                      <ExternalLink size={10} />
                    </p>
                  </Card>
                </a>
              ))}
            </div>
          </section>
        ) : null}
      </div>

      <BottomNav />
    </main>
  )
}

const statPrice = (value: number | undefined, currency: string) =>
  value === undefined || !Number.isFinite(value) ? '—' : formatPrice(value, currency)

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-gray-50 last:border-none">
      <span className="text-[13px] text-gray-500">{label}</span>
      <span className="text-[13px] font-bold text-slate-900">{value}</span>
    </div>
  )
}
