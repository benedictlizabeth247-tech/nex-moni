/**
 * @fileOverview Centralized constants and enums for nexMonie.
 * Prevents magic strings and ensures type safety across the application.
 */

export enum TransactionStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  REVERSED = 'reversed',
}

export enum TransactionType {
  INCOME = 'income',
  EXPENSE = 'expense',
  TRANSFER = 'transfer',
  DEPOSIT = 'deposit',
  WITHDRAWAL = 'withdrawal',
}

export enum VerificationStatus {
  UNVERIFIED = 'unverified',
  PENDING = 'pending',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
  ACTION_REQUIRED = 'action_required',
}

export enum UserRole {
  GUEST = 'guest',
  USER = 'user',
  VERIFIED_USER = 'verified_user',
  FOUNDER = 'founder',
  ADMIN = 'admin',
  MODERATOR = 'moderator',
}

export enum AccountStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  PENDING = 'pending',
  BLOCKED = 'blocked',
}

export enum P2PStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  ESCROWED = 'escrowed',
  COMPLETED = 'completed',
  DISPUTED = 'disputed',
  CANCELLED = 'cancelled',
}

export enum SavingsStatus {
  ACTIVE = 'active',
  MATURED = 'matured',
  LIQUIDATED = 'liquidated',
  LOCKED = 'locked',
}

export enum OpportunityStatus {
  OPEN = 'open',
  CLOSED = 'closed',
  EXPIRED = 'expired',
  FEATURED = 'featured',
}

export enum NotificationType {
  TRANSACTION = 'transaction',
  SECURITY = 'security',
  PROMO = 'promo',
  SYSTEM = 'system',
}
