'use client'

/**
 * Client access to the Market Data Service.
 *
 * These hooks only ever hit `/api/market/*`. No component talks to an exchange
 * or data vendor directly, so providers can be swapped server-side without any
 * UI change.
 *
 * Every hook degrades gracefully: on timeout, rate limit, offline or provider
 * failure the last successful payload is kept and a status flag is exposed so
 * the existing UI can show a subtle "delayed" state instead of an error screen.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type {
  AssetDetail,
  CandleSeries,
  MarketListResult,
  OrderBook,
  Quote,
  SearchResult,
  Timeframe,
  Trade,
} from '@/services/market-data/types'

const REQUEST_TIMEOUT = 12_000

/** Fetch JSON with a hard timeout, wired to an optional external abort signal. */
async function json<T>(url: string, signal?: AbortSignal): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)
  const onAbort = () => controller.abort()
  signal?.addEventListener('abort', onAbort)

  try {
    const response = await fetch(url, { signal: controller.signal, cache: 'no-store' })
    if (!response.ok && response.status !== 200) {
      throw new Error(`${url} -> ${response.status}`)
    }
    return (await response.json()) as T
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}

const isAbort = (error: unknown) =>
  error instanceof Error && (error.name === 'AbortError' || error.message.includes('aborted'))

/* -------------------------------------------------------------------------- */
/* Online status                                                              */
/* -------------------------------------------------------------------------- */

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    setIsOnline(navigator.onLine)
    const online = () => setIsOnline(true)
    const offline = () => setIsOnline(false)
    window.addEventListener('online', online)
    window.addEventListener('offline', offline)
    return () => {
      window.removeEventListener('online', online)
      window.removeEventListener('offline', offline)
    }
  }, [])

  return isOnline
}

/* -------------------------------------------------------------------------- */
/* Live quotes (SSE + initial snapshot, polling fallback)                      */
/* -------------------------------------------------------------------------- */

export type QuoteMap = Record<string, Quote>

export function useLiveQuotes(ids: string[], options: { enabled?: boolean } = {}) {
  const { enabled = true } = options
  const key = useMemo(() => Array.from(new Set(ids)).filter(Boolean).sort().join(','), [ids])
  const [quotes, setQuotes] = useState<QuoteMap>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isLive, setIsLive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isOnline = useOnlineStatus()

  useEffect(() => {
    if (!enabled || !key) {
      setIsLoading(false)
      return
    }

    const controller = new AbortController()
    let source: EventSource | null = null
    let poll: ReturnType<typeof setInterval> | undefined
    let cancelled = false

    const merge = (incoming: Quote[]) => {
      if (!incoming.length) return
      setQuotes((prev) => {
        const next = { ...prev }
        for (const quote of incoming) next[quote.id] = quote
        return next
      })
    }

    const load = async () => {
      try {
        const data = await json<MarketListResult>(
          `/api/market/quotes?ids=${encodeURIComponent(key)}`,
          controller.signal,
        )
        if (cancelled) return
        merge(data.quotes ?? [])
        setError(data.degraded ? 'Delayed data' : null)
      } catch (err) {
        if (!cancelled && !isAbort(err)) setError('Market data delayed')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void load()

    // Polling keeps prices moving whenever SSE is unavailable (proxies, offline
    // tabs, serverless cold paths); the stream simply supersedes it when live.
    poll = setInterval(() => void load(), 20_000)

    try {
      source = new EventSource(`/api/market/stream?ids=${encodeURIComponent(key)}`)
      source.addEventListener('ready', () => {
        setIsLive(true)
        setError(null)
      })
      source.addEventListener('quote', (event) => {
        try {
          const quote = JSON.parse((event as MessageEvent).data) as Quote
          setQuotes((prev) => ({ ...prev, [quote.id]: quote }))
        } catch {
          /* ignore malformed frame */
        }
      })
      source.onerror = () => setIsLive(false)
    } catch {
      setIsLive(false)
    }

    return () => {
      cancelled = true
      controller.abort()
      source?.close()
      if (poll) clearInterval(poll)
    }
  }, [key, enabled])

  const list = useMemo(() => {
    const order = key ? key.split(',') : []
    return order.map((id) => quotes[id]).filter((q): q is Quote => Boolean(q))
  }, [key, quotes])

  return {
    quotes,
    list,
    isLoading,
    isLive: isLive && isOnline,
    isOffline: !isOnline,
    error,
  }
}

/* -------------------------------------------------------------------------- */
/* Boards, categories, trending                                               */
/* -------------------------------------------------------------------------- */

export type BoardTab = 'favorites' | 'hot' | 'gainers' | 'losers'

export interface MarketBoardOptions {
  tab?: BoardTab
  ids?: string[]
  category?: string
  trending?: boolean
  limit?: number
  /** Poll interval in ms. Defaults to 20s, matching the server-side TTLs. */
  refreshMs?: number
  enabled?: boolean
}

/**
 * Generic board loader used by the home Markets card, the Finance category
 * chips, trending assets and Market Pulse.
 */
export function useMarketBoard(options: MarketBoardOptions = {}) {
  const {
    tab,
    ids,
    category,
    trending,
    limit,
    refreshMs = 20_000,
    enabled = true,
  } = options

  const url = useMemo(() => {
    const params = new URLSearchParams()
    if (ids?.length) params.set('ids', Array.from(new Set(ids)).join(','))
    if (tab) params.set('tab', tab)
    if (category) params.set('category', category)
    if (trending) params.set('trending', '1')
    if (limit) params.set('limit', String(limit))
    const query = params.toString()
    return query ? `/api/market/quotes?${query}` : null
  }, [ids, tab, category, trending, limit])

  const [quotes, setQuotes] = useState<Quote[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDegraded, setIsDegraded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isOnline = useOnlineStatus()
  const hasData = useRef(false)

  const run = useCallback(
    async (signal?: AbortSignal) => {
      if (!url) return
      try {
        const data = await json<MarketListResult>(url, signal)
        const next = data.quotes ?? []
        // Keep the previous board when a refresh comes back empty so rows never
        // disappear mid-session because of a transient rate limit.
        if (next.length || !hasData.current) {
          setQuotes(next)
          hasData.current = next.length > 0
        }
        setIsDegraded(Boolean(data.degraded))
        setError(null)
      } catch (err) {
        if (isAbort(err)) return
        setError(hasData.current ? 'Delayed data' : 'Market data unavailable')
        setIsDegraded(true)
      } finally {
        setIsLoading(false)
      }
    },
    [url],
  )

  useEffect(() => {
    if (!enabled || !url) {
      setIsLoading(false)
      return
    }
    const controller = new AbortController()
    setIsLoading(!hasData.current)
    void run(controller.signal)

    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return
      void run(controller.signal)
    }, refreshMs)

    return () => {
      controller.abort()
      clearInterval(timer)
    }
  }, [enabled, url, refreshMs, run])

  return {
    quotes,
    isLoading,
    isDegraded: isDegraded || !isOnline,
    isOffline: !isOnline,
    error,
    reload: () => run(),
  }
}

/* -------------------------------------------------------------------------- */
/* Unified search                                                             */
/* -------------------------------------------------------------------------- */

export function useMarketSearch(query: string, options: { enabled?: boolean; limit?: number } = {}) {
  const { enabled = true, limit = 12 } = options
  const [results, setResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const latest = useRef(0)

  useEffect(() => {
    const trimmed = query.trim()
    if (!enabled || trimmed.length < 1) {
      setResults([])
      setIsSearching(false)
      setError(null)
      return
    }

    const token = ++latest.current
    const controller = new AbortController()
    setIsSearching(true)

    const timer = setTimeout(async () => {
      try {
        const data = await json<{ results: SearchResult[] }>(
          `/api/market/search?q=${encodeURIComponent(trimmed)}&limit=${limit}`,
          controller.signal,
        )
        if (token === latest.current) {
          setResults(data.results ?? [])
          setError(null)
        }
      } catch (err) {
        if (token === latest.current && !isAbort(err)) {
          setResults([])
          setError('Search unavailable')
        }
      } finally {
        if (token === latest.current) setIsSearching(false)
      }
    }, 250)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query, enabled, limit])

  return { results, isSearching, error }
}

/* -------------------------------------------------------------------------- */
/* Asset detail                                                               */
/* -------------------------------------------------------------------------- */

export function useAssetDetail(id: string | null) {
  const [detail, setDetail] = useState<AssetDetail | null>(null)
  const [isLoading, setIsLoading] = useState(Boolean(id))
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(
    async (signal?: AbortSignal) => {
      if (!id) return
      try {
        const data = await json<{ detail: AssetDetail | null }>(
          `/api/market/detail?id=${encodeURIComponent(id)}`,
          signal,
        )
        if (data.detail) {
          setDetail(data.detail)
          setError(null)
        } else {
          setError('Market data unavailable')
        }
      } catch (err) {
        if (!isAbort(err)) setError('Market data unavailable')
      } finally {
        setIsLoading(false)
      }
    },
    [id],
  )

  useEffect(() => {
    if (!id) {
      setDetail(null)
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    const controller = new AbortController()
    void reload(controller.signal)
    return () => controller.abort()
  }, [id, reload])

  const live = useLiveQuotes(id ? [id] : [], { enabled: Boolean(id) })
  const quote = (id ? live.quotes[id] : undefined) ?? detail?.quote

  return {
    detail,
    quote,
    isLoading,
    isLive: live.isLive,
    isOffline: live.isOffline,
    error,
    reload,
  }
}

/* -------------------------------------------------------------------------- */
/* Candles                                                                    */
/* -------------------------------------------------------------------------- */

const REFRESH_BY_TIMEFRAME: Record<Timeframe, number> = {
  '1m': 15_000,
  '5m': 30_000,
  '15m': 60_000,
  '1H': 120_000,
  '4H': 300_000,
  '1D': 600_000,
  '1W': 900_000,
  '1M': 900_000,
}

export function useCandles(id: string | null, timeframe: Timeframe) {
  const [series, setSeries] = useState<CandleSeries | null>(null)
  const [isLoading, setIsLoading] = useState(Boolean(id))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) {
      setSeries(null)
      setIsLoading(false)
      return
    }
    const controller = new AbortController()
    let cancelled = false

    const load = async (showSpinner: boolean) => {
      if (showSpinner) setIsLoading(true)
      try {
        const data = await json<{ series: CandleSeries | null }>(
          `/api/market/candles?id=${encodeURIComponent(id)}&timeframe=${timeframe}`,
          controller.signal,
        )
        if (cancelled) return
        if (data.series?.candles?.length) {
          setSeries(data.series)
          setError(null)
        } else {
          setError('Chart data unavailable')
        }
      } catch (err) {
        // Keep the previous series so the chart never blanks on a refresh error.
        if (!cancelled && !isAbort(err)) setError('Chart data delayed')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void load(true)
    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return
      void load(false)
    }, REFRESH_BY_TIMEFRAME[timeframe])

    return () => {
      cancelled = true
      controller.abort()
      clearInterval(timer)
    }
  }, [id, timeframe])

  return { series, candles: series?.candles ?? [], provider: series?.provider, isLoading, error }
}

/* -------------------------------------------------------------------------- */
/* Order book + recent trades (crypto)                                        */
/* -------------------------------------------------------------------------- */

export function useOrderBook(id: string | null, options: { enabled?: boolean } = {}) {
  const { enabled = true } = options
  const [book, setBook] = useState<OrderBook | null>(null)
  const [isSupported, setIsSupported] = useState(true)

  useEffect(() => {
    if (!id || !enabled) {
      setBook(null)
      return
    }
    const controller = new AbortController()
    let cancelled = false

    const load = async () => {
      try {
        const data = await json<{ orderBook: OrderBook | null; supported: boolean }>(
          `/api/market/depth?id=${encodeURIComponent(id)}`,
          controller.signal,
        )
        if (cancelled) return
        setIsSupported(data.supported)
        if (data.orderBook) setBook(data.orderBook)
      } catch {
        /* keep previous book */
      }
    }

    void load()
    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return
      void load()
    }, 3_000)

    return () => {
      cancelled = true
      controller.abort()
      clearInterval(timer)
    }
  }, [id, enabled])

  return { book, isSupported }
}

export function useRecentTrades(id: string | null, options: { enabled?: boolean } = {}) {
  const { enabled = true } = options
  const [trades, setTrades] = useState<Trade[]>([])

  useEffect(() => {
    if (!id || !enabled) {
      setTrades([])
      return
    }
    const controller = new AbortController()
    let cancelled = false

    const load = async () => {
      try {
        const data = await json<{ trades: Trade[] }>(
          `/api/market/trades?id=${encodeURIComponent(id)}`,
          controller.signal,
        )
        if (!cancelled && data.trades?.length) setTrades(data.trades)
      } catch {
        /* keep previous trades */
      }
    }

    void load()
    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return
      void load()
    }, 5_000)

    return () => {
      cancelled = true
      controller.abort()
      clearInterval(timer)
    }
  }, [id, enabled])

  return trades
}
