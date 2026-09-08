/**
 * @fileOverview Repository interfaces for nexMonie.
 * These contracts define how the frontend interacts with data.
 * Implementation will be plug-and-play with Supabase later.
 */

import { 
  UserProfile, 
  Wallet, 
  Transaction, 
  Bank, 
  Notification,
  P2PAdvertisement,
  SavingsPlan,
  Investment,
  Opportunity,
  PaginatedResponse
} from '@/types';

export interface IWalletRepository {
  getById(id: string): Promise<Wallet>;
  getByUserId(userId: string): Promise<Wallet>;
  updateBalance(id: string, amount: number): Promise<void>;
}

export interface ITransactionRepository {
  getRecent(userId: string, limit: number): Promise<Transaction[]>;
  getPaginated(userId: string, page: number, pageSize: number): Promise<PaginatedResponse<Transaction>>;
  create(transaction: Partial<Transaction>): Promise<Transaction>;
}

export interface IBankRepository {
  getAll(): Promise<Bank[]>;
  getById(id: string): Promise<Bank>;
}

export interface INotificationRepository {
  getUnread(userId: string): Promise<Notification[]>;
  markAsRead(id: string): Promise<void>;
}

export interface IP2PRepository {
  getActiveAds(asset: string): Promise<P2PAdvertisement[]>;
  createOrder(adId: string, amount: number): Promise<string>;
}

export interface ISavingsRepository {
  getUserPlans(userId: string): Promise<SavingsPlan[]>;
  createPlan(plan: Partial<SavingsPlan>): Promise<SavingsPlan>;
}

export interface IInvestmentRepository {
  getUserPortfolio(userId: string): Promise<Investment[]>;
}

export interface IEarnRepository {
  getOpportunities(): Promise<Opportunity[]>;
  saveOpportunity(id: string, userId: string): Promise<void>;
}

export interface IProfileRepository {
  getById(id: string): Promise<UserProfile>;
  update(id: string, data: Partial<UserProfile>): Promise<void>;
}
