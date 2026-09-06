'use client'

export type WithdrawalDestination = 'bank' | 'nex' | 'card_refund' | 'mobile_money' | 'crypto'

export async function createWithdrawalRequest(input: {
  amount: number
  destinationType: WithdrawalDestination
  destination: string
  currency: string
  network?: string
  idempotencyKey?: string
  autopilot?: boolean
}) {
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error('Enter a valid amount.')
  if (Math.round(input.amount * 100) !== input.amount * 100) throw new Error('Amount must use valid currency precision.')
  if (input.destinationType === 'crypto' && !input.network) throw new Error('Select a crypto network.')
  if (!input.destination.trim()) throw new Error('Enter a withdrawal destination.')

  const idempotencyKey = input.idempotencyKey || crypto.randomUUID()
  const response = await fetch('/api/withdrawals', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: input.amount,
      destinationType: input.destinationType,
      destination: input.destination.trim(),
      currency: input.currency,
      network: input.network || null,
      autopilot: Boolean(input.autopilot),
      idempotencyKey,
    }),
  })

  const data = await response.json().catch(() => null)
  if (!response.ok) throw new Error(data?.error || 'Unable to submit withdrawal request.')
  return data as {
    status: 'created' | 'already_created'
    request_id: string
    reference: string
    withdrawal_status: string
    reservation_status: string
    amount: number
    currency: string
    transaction_id?: string
    available_balance?: number
  }
}
