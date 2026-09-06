import { NextResponse } from 'next/server'
import { getQuotes } from '@/services/market-data/router'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const from = (searchParams.get('from') || 'USD').toUpperCase()
  const to = (searchParams.get('to') || 'NGN').toUpperCase()

  if (!/^[A-Z]{3}$/.test(from) || !/^[A-Z]{3}$/.test(to)) {
    return NextResponse.json({ error: 'Currencies must be ISO 4217 codes.' }, { status: 400 })
  }

  if (from === to) {
    return NextResponse.json({ from, to, rate: 1, inverse: 1, timestamp: Date.now(), source: 'identity' })
  }

  try {
    const result = await getQuotes([`forex.${from}${to}`])
    const quote = result.quotes?.[0]
    if (!quote || quote.price <= 0) throw new Error('No current FX quote')
    return NextResponse.json({ from, to, rate: quote.price, inverse: 1 / quote.price, timestamp: quote.timestamp, source: quote.provider })
  } catch {
    return NextResponse.json({ error: 'FX rate unavailable', from, to }, { status: 503 })
  }
}
