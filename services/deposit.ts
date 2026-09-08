'use client'

export interface DepositSession {
  id: string
  bankName: string
  accountNumber: string
  accountName: string
  expiryTime: Date
  status: 'active' | 'expired'
}

export interface DepositRequestInput {
  amount: number
  senderBank: string
  reference?: string
  screenshotUrl?: string | null
}

export async function getDepositSession(): Promise<DepositSession> {
  const response = await fetch('/api/deposits/bank', { cache: 'no-store' })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload?.error || 'Fiat funding account is not configured.')
  return {
    id: String(payload.sessionId),
    bankName: String(payload.bankName),
    accountNumber: String(payload.accountNumber),
    accountName: String(payload.accountName),
    expiryTime: new Date(String(payload.expiryTime)),
    status: 'active',
  }
}

export async function submitDepositRequest(input: DepositRequestInput): Promise<{ success: boolean; referenceId: string }> {
  const response = await fetch('/api/deposits/bank', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload?.error || 'Deposit request could not be recorded.')
  return { success: true, referenceId: String(payload.referenceId) }
}
