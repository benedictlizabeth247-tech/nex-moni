import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const { data, error } = await supabase.from('investor_portfolios').select('id,user_id,name,description,strategy,risk_level,is_public,performance_30d,created_at,updated_at,portfolio_holdings(id,ticker,quantity,entry_price,current_price,currency,updated_at)').order('updated_at', { ascending: false })
  if (error) return NextResponse.json({ error: 'Unable to load portfolios.' }, { status: 502 })
  const portfolios = (data ?? []).map((portfolio: any) => ({ ...portfolio, holdings: portfolio.portfolio_holdings ?? [], pnl: (portfolio.portfolio_holdings ?? []).reduce((total: number, holding: any) => total + (Number(holding.current_price) - Number(holding.entry_price)) * Number(holding.quantity), 0), costBasis: (portfolio.portfolio_holdings ?? []).reduce((total: number, holding: any) => total + Number(holding.entry_price) * Number(holding.quantity), 0) }))
  return NextResponse.json({ data: portfolios }, { headers: { 'cache-control': 'no-store' } })
}
