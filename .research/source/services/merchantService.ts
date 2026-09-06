'use client';

import { supabase } from '@/lib/supabase';
import { MerchantProfile, MerchantTier, MerchantTierId } from '@/types';

/**
 * @fileOverview Bybit-compliant Merchant Tier Constants
 */
export const MERCHANT_TIERS: Record<MerchantTierId, MerchantTier> = {
  Beginner: {
    id: 'Beginner',
    label: 'Beginner Merchant',
    badgeColor: 'text-gray-400 bg-gray-50',
    securityDeposit: 200,
    maxAdLimit: 1000,
    requirements: { minOrders: 5, minCompletionRate: 80, accountAgeDays: 7 },
    permissions: ['Post Sell Ads']
  },
  Regular: {
    id: 'Regular',
    label: 'Verified Regular',
    badgeColor: 'text-blue-500 bg-blue-50',
    securityDeposit: 500,
    maxAdLimit: 20000,
    requirements: { minOrders: 20, minCompletionRate: 85, volumeUsdt: 2000 },
    permissions: ['Post Buy Ads', 'Post Sell Ads']
  },
  Veteran: {
    id: 'Veteran',
    label: 'Verified Veteran',
    badgeColor: 'text-purple-500 bg-purple-50',
    securityDeposit: 800,
    maxAdLimit: 50000,
    requirements: { minOrders: 50, minCompletionRate: 90, volumeUsdt: 10000 },
    permissions: ['Priority Listing', 'Post Multi-Currency Ads']
  },
  Bronze: {
    id: 'Bronze',
    label: 'Verified Bronze',
    badgeColor: 'text-orange-500 bg-orange-50',
    securityDeposit: 1000,
    maxAdLimit: 100000,
    requirements: { minOrders: 100, minCompletionRate: 95 },
    permissions: ['V-Badge', 'Premium Placement', 'Block Trade Access']
  },
  Silver: {
    id: 'Silver',
    label: 'Verified Silver',
    badgeColor: 'text-gray-300 bg-gray-100',
    securityDeposit: 2000,
    maxAdLimit: 250000,
    requirements: { minOrders: 300, minCompletionRate: 98 },
    permissions: ['All Bronze Permissions', 'Dedicated Account Manager']
  },
  Gold: {
    id: 'Gold',
    label: 'Verified Gold',
    badgeColor: 'text-yellow-500 bg-yellow-50',
    securityDeposit: 5000,
    maxAdLimit: 500000,
    requirements: { minOrders: 500, minCompletionRate: 99 },
    permissions: ['All Silver Permissions', 'Whitelabel Solutions']
  },
  BlockTrade: {
    id: 'BlockTrade',
    label: 'Institutional Merchant',
    badgeColor: 'text-black bg-emerald-100',
    securityDeposit: 10000,
    maxAdLimit: 1000000,
    requirements: { minOrders: 1000 },
    permissions: ['Massive Ticket Trading', 'API Access']
  }
};

export const merchantService = {
  async submitApplication(userId: string, data: { nickname: string; tier: MerchantTierId; kycLevel?: number }): Promise<void> {
    const { error } = await supabase.from('merchant_applications').insert({
      createdBy: userId,
      nickname: data.nickname,
      tier: data.tier,
      kycLevel: data.kycLevel ?? 1,
      status: 'pending_admin_approval',
    });

    if (error) throw error;
  },

  async createProfile(userId: string, nickname: string, tier: MerchantTierId = 'Beginner'): Promise<void> {
    // Deprecated compatibility method: registration must never self-approve a merchant.
    const { error } = await supabase.from('merchant_applications').insert({
      createdBy: userId, nickname, tier, kycLevel: 1, status: 'pending_admin_approval',
    })
    if (error) throw error
  },

  async getProfile(userId: string): Promise<MerchantProfile | null> {
    const { data, error } = await supabase
      .from('merchants')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data as MerchantProfile;
  }
};
