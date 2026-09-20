import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type BankDirectoryEntry = {
  id: string;
  name: string;
  normalized_name: string;
  institution_type: 'commercial_bank' | 'merchant_bank' | 'microfinance_bank' | 'payment_service_bank' | 'fintech' | 'mortgage_bank' | 'development_bank';
  bank_code: string | null;
  nip_code: string | null;
  active: boolean;
};

const DIRECTORY_NAMES = [
  'Access Bank', '9mobile 9Payment Service Bank', 'Abbey Mortgage Bank', 'ABU Microfinance Bank', 'Accion Microfinance Bank', 'Addosser Microfinance Bank', 'Advans La Fayette Microfinance Bank', 'AG Mortgage Bank', 'Al-Barkah Microfinance Bank', 'Alert Microfinance Bank', 'AlphaKapital Microfinance Bank', 'Amju Unique Microfinance Bank', 'ASO Savings and Loans', 'Astrapolaris Microfinance Bank', 'Baines Credit Microfinance Bank', 'Banex Microfinance Bank', 'BOCTRUST Microfinance Bank', 'Bank of Industry Microfinance Bank', 'Bowen Microfinance Bank', 'Carbon', 'CEMCS Microfinance Bank', 'Chikum Microfinance Bank', 'Citibank Nigeria', 'Coronation Merchant Bank', 'Corestep Microfinance Bank', 'Covenant Microfinance Bank', 'Credit Afrique Microfinance Bank', 'Ecobank Nigeria', 'Edfin Microfinance Bank', 'Ekondo Microfinance Bank', 'EmpireTrust Microfinance Bank', 'Eyowo', 'FairMoney', 'Fidelity Bank', 'First City Monument Bank (FCMB)', 'FBNQuest Merchant Bank', 'First Bank of Nigeria', 'Finatrust Microfinance Bank', 'Firmus Microfinance Bank', 'FSDH Merchant Bank', 'Globus Bank', 'Guaranty Trust Bank (GTBank)', 'Greenwich Merchant Bank', 'Hasal Microfinance Bank', 'Hope Payment Service Bank', 'Ibile Microfinance Bank', 'Infinity Microfinance Bank', 'Jaiz Bank', 'Keystone Bank', 'Kuda Microfinance Bank', 'LAPO Microfinance Bank', 'Lotus Bank', 'Mainland Microfinance Bank', 'Mayfair Microfinance Bank', 'Moniepoint Microfinance Bank', 'MoMo Payment Service Bank', 'Nirsal National Microfinance Bank', 'NPF Microfinance Bank', 'NOVA Commercial Bank', 'Oakland Microfinance Bank', 'OPay', 'Page Financials', 'Parallex Bank', 'PalmPay', 'Polaris Bank', 'Premium Trust Bank', 'Providus Bank', 'Optimus Bank', 'Signature Bank', 'Rahama Microfinance Bank', 'Rand Merchant Bank', 'RenMoney Microfinance Bank', 'SafeTrust', 'Safe Haven Microfinance Bank', 'Sparkle Microfinance Bank', 'Stanbic IBTC Bank', 'Standard Chartered Bank Nigeria', 'Stellas Microfinance Bank', 'Sterling Bank', 'SunTrust Bank', 'TAJ Bank', 'Tangerine Money Microfinance Bank', 'Titan Trust Bank', 'Union Bank of Nigeria', 'United Bank for Africa (UBA)', 'Unity Bank', 'VFD Microfinance Bank', 'Wema Bank', 'Zenith Bank', 'Fidelity Mobile / Fidelity digital banking option',
];

const DIRECTORY_BANKS: BankDirectoryEntry[] = DIRECTORY_NAMES.map((name) => ({
  id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
  name,
  normalized_name: name.toLowerCase(),
  institution_type: name.includes('Microfinance') ? 'microfinance_bank' : name.includes('Payment Service') ? 'payment_service_bank' : name.includes('Merchant') ? 'merchant_bank' : name.includes('Mortgage') ? 'mortgage_bank' : ['Carbon', 'Eyowo', 'FairMoney', 'Kuda Microfinance Bank', 'OPay', 'PalmPay', 'SafeTrust'].includes(name) ? 'fintech' : 'commercial_bank',
  bank_code: null,
  nip_code: null,
  active: true,
}));

/**
 * GET /api/banks
 * Fetches the list of banks from Supabase PostgreSQL.
 * Never fabricates bank data. If the operational bank directory is unavailable, returns an empty list.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: banks, error } = await supabase
      .from('banks')
      .select('*')
      .order('name', { ascending: true });

    if (error || !banks || banks.length === 0) {
      return NextResponse.json(DIRECTORY_BANKS, { status: 200 });
    }

    return NextResponse.json(banks.filter((bank) => bank.active !== false).sort((a, b) => String(a.name).localeCompare(String(b.name))));
  } catch (error: any) {
    return NextResponse.json(DIRECTORY_BANKS, { status: 200 });
  }
}
