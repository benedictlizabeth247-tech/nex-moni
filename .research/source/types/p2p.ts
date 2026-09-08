export type P2POrderType = 'BUY' | 'SELL';
export type P2PTradeStatus = 
  | 'pending_payment' 
  | 'payment_marked' 
  | 'escrow_locked' 
  | 'completed' 
  | 'cancelled' 
  | 'disputed';

export interface P2PListing {
  id: string;
  advertiser_id: string;
  advertiser_name: string;
  type: P2POrderType;
  asset_type: string;
  fiat_currency: string;
  exchange_rate: number;
  min_limit: number;
  max_limit: number;
  available_amount: number;
  payment_methods: string[];
  is_active: boolean;
  completion_rate: number;
  total_orders: number;
  created_at: string;
}

export interface P2PTrade {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  trade_amount_fiat: number;
  trade_amount_asset: number;
  status: P2PTradeStatus;
  escrow_timer_expires_at: string;
  created_at: string;
  seller_bank_details?: {
    bank_name: string;
    account_number: string;
    account_name: string;
  };
}
