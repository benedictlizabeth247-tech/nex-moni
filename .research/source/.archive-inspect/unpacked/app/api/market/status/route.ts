import { NextResponse } from 'next/server'

import { getProviderStatus } from '@/services/market-data/router'
import { cryptoStreamProvider, isCryptoStreamConnected } from '@/services/market-data/stream'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * Provider health / routing chain. Used by the UI to label data as live vs
 * delayed and by ops to confirm which API keys are active in an environment.
 */
export async function GET() {
  return NextResponse.json(
    {
      providers: getProviderStatus(),
      stream: { connected: isCryptoStreamConnected(), provider: cryptoStreamProvider() },
      time: Date.now(),
    },
    { headers: { 'cache-control': 'no-store' } },
  )
}
