export type CustodyAddress = { asset: string; network: string; address: string; tag?: string | null; expiresAt?: string | null }

function config() {
  const base = process.env.NEXMONIE_CUSTODY_BASE_URL
  const key = process.env.NEXMONIE_CUSTODY_API_KEY
  if (!base || !key) throw new Error('Crypto custody rail is not configured. Set NEXMONIE_CUSTODY_BASE_URL and NEXMONIE_CUSTODY_API_KEY.')
  return { base: base.replace(/\/$/, ''), key }
}

async function call(path: string, init: RequestInit = {}) {
  const { base, key } = config()
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}`, ...(init.headers ?? {}) },
    cache: 'no-store',
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload?.message || `Custody provider error (${response.status})`)
  return payload
}

export const custody = {
  async getDepositAddress(userId: string, asset: string, network: string): Promise<CustodyAddress> {
    return call('/v1/deposit-address', { method: 'POST', body: JSON.stringify({ userId, asset, network }) })
  },
  async createWithdrawal(input: { userId: string; asset: string; network: string; address: string; amount: number; tag?: string }) {
    return call('/v1/withdrawals', { method: 'POST', body: JSON.stringify(input) })
  },
  async verifyDeposit(input: { reference: string; asset: string; network: string; txHash?: string }) {
    return call('/v1/deposits/verify', { method: 'POST', body: JSON.stringify(input) })
  },
}
