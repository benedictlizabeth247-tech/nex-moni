// Generated types for the Supabase public schema used by nexMonie.
// Keep in sync with the schema created via the Supabase MCP.

export type ProfileTier = 'nex Basic' | 'nex Elite' | 'nex Premium'
export type ProfileStatus = 'active' | 'suspended' | 'pending' | 'banned'
export type ProfileRole = 'user' | 'merchant' | 'admin'

export type WalletBalanceField = 'available' | 'savings' | 'investments' | 'vault'
export type WalletStatus = 'active' | 'frozen' | 'restricted'

export type WalletTransactionType =
  | 'income'
  | 'expense'
  | 'transfer'
  | 'deposit'
  | 'withdrawal'
  | 'p2p_buy'
  | 'p2p_sell'
  | 'fee'
  | 'refund'
export type WalletTransactionStatus = 'pending' | 'completed' | 'failed' | 'reversed'

export type MerchantStatus = 'pending' | 'approved' | 'rejected' | 'suspended'

export type P2POrderStatus =
  | 'pending_payment'
  | 'paid'
  | 'released'
  | 'cancelled'
  | 'disputed'
  | 'expired'
export type P2PSide = 'buy' | 'sell'
export type P2PAdStatus = 'active' | 'paused' | 'closed'

export interface Profile {
  id: string
  nex_user_id: string
  full_name: string | null
  email: string | null
  phone_number: string | null
  photo_url: string | null
  tier: ProfileTier
  is_verified: boolean
  status: ProfileStatus
  preferred_language: string
  kyc_level: number
  role: ProfileRole
  onboarding_completed: boolean
  created_at: string
  updated_at: string
}

export interface Wallet {
  id: string
  user_id: string
  available: number
  savings: number
  investments: number
  vault: number
  currency: string
  status: WalletStatus
  updated_at: string
  created_at: string
}

export interface WalletTransaction {
  id: string
  user_id: string
  wallet_id: string
  title: string
  amount: number
  type: WalletTransactionType
  category: string
  balance_field: WalletBalanceField
  status: WalletTransactionStatus
  reference_id: string
  recipient: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export interface Merchant {
  id: string
  user_id: string
  business_name: string
  status: MerchantStatus
  completed_orders: number
  completion_rate: number
  avg_release_time_minutes: number
  is_online: boolean
  created_at: string
  updated_at: string
}

export interface MerchantApplication {
  id: string
  user_id: string
  business_name: string
  reason: string | null
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  reviewed_at: string | null
}

export interface P2PAd {
  id: string
  merchant_id: string
  user_id: string
  side: P2PSide
  asset: string
  fiat_currency: string
  price: number
  available_amount: number
  min_limit: number
  max_limit: number
  payment_methods: string[]
  terms: string | null
  status: P2PAdStatus
  created_at: string
  updated_at: string
}

export interface P2POrder {
  id: string
  ad_id: string
  buyer_id: string
  seller_id: string
  side: P2PSide
  asset: string
  fiat_currency: string
  price: number
  crypto_amount: number
  fiat_amount: number
  status: P2POrderStatus
  payment_method: string | null
  reference: string
  expires_at: string
  paid_at: string | null
  released_at: string | null
  cancelled_at: string | null
  created_at: string
  updated_at: string
}

export interface P2POrderMessage {
  id: string
  order_id: string
  sender_id: string
  body: string
  attachment_url: string | null
  created_at: string
}

export interface Deposit {
  id: string
  user_id: string
  amount: number
  method: string
  status: 'pending' | 'confirmed' | 'failed'
  reference: string
  created_at: string
  confirmed_at: string | null
}

export interface AppConfig {
  key: string
  value: unknown
  updated_at: string
}
