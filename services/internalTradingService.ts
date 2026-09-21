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
  const response = await fetch('/api/assets/overview', { cache: 'no-store' })
  const overview = await response.json().catch(() => null)
  if (!response.ok || !overview) return null
  const unrealizedPnl = Number(overview.unrealizedPnl ?? 0)
  return { user_id: '', settled_balance: Number(overview.totalBalance ?? 0), equity: Number(overview.totalBalance ?? 0), used_margin: Number(overview.totalLocked ?? 0), available_margin: Number(overview.totalAvailable ?? 0), unrealized_pnl: unrealizedPnl, spot_balance: Number(overview.spot?.available ?? 0), futures_balance: Number(overview.futures?.available ?? 0), funding_balance: Number(overview.funding?.available ?? 0), updated_at: new Date().toISOString() }
}

export async function getTradingAccount() {
  const response = await fetch('/api/assets/overview', { cache: 'no-store' })
  const overview = await response.json().catch(() => null)
  if (!response.ok || !overview) return null
  return { user_id: '', funding_balance: Number(overview.funding?.available ?? 0), spot_balance: Number(overview.spot?.available ?? 0), futures_balance: Number(overview.futures?.available ?? 0), updated_at: new Date().toISOString() } as TradingAccount
}

export type TradingAccountBucket = 'funding' | 'spot' | 'futures'

export async function transferBetweenAccounts(from: TradingAccountBucket, to: TradingAccountBucket, amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Enter an amount greater than 0.')
  if (from === to) throw new Error('Choose two different accounts.')

  const { data, error } = await supabase.rpc('trading_transfer_between_accounts', {
    p_from: from,
    p_to: to,
    p_amount: amount,
  })

  if (error) {
    const message = error.message.toLowerCase()
    if (message.includes('insufficient')) throw new Error('There is not enough available balance in the source account.')
    if (message.includes('not authenticated') || message.includes('jwt')) throw new Error('Your session expired. Sign in again and retry.')
    if (message.includes('row-level security') || message.includes('permission denied')) throw new Error('Transfers are temporarily unavailable. Please try again.')
    throw new Error('We could not complete the transfer. Please try again.')
  }

  return data as TradingAccount
}

export async function transferToTrading(mode: TradingMode, amount: number) {
  if (!amount || amount <= 0) throw new Error('Enter a valid transfer amount.')
  const response = await fetch('/api/assets/transfer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ from: 'funding', to: mode, amount }) })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload?.error || 'Transfer failed')
  return payload
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
  const response = await fetch(`/api/trading/positions${mode ? `?mode=${mode}` : ''}`, { cache: 'no-store' })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload?.error || 'Unable to load positions')
  return (payload.positions ?? []).filter((position: TradingPosition) => position.status === 'open') as TradingPosition[]
}

export async function getTradingPositionHistory(mode?: TradingMode) {
  const response = await fetch(`/api/trading/positions${mode ? `?mode=${mode}` : ''}`, { cache: 'no-store' })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload?.error || 'Unable to load history')
  return (payload.positions ?? []).filter((position: TradingPosition) => position.status === 'closed').slice(0, 50) as TradingPosition[]
}

export async function getTradingOrders(mode?: TradingMode) {
  const response = await fetch(`/api/trading/positions${mode ? `?mode=${mode}` : ''}`, { cache: 'no-store' })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload?.error || 'Unable to load orders')
  return (payload.orders ?? []).slice(0, 50) as TradingOrder[]
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
