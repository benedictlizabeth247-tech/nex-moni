'use client';

import { createClient } from '@/lib/supabase/client';
import type { Profile } from '@/types/database';

/**
 * @fileOverview Service for managing user profiles, tiers, and account limits via Supabase.
 * Profile row is 1:1 with auth.users(id); ownership is the authenticated Supabase user.
 */

export interface AccountLimit {
  type: string;
  max: number;
  used: number;
  remaining: number;
}

export interface ProfileStats {
  tier: 'nex Basic' | 'nex Elite' | 'nex Premium';
  verificationLevel: number;
  dailyLimit: AccountLimit;
  monthlyLimit: AccountLimit;
}

const TIER_LIMITS: Record<string, { daily: number; monthly: number }> = {
  'nex Basic': { daily: 50000, monthly: 300000 },
  'nex Elite': { daily: 500000, monthly: 5000000 },
  'nex Premium': { daily: 5000000, monthly: 50000000 },
};

export const getProfile = async (): Promise<Profile | null> => {
  const supabase = createClient();
  const { data: authData } = await supabase.auth.getUser();
  const uid = authData.user?.id;
  if (!uid) return null;

  const { data, error } = await supabase.from('profiles').select('*').eq('id', uid).single();
  if (error) return null;
  return data as Profile;
};

export const updateProfile = async (
  updates: Partial<Pick<Profile, 'display_name' | 'phone_number' | 'photo_url' | 'preferred_language' | 'onboarding_completed'>>,
): Promise<Profile> => {
  const supabase = createClient();
  const { data: authData } = await supabase.auth.getUser();
  const uid = authData.user?.id;
  if (!uid) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', uid)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Profile;
};

/**
 * Derives limit usage from the current calendar day/month wallet_transactions ledger
 * for the authenticated user, based on their profile tier.
 */
export const getProfileStats = async (): Promise<ProfileStats> => {
  const supabase = createClient();
  const { data: authData } = await supabase.auth.getUser();
  const uid = authData.user?.id;

  const profile = await getProfile();
  const tier = profile?.tier ?? 'nex Basic';
  const limits = TIER_LIMITS[tier] ?? TIER_LIMITS['nex Basic'];

  if (!uid) {
    return {
      tier,
      verificationLevel: profile?.kyc_level ?? 0,
      dailyLimit: { type: 'Daily', max: limits.daily, used: 0, remaining: limits.daily },
      monthlyLimit: { type: 'Monthly', max: limits.monthly, used: 0, remaining: limits.monthly },
    };
  }

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [{ data: dailyRows }, { data: monthlyRows }] = await Promise.all([
    supabase
      .from('wallet_transactions')
      .select('amount')
      .eq('user_id', uid)
      .in('type', ['transfer', 'withdrawal', 'p2p_buy'])
      .gte('created_at', startOfDay),
    supabase
      .from('wallet_transactions')
      .select('amount')
      .eq('user_id', uid)
      .in('type', ['transfer', 'withdrawal', 'p2p_buy'])
      .gte('created_at', startOfMonth),
  ]);

  const dailyUsed = (dailyRows ?? []).reduce((sum, r) => sum + Number(r.amount), 0);
  const monthlyUsed = (monthlyRows ?? []).reduce((sum, r) => sum + Number(r.amount), 0);

  return {
    tier,
    verificationLevel: profile?.kyc_level ?? 0,
    dailyLimit: {
      type: 'Daily',
      max: limits.daily,
      used: dailyUsed,
      remaining: Math.max(0, limits.daily - dailyUsed),
    },
    monthlyLimit: {
      type: 'Monthly',
      max: limits.monthly,
      used: monthlyUsed,
      remaining: Math.max(0, limits.monthly - monthlyUsed),
    },
  };
};

export const getTierBenefits = (tier: string) => {
  const benefits = {
    'nex Basic': ['Max Balance: ₦300,000', 'Daily Transfer: ₦50,000', '3 Free Transfers/mo'],
    'nex Elite': ['Max Balance: ₦5,000,000', 'Daily Transfer: ₦500,000', 'Unlimited Free Transfers', 'Priority Support'],
    'nex Premium': ['Unlimited Balance', 'Daily Transfer: ₦5,000,000+', 'Bespoke Account Manager', 'Exclusive Event Access'],
  };
  return benefits[tier as keyof typeof benefits] || benefits['nex Basic'];
};
