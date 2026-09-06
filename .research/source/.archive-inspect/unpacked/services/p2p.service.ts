'use client';

import { createClient } from '@/lib/supabase/client';
import type { P2PAd, P2POrder, P2POrderMessage, P2PSide, Merchant } from '@/types/database';

/**
 * @fileOverview P2P marketplace service backed by Supabase.
 *
 * Escrow-sensitive lifecycle transitions (create/mark-paid/release/cancel) run through
 * security-definer RPCs so a client can never move funds or mutate another user's order
 * directly. Ads are owned/written by their creating merchant only (RLS enforced).
 */

export interface CreateAdInput {
  merchantId: string;
  side: P2PSide;
  asset: string;
  fiatCurrency?: string;
  price: number;
  availableAmount: number;
  minLimit: number;
  maxLimit: number;
  paymentMethods: string[];
  terms?: string;
}

export const p2pService = {
  // ADS
  async createAd(input: CreateAdInput): Promise<P2PAd> {
    const supabase = createClient();
    const { data: authData } = await supabase.auth.getUser();
    const uid = authData.user?.id;
    if (!uid) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('p2p_ads')
      .insert({
        merchant_id: input.merchantId,
        user_id: uid,
        side: input.side,
        asset: input.asset,
        fiat_currency: input.fiatCurrency ?? 'NGN',
        price: input.price,
        available_amount: input.availableAmount,
        min_limit: input.minLimit,
        max_limit: input.maxLimit,
        payment_methods: input.paymentMethods,
        terms: input.terms ?? null,
        status: 'active',
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as P2PAd;
  },

  async listAds(filters?: { side?: P2PSide; asset?: string }): Promise<P2PAd[]> {
    const supabase = createClient();
    let query = supabase.from('p2p_ads').select('*').eq('status', 'active');
    if (filters?.side) query = query.eq('side', filters.side);
    if (filters?.asset) query = query.eq('asset', filters.asset);
    const { data, error } = await query.order('price', { ascending: filters?.side === 'buy' });
    if (error) return [];
    return (data ?? []) as P2PAd[];
  },

  async getAd(adId: string): Promise<P2PAd | null> {
    const supabase = createClient();
    const { data, error } = await supabase.from('p2p_ads').select('*').eq('id', adId).single();
    if (error) return null;
    return data as P2PAd;
  },

  // ORDERS - all lifecycle mutations go through security-definer RPCs (escrow safety)
  async createOrder(adId: string, cryptoAmount: number): Promise<P2POrder> {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('p2p_create_order', {
      p_ad_id: adId,
      p_crypto_amount: cryptoAmount,
    });
    if (error) throw new Error(error.message);
    return data as P2POrder;
  },

  async markPaid(orderId: string): Promise<P2POrder> {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('p2p_mark_paid', { p_order_id: orderId });
    if (error) throw new Error(error.message);
    return data as P2POrder;
  },

  async releaseOrder(orderId: string): Promise<P2POrder> {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('p2p_release_order', { p_order_id: orderId });
    if (error) throw new Error(error.message);
    return data as P2POrder;
  },

  async cancelOrder(orderId: string): Promise<P2POrder> {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('p2p_cancel_order', { p_order_id: orderId });
    if (error) throw new Error(error.message);
    return data as P2POrder;
  },

  async getOrder(orderId: string): Promise<P2POrder | null> {
    const supabase = createClient();
    const { data, error } = await supabase.from('p2p_orders').select('*').eq('id', orderId).single();
    if (error) return null;
    return data as P2POrder;
  },

  async listMyOrders(): Promise<P2POrder[]> {
    const supabase = createClient();
    const { data: authData } = await supabase.auth.getUser();
    const uid = authData.user?.id;
    if (!uid) return [];

    const { data, error } = await supabase
      .from('p2p_orders')
      .select('*')
      .or(`buyer_id.eq.${uid},seller_id.eq.${uid}`)
      .order('created_at', { ascending: false });

    if (error) return [];
    return (data ?? []) as P2POrder[];
  },

  // CHAT
  async sendMessage(orderId: string, body: string, attachmentUrl?: string): Promise<P2POrderMessage> {
    const supabase = createClient();
    const { data: authData } = await supabase.auth.getUser();
    const uid = authData.user?.id;
    if (!uid) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('p2p_order_messages')
      .insert({ order_id: orderId, sender_id: uid, body, attachment_url: attachmentUrl ?? null })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as P2POrderMessage;
  },

  async listMessages(orderId: string): Promise<P2POrderMessage[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('p2p_order_messages')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });
    if (error) return [];
    return (data ?? []) as P2POrderMessage[];
  },

  subscribeToMessages(orderId: string, onMessage: (message: P2POrderMessage) => void) {
    const supabase = createClient();
    const channel = supabase
      .channel(`p2p_order_messages:${orderId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'p2p_order_messages', filter: `order_id=eq.${orderId}` },
        (payload) => onMessage(payload.new as P2POrderMessage),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  },

  // MERCHANT
  async getMerchantProfile(userId: string): Promise<Merchant | null> {
    const supabase = createClient();
    const { data, error } = await supabase.from('merchants').select('*').eq('user_id', userId).single();
    if (error) return null;
    return data as Merchant;
  },
};
