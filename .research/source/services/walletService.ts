'use client';

import { createClient } from '@/lib/supabase/client';
import type { Wallet, WalletTransaction, WalletBalanceField, WalletTransactionType } from '@/types/database';

export type { Wallet, WalletTransaction };

/**
 * @fileOverview Core service for managing wallet identities and balances via Supabase.
 * All balance mutations go through security-definer RPCs (wallet_credit / wallet_debit /
 * wallet_transfer_internal) so a client can never write wallets.* directly. Ownership is
 * always scoped to the authenticated Supabase user (auth.uid()), never a client-supplied id.
 */

export interface WalletIdentity {
  walletNumber: string;
  nexId: string;
  accountName: string;
  status: 'Active' | 'Suspended' | 'Restricted';
  verificationStatus: 'Verified' | 'Pending' | 'Tier 1' | 'Tier 2' | 'Tier 3';
  memberSince: string;
  tier: string;
}

const STATUS_MAP: Record<string, WalletIdentity['status']> = {
  active: 'Active',
  frozen: 'Suspended',
  restricted: 'Restricted',
};

export const getWalletIdentity = async (userId?: string): Promise<WalletIdentity | null> => {
  const supabase = createClient();
  const { data: authData } = await supabase.auth.getUser();
  const uid = authData.user?.id;
  if (!uid) return null;
  // userId param (if passed) is informational only; ownership is always the authenticated user.
  if (userId && userId !== uid) return null;

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', uid)
    .single();

  if (profileError || !profile) return null;

  const { data: wallet } = await supabase
    .from('wallets')
    .select('*')
    .eq('user_id', uid)
    .single();

  return {
    walletNumber: wallet?.id || '---',
    nexId: profile.nex_user_id,
    accountName: profile.display_name || 'Nex Member',
    status: STATUS_MAP[wallet?.status ?? 'active'] ?? 'Active',
    verificationStatus: profile.is_verified ? 'Tier 3' : 'Tier 1',
    memberSince: profile.created_at
      ? new Date(profile.created_at).toLocaleDateString()
      : 'Recently',
    tier: profile.tier || 'nex Basic',
  };
};

export const getWallet = async (): Promise<Wallet | null> => {
  const supabase = createClient();
  const { data: authData } = await supabase.auth.getUser();
  const uid = authData.user?.id;
  if (!uid) return null;

  const { data, error } = await supabase.from('wallets').select('*').eq('user_id', uid).single();
  if (error) return null;
  return data as Wallet;
};

export const getTransactions = async (limit = 20): Promise<WalletTransaction[]> => {
  const supabase = createClient();
  const { data: authData } = await supabase.auth.getUser();
  const uid = authData.user?.id;
  if (!uid) return [];

  const { data, error } = await supabase
    .from('wallet_transactions')
    .select('*')
    .eq('user_id', uid)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return [];
  return (data ?? []) as WalletTransaction[];
};

/**
 * Credits the authenticated user's own wallet via the wallet_credit RPC (security definer).
 * Never writes wallets.* directly - balances are server/database controlled.
 */
export const updateBalance = async (
  amount: number,
  options?: {
    title?: string;
    type?: WalletTransactionType;
    category?: string;
    balanceField?: WalletBalanceField;
    referenceId?: string;
  },
) => {
  const supabase = createClient();
  if (amount === 0) return null;

  const isCredit = amount > 0;
  const rpc = isCredit ? 'wallet_credit' : 'wallet_debit';
  const { data, error } = await supabase.rpc(rpc, {
    p_amount: Math.abs(amount),
    p_title: options?.title ?? (isCredit ? 'Wallet credit' : 'Wallet debit'),
    p_type: options?.type ?? (isCredit ? 'income' : 'expense'),
    p_category: options?.category ?? 'General',
    p_balance_field: options?.balanceField ?? 'available',
    p_reference_id: options?.referenceId ?? null,
  });

  if (error) throw new Error(error.message);
  return data as WalletTransaction;
};

export const transferInternal = async (
  amount: number,
  fromField: WalletBalanceField,
  toField: WalletBalanceField,
  title = 'Internal transfer',
) => {
  const supabase = createClient();
  const { error } = await supabase.rpc('wallet_transfer_internal', {
    p_amount: amount,
    p_from_field: fromField,
    p_to_field: toField,
    p_title: title,
  });
  if (error) throw new Error(error.message);
};
