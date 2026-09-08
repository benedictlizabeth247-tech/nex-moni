'use client'

import { supabase } from '@/lib/supabase'

export type TradingMode = 'spot' | 'futures'
export type OrderSide = 'buy' | 'sell'
export type OrderType = 'market' | 'limit' | 'stop'

export interface TradingAccount {
  user_id: string
  funding_balance: number
  spot_balance: number
  futures_balance: number
  updated_at: string
}

export interface TradingOrder {
  id: string
  user_id: string
  mode: TradingMode
  symbol: string
  side: OrderSide
  order_type: OrderType
  quantity: number
  price: number
  leverage: number
  margin: number
  status: string
  created_at: string
}

export interface TradingPosition {
  id: string
  user_id: string
  mode: TradingMode
  symbol: string
  side: OrderSide
  quantity: number
  entry_price: number
  mark_price: number
  leverage: number
  margin: number
  unrealized_pnl: number
  realized_pnl?: number
  take_profit?: number | null
  stop_loss?: number | null
  status: string
  opened_at: string
  closed_at?: string | null
}

export interface TradingAccountSummary {
  user_id: string
  settled_balance: number
  equity: number
  used_margin: number
  available_margin: number
  unrealized_pnl: number
  spot_balance: number
  futures_balance: number
  funding_balance: number
  updated_at: string
}

export async function getTradingAccountSummary(): Promise<TradingAccountSummary | null> {
  const requestSummary = () => supabase.rpc('trading_account_summary')
  let { data, error } = await requestSummary()

  if (error?.message.toLowerCase().includes('jwt issued at future')) {
    // A preview can briefly retain a token minted ahead of the database clock.
    // Refresh the cookie-backed session once, then retry the RPC with the new token.
    await supabase.auth.refreshSession()
    ;({ data, error } = await requestSummary())
  }

  if (error) {
    if (error.message.toLowerCase().includes('jwt issued at future')) {
      return null
    }
    throw new Error(error.message)
  }

  return data as TradingAccountSummary
}

export async function getTradingAccount() {
  const { data, error } = await supabase.rpc('trading_get_account')
  if (error) throw new Error(error.message)
  return (Array.isArray(data) ? data[0] : data) as TradingAccount | null
}

export type TradingAccountBucket = 'funding' | 'spot' | 'futures'

export async function transferBetweenAccounts(from: TradingAccountBucket, to: TradingAccountBucket, amount: number) {
  if (!amount || amount <= 0) throw new Error('Enter a valid transfer amount.')
  if (from === to) throw new Error('Choose different accounts.')
  const { data, error } = await supabase.rpc('trading_transfer_between_accounts', { p_from: from, p_to: to, p_amount: amount })
  if (error) throw new Error(error.message)
  return data as TradingAccount
}

export async function transferToTrading(mode: TradingMode, amount: number) {
  if (!amount || amount <= 0) throw new Error('Enter a valid transfer amount.')
  const { data, error } = await supabase.rpc('trading_transfer_from_funding', {
    p_mode: mode,
    p_amount: amount,
  })
  if (error) throw new Error(error.message)
  return data
}

export async function placeInternalOrder(input: {
  mode: TradingMode
  symbol: string
  side: OrderSide
  orderType: OrderType
  quantity: number
  price?: number
  leverage?: number
  takeProfit?: number | null
  stopLoss?: number | null
}) {
  const response = await fetch('/api/trading/execute', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...input, orderType: input.orderType, leverage: input.leverage ?? 1, takeProfit: input.takeProfit ?? null, stopLoss: input.stopLoss ?? null }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload?.error || 'Order execution failed')
  return payload
}

export async function getTradingPositions(mode?: TradingMode) {
  let q = supabase.from('trading_positions').select('*').eq('status', 'open').order('opened_at', { ascending: false })
  if (mode) q = q.eq('mode', mode)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []) as TradingPosition[]
}

export async function getTradingPositionHistory(mode?: TradingMode) {
  let q = supabase.from('trading_positions').select('*').eq('status', 'closed').order('closed_at', { ascending: false }).limit(50)
  if (mode) q = q.eq('mode', mode)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []) as TradingPosition[]
}

export async function getTradingOrders(mode?: TradingMode) {
  let q = supabase.from('trading_orders').select('*').order('created_at', { ascending: false }).limit(50)
  if (mode) q = q.eq('mode', mode)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []) as TradingOrder[]
}

export async function cancelTradingOrder(orderId: string) {
  const { data, error } = await supabase.rpc('trading_cancel_order', { p_order_id: orderId })
  if (error) throw new Error(error.message)
  return data
}

export async function processPendingOrder(orderId: string, marketPrice: number) {
  const { data, error } = await supabase.rpc('trading_process_pending_order', {
    p_order_id: orderId,
    p_market_price: marketPrice,
  })
  if (error) throw new Error(error.message)
  return data
}

export async function updatePositionRisk(positionId: string, takeProfit: number | null, stopLoss: number | null) {
  const { data, error } = await supabase.rpc('trading_update_position_risk', {
    p_position_id: positionId,
    p_take_profit: takeProfit,
    p_stop_loss: stopLoss,
  })
  if (error) throw new Error(error.message)
  return data
}

export async function markOpenPositions(symbol: string, marketPrice: number) {
  const { data, error } = await supabase.rpc('trading_mark_positions', {
    p_symbol: symbol,
    p_market_price: marketPrice,
  })
  if (error) throw new Error(error.message)
  return data
}

export async function closeInternalPosition(positionId: string, symbol: string) {
  if (!positionId) throw new Error('A position is required to close a trade.')
  if (!symbol) throw new Error('A market is required to close a trade.')
  const response = await fetch('/api/trading/close', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ positionId, symbol }),
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok) throw new Error(payload?.error || 'Could not close position.')
  return payload as { status: 'closed'; position_id: string; realized_pnl: number; mark_price: number; reference: string }
}
