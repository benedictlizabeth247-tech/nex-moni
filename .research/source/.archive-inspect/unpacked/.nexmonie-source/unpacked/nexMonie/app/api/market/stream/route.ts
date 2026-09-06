import type { NextRequest } from 'next/server'

import { subscribeQuotes } from '@/services/market-data/stream'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Server-sent events bridge. The browser only ever talks to this route — the
 * Market Data Service owns the upstream Bybit WebSocket / provider polling.
 */
export async function GET(request: NextRequest) {
  const ids = (request.nextUrl.searchParams.get('ids') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 60)

  if (!ids.length) {
    return new Response('data: {"error":"ids required"}\n\n', {
      status: 400,
      headers: { 'Content-Type': 'text/event-stream' },
    })
  }

  const encoder = new TextEncoder()
  let unsubscribe: (() => void) | undefined
  let heartbeat: ReturnType<typeof setInterval> | undefined

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, payload: unknown) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`))
        } catch {
          /* client went away */
        }
      }

      send('ready', { ids })
      unsubscribe = subscribeQuotes(ids, (quote) => send('quote', quote))
      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': ping\n\n'))
        } catch {
          /* noop */
        }
      }, 25_000)

      request.signal.addEventListener('abort', () => {
        unsubscribe?.()
        if (heartbeat) clearInterval(heartbeat)
        try {
          controller.close()
        } catch {
          /* already closed */
        }
      })
    },
    cancel() {
      unsubscribe?.()
      if (heartbeat) clearInterval(heartbeat)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
