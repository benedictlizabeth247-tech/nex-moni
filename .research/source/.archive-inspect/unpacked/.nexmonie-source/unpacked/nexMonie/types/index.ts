/**
 * @fileOverview Standardized Type Definitions for nexMonie.
 * Aligned with backend.json blueprints and Bybit P2P standards.
 */

import { 
  TransactionStatus, 
  TransactionType, 
  VerificationStatus, 
  UserRole, 
  AccountStatus,
  P2PStatus,
  SavingsStatus,
  OpportunityStatus,
  NotificationType
} from '@/constants';

export type EntityId = string;

/**
 * Enum-backed unions.
 * Accepting the literal values as well as the enum members keeps object
 * literals (`type: 'transfer'`) assignable without casts.
 */
export type TransactionTypeValue = TransactionType | `${TransactionType}`;
export type TransactionStatusValue = TransactionStatus | `${TransactionStatus}`;
export type SavingsStatusValue = SavingsStatus | `${SavingsStatus}`;
export type OpportunityStatusValue = OpportunityStatus | `${OpportunityStatus}`;
export type NotificationTypeValue = NotificationType | `${NotificationType}`;

/** Generic paginated envelope used by every repository. */
export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

export interface Bank {
  id: EntityId;
  name: string;
  code: string;
  logoUrl?: string;
  slug?: string;
}

export interface Notification {
  id: EntityId;
  userId: EntityId;
  type: NotificationTypeValue;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  actionUrl?: string;
}

export interface SavingsPlan {
  id: EntityId;
  userId: EntityId;
  name: string;
  target: number;
  saved: number;
  interestRate: number;
  status: SavingsStatusValue;
  startedAt: string;
  maturesAt?: string;
  currency: string;
}

export interface Investment {
  id: EntityId;
  userId: EntityId;
  assetId: string;
  symbol: string;
  name: string;
  quantity: number;
  averagePrice: number;
  currentPrice?: number;
  currency: string;
  createdAt: string;
}

export type OpportunityDifficulty = 'beginner' | 'intermediate' | 'expert';

export interface Opportunity {
  id: EntityId;
  title: string;
  company: string;
  category: string;
  price: number;
  daysLeft: number;
  applicants: number;
  tags: string[];
  difficulty: OpportunityDifficulty;
  isVerified: boolean;
  isFeatured: boolean;
  status?: OpportunityStatusValue;
  url?: string;
}

/**
 * Merchant Tier Definitions
 */
export type MerchantTierId = 'Beginner' | 'Regular' | 'Veteran' | 'Bronze' | 'Silver' | 'Gold' | 'BlockTrade';

export interface MerchantTier {
  id: MerchantTierId;
  label: string;
  badgeColor: string;
  securityDeposit: number; // in USDT
  maxAdLimit: number; // in USDT equivalent
  requirements: {
    minOrders?: number;
    minCompletionRate?: number;
    accountAgeDays?: number;
    volumeUsdt?: number;
  };
  permissions: string[];
}

/**
 * Standard Async States for Actions
 */
export type ActionStatus = 'idle' | 'loading' | 'success' | 'failed' | 'timeout' | 'cancelled';

export interface ActionState<T = any> {
  status: ActionStatus;
  data: T | null;
  error: string | null;
  timestamp?: string;
}

export interface UserProfile {
  id: EntityId;
  displayName: string;
  email: string;
  photoURL?: string;
  phoneNumber?: string;
  tier: 'nex Basic' | 'nex Elite' | 'nex Premium';
  isVerified: boolean;
  status: AccountStatus;
  joinedAt: string;
  preferredLanguage: string;
  kycLevel: number;
  role: UserRole;
}

export interface Wallet {
  id: EntityId;
  userId: EntityId;
  available: number;
  savings: number;
  investments: number;
  vault: number;
  lastUpdated: string;
  currency: string;
}

export interface Transaction {
  id: EntityId;
  userId: EntityId;
  walletId: EntityId;
  title: string;
  amount: number;
  type: TransactionTypeValue;
  category: string;
  timestamp: string;
  status: TransactionStatusValue;
  referenceId: string;
  recipient?: string;
}

export interface P2PAdvertisement {
  id: EntityId;
  createdBy: EntityId;
  merchantName: string;
  merchantTier: MerchantTierId;
  type: 'buy' | 'sell';
  asset: string;
  price: number;
  availableQuantity: number;
  minLimit: number;
  maxLimit: number;
  paymentMethods: string[];
  status: 'active' | 'paused' | 'closed';
  ordersCount: number;
  completionRate: number;
  createdAt: any;
}

export interface P2POrder {
  id: EntityId;
  adId: EntityId;
  buyerId: EntityId;
  sellerId: EntityId;
  asset: string;
  quantity: number;
  fiatAmount: number;
  price: number;
  status: 'pending' | 'unpaid' | 'paid' | 'released' | 'completed' | 'cancelled' | 'appealed';
  paymentMethod: string;
  referenceId: string;
  expiresAt: any;
  createdAt: any;
}

export interface MerchantProfile {
  id: EntityId;
  userId: EntityId;
  nickname: string;
  tier: MerchantTierId;
  status: 'pending' | 'approved' | 'suspended';
  totalTrades: number;
  completionRate: number;
  revenue: number;
  tradingVolume: number;
  isOnline: boolean;
  joinedAt: any;
}
