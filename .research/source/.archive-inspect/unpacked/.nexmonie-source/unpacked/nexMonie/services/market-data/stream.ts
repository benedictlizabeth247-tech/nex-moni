/**
 * @fileOverview Server-side realtime relay.
 *
 * The UI never opens a socket to an exchange. It subscribes to `/api/market/stream`
 * (SSE) and this module owns the upstream connections:
 *
 *   crypto      -> one shared exchange WebSocket (Bybit, falling back to OKX)
 *   everything  -> efficient polling of the Market Data Service (rate-limit aware)
 *
 * Swapping in another streaming provider only means editing this file.
 */

import 'server-only'

import { fromInstId, toInstId } from './providers/okx'
import { getQuotes } from './router'
import { buildAssetId, parseAssetId } from './symbols'
import type { ProviderId, Quote } from './types'

const RECONNECT_MIN = 1_000
const RECONNECT_MAX = 30_000
const POLL_INTERVAL = 15_000
const IDLE_SHUTDOWN = 60_000
/** Failed connect attempts against one exchange before rotating to the next. */
const ATTEMPTS_PER_FEED = 2

type Listener = (quote: Quote) => void

/** Normalised ticker push, so every exchange feeds the same quote builder. */
interface TickerUpdate {
  symbol: string
  price?: number
  previousClose?: number
  changePercent?: number
  high?: number
  low?: number
  volume?: number
  quoteVolume?: number
}

/**
 * Everything exchange-specific about a realtime feed. Adding an exchange means
 * adding one descriptor — the socket, reconnect and quote logic is shared.
 */
interface ExchangeFeed {
  provider: ProviderId
  url: string
  /** Max topics per subscribe frame. */
  batch: number
  subscribeFrame: (symbols: string[]) => string | null
  /** Keep-alive frame; Bybit expects JSON, OKX expects the literal `ping`. */
  pingFrame: string
  parse: (payload: unknown) => TickerUpdate[]
}

const BYBIT_FEED: ExchangeFeed = {
  provider: 'bybit',
  url: process.env.BYBIT_WS_URL || 'wss://stream.bybit.com/v5/public/spot',
  batch: 10,
  subscribeFrame: (symbols) =>
    JSON.stringify({ op: 'subscribe', args: symbols.map((s) => `tickers.${s}`) }),
  pingFrame: JSON.stringify({ op: 'ping' }),
  parse: (payload) => {
    const message = payload as { topic?: string; data?: Record<string, unknown> }
    if (!message?.topic?.startsWith('tickers.') || !message.data) return []
    const data = message.data
    const symbol = typeof data.symbol === 'string' ? data.symbol : ''
    if (!symbol) return []
    const percent = num(data.price24hPcnt)
    return [
      {
        symbol,
        price: num(data.lastPrice),
        previousClose: num(data.prevPrice24h),
        changePercent: percent !== undefined ? percent * 100 : undefined,
        high: num(data.highPrice24h),
        low: num(data.lowPrice24h),
        volume: num(data.volume24h),
        quoteVolume: num(data.turnover24h),
      },
    ]
  },
}

/**
 * OKX carries the same USDT spot pairs and stays reachable where Bybit is
 * geo-blocked, so it keeps crypto quotes live instead of leaving the UI on the
 * slower REST poll.
 */
const OKX_FEED: ExchangeFeed = {
  provider: 'okx',
  url: process.env.OKX_WS_URL || 'wss://ws.okx.com:8443/ws/v5/public',
  batch: 20,
  subscribeFrame: (symbols) => {
    const args = symbols
      .map((s) => toInstId(s))
      .filter((instId): instId is string => Boolean(instId))
      .map((instId) => ({ channel: 'tickers', instId }))
    return args.length ? JSON.stringify({ op: 'subscribe', args }) : null
  },
  pingFrame: 'ping',
  parse: (payload) => {
    const message = payload as {
      arg?: { channel?: string }
      data?: Record<string, unknown>[]
    }
    if (message?.arg?.channel !== 'tickers' || !Array.isArray(message.data)) return []
    return message.data.flatMap((row) => {
      const instId = typeof row.instId === 'string' ? row.instId : ''
      if (!instId) return []
      const price = num(row.last)
      const open = num(row.open24h)
      return [
        {
          symbol: fromInstId(instId),
          price,
          previousClose: open,
          changePercent:
            price !== undefined && open !== undefined && open > 0
              ? ((price - open) / open) * 100
              : undefined,
          high: num(row.high24h),
          low: num(row.low24h),
          volume: num(row.vol24h),
          quoteVolume: num(row.volCcy24h),
        },
      ]
    })
  },
}

const FEEDS: ExchangeFeed[] = [BYBIT_FEED, OKX_FEED]

class CryptoSocket {
  private socket: WebSocket | null = null
  private connected = false
  private attempts = 0
  private desired = new Set<string>()
  private subscribed = new Set<string>()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private pingTimer: ReturnType<typeof setInterval> | null = null
  private feedIndex = 0
  readonly latest = new Map<string, Quote>()
  private listeners = new Set<Listener>()

  get isConnected() {
    return this.connected
  }

  get feed(): ExchangeFeed {
    return FEEDS[this.feedIndex % FEEDS.length]
  }

  addListener(listener: Listener) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  want(symbols: string[]) {
    let changed = false
    for (const symbol of symbols) {
      if (!this.desired.has(symbol)) {
        this.desired.add(symbol)
        changed = true
      }
    }
    if (!this.socket) this.connect()
    else if (changed && this.connected) this.flushSubscriptions()
  }

  private connect() {
    if (this.socket) return
    const feed = this.feed
    try {
      const socket = new WebSocket(feed.url)
      this.socket = socket

      socket.onopen = () => {
        this.connected = true
        this.attempts = 0
        this.subscribed.clear()
        this.flushSubscriptions()
        this.pingTimer = setInterval(() => {
          try {
            socket.send(feed.pingFrame)
          } catch {
            /* handled by onclose */
          }
        }, 20_000)
      }

      socket.onmessage = (event) => this.handleMessage(String(event.data))
      socket.onerror = () => this.teardown()
      socket.onclose = () => this.teardown()
    } catch {
      this.teardown()
    }
  }

  private flushSubscriptions() {
    const socket = this.socket
    if (!socket || !this.connected) return
    const pending = Array.from(this.desired).filter((s) => !this.subscribed.has(s))
    if (!pending.length) return
    const feed = this.feed
    // Exchanges cap the number of topics per subscribe frame.
    for (let i = 0; i < pending.length; i += feed.batch) {
      const batch = pending.slice(i, i + feed.batch)
      const frame = feed.subscribeFrame(batch)
      if (!frame) continue
      try {
        socket.send(frame)
        batch.forEach((s) => this.subscribed.add(s))
      } catch {
        return
      }
    }
  }

  private handleMessage(raw: string) {
    // OKX answers keep-alives with the bare string `pong`, which is not JSON.
    if (!raw || raw === 'pong') return

    let payload: unknown
    try {
      payload = JSON.parse(raw)
    } catch {
      return
    }

    const feed = this.feed
    for (const update of feed.parse(payload)) {
      if (!update.symbol) continue
      const previous = this.latest.get(update.symbol)
      const price = update.price ?? previous?.price ?? 0
      if (!price) continue
      const prevClose = update.previousClose ?? previous?.previousClose

      const quote: Quote = {
        id: buildAssetId('crypto', update.symbol),
        type: 'crypto',
        symbol: update.symbol,
        display: previous?.display ?? formatPair(update.symbol),
        name: previous?.name ?? update.symbol,
        price,
        previousClose: prevClose,
        change: prevClose !== undefined ? price - prevClose : previous?.change ?? 0,
        changePercent: update.changePercent ?? previous?.changePercent ?? 0,
        high: update.high ?? previous?.high,
        low: update.low ?? previous?.low,
        open: prevClose ?? previous?.open,
        close: price,
        volume: update.volume ?? previous?.volume,
        quoteVolume: update.quoteVolume ?? previous?.quoteVolume,
        marketCap: previous?.marketCap,
        currency: previous?.currency ?? 'USD',
        provider: feed.provider,
        timestamp: Date.now(),
      }

      this.latest.set(update.symbol, quote)
      for (const listener of this.listeners) listener(quote)
    }
  }

  private teardown() {
    this.connected = false
    if (this.pingTimer) clearInterval(this.pingTimer)
    this.pingTimer = null
    try {
      this.socket?.close()
    } catch {
      /* noop */
    }
    this.socket = null
    this.subscribed.clear()

    if (this.reconnectTimer || !this.desired.size) return

    this.attempts += 1
    // Rotate exchanges once one has failed repeatedly: Bybit is unreachable from
    // some regions, and OKX serves the same pairs, so live crypto survives it.
    if (FEEDS.length > 1 && this.attempts % ATTEMPTS_PER_FEED === 0) this.feedIndex += 1

    const delay = Math.min(RECONNECT_MAX, RECONNECT_MIN * 2 ** (this.attempts - 1))
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, delay)
  }
}

const num = (value: unknown) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : undefined
}

const formatPair = (symbol: string) => {
  const quote = ['USDT', 'USDC', 'USD'].find((q) => symbol.endsWith(q))
  return quote ? `${symbol.slice(0, -quote.length)}/${quote}` : symbol
}

/** Module-level singletons survive hot reloads in dev. */
const globalRef = globalThis as unknown as { __nexCryptoSocket?: CryptoSocket }
const cryptoSocket = (globalRef.__nexCryptoSocket ??= new CryptoSocket())

/**
 * Subscribe to live quotes for a set of asset ids. Crypto arrives over the
 * shared exchange WebSocket (Bybit, rotating to OKX when Bybit is unreachable);
 * other asset classes are polled through the service layer at a
 * rate-limit-friendly interval.
 */
export function subscribeQuotes(ids: string[], listener: Listener): () => void {
  const cryptoSymbols: string[] = []
  const polled: string[] = []

  for (const id of ids) {
    const ref = parseAssetId(id)
    if (!ref) continue
    if (ref.type === 'crypto') cryptoSymbols.push(ref.symbol)
    else polled.push(id)
  }

  const wanted = new Set(ids)
  const unsubscribeSocket = cryptoSocket.addListener((quote) => {
    if (wanted.has(quote.id)) listener(quote)
  })

  if (cryptoSymbols.length) {
    cryptoSocket.want(cryptoSymbols)
    // Emit whatever the shared socket already knows so first paint is instant.
    for (const symbol of cryptoSymbols) {
      const known = cryptoSocket.latest.get(symbol)
      if (known) listener(known)
    }
  }

  let pollTimer: ReturnType<typeof setInterval> | null = null
  if (polled.length) {
    const poll = async () => {
      try {
        const { quotes } = await getQuotes(polled)
        for (const quote of quotes) listener(quote)
      } catch {
        /* keep the stream alive; next tick retries */
      }
    }
    void poll()
    pollTimer = setInterval(poll, POLL_INTERVAL)
  }

  return () => {
    unsubscribeSocket()
    if (pollTimer) clearInterval(pollTimer)
  }
}

export const isCryptoStreamConnected = () => cryptoSocket.isConnected

/** Exchange currently backing the crypto stream, for the status endpoint. */
export const cryptoStreamProvider = (): ProviderId => cryptoSocket.feed.provider

export const IDLE_STREAM_SHUTDOWN = IDLE_SHUTDOWN
