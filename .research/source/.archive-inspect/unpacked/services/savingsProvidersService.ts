'use client'

export type ProviderStatus = 'available' | 'coming-soon'

export interface SavingsProduct {
  id: string
  name: string
  description: string
}

export interface SavingsProvider {
  id: string
  name: string
  logo: string
  category: string
  tagline: string
  description: string
  rate: string
  rateType: 'variable' | 'fixed' | 'unavailable'
  minimumAmount: number | null
  status: ProviderStatus
  products: SavingsProduct[]
  terms?: string
}

/**
 * Savings-focused Nigerian platforms. Investment-only products (e.g. Bamboo,
 * Risevest, Trove) are intentionally excluded — they belong in Investments.
 *
 * Rates change frequently, so they are not hardcoded as permanent values.
 * `rate` is a display string ("Rate varies") and is structured so a real,
 * verified rate can be supplied from the provider/source later.
 */
export const SAVINGS_PROVIDERS: SavingsProvider[] = [
  {
    id: 'piggyvest',
    name: 'PiggyVest',
    logo: 'P',
    category: 'Savings platform',
    tagline: 'Flexible and goal-based savings',
    description:
      'One of Nigeria’s most widely used savings platforms, offering flexible savings, locked savings and goal-based plans.',
    rate: 'Rate varies',
    rateType: 'variable',
    minimumAmount: null,
    status: 'available',
    products: [
      { id: 'flex', name: 'Flex Naira', description: 'Save and withdraw anytime.' },
      { id: 'safelock', name: 'SafeLock', description: 'Lock funds for a set period.' },
      { id: 'target', name: 'Target Savings', description: 'Save towards a specific goal.' },
      { id: 'auto', name: 'PiggyBank', description: 'Automated recurring savings.' },
    ],
    terms: 'Products, rates and terms are provided and managed by PiggyVest.',
  },
  {
    id: 'cowrywise',
    name: 'Cowrywise',
    logo: 'C',
    category: 'Savings platform',
    tagline: 'Automated and goal savings',
    description:
      'Automated savings platform for building disciplined saving habits with regular, goal and fixed savings plans.',
    rate: 'Rate varies',
    rateType: 'variable',
    minimumAmount: null,
    status: 'available',
    products: [
      { id: 'regular', name: 'Regular Savings', description: 'Flexible everyday savings.' },
      { id: 'goals', name: 'Life Goals', description: 'Save towards personal goals.' },
      { id: 'fixed', name: 'Fixed Savings', description: 'Lock funds for higher stability.' },
    ],
    terms: 'Products, rates and terms are provided and managed by Cowrywise.',
  },
  {
    id: 'sumotrust',
    name: 'SumoTrust',
    logo: 'S',
    category: 'Savings platform',
    tagline: 'Automated micro-savings',
    description:
      'Digital savings platform focused on automated micro-savings and fixed savings towards long-term goals.',
    rate: 'Rate varies',
    rateType: 'variable',
    minimumAmount: null,
    status: 'available',
    products: [
      { id: 'auto', name: 'Automated Savings', description: 'Save small amounts automatically.' },
      { id: 'fixed', name: 'Fixed Savings', description: 'Lock funds for a chosen term.' },
    ],
    terms: 'Products, rates and terms are provided and managed by SumoTrust.',
  },
  {
    id: 'alat',
    name: 'ALAT by Wema',
    logo: 'A',
    category: 'Savings platform',
    tagline: 'Goal and target savings',
    description:
      'Digital bank by Wema with dedicated goal savings and target savings tools for planned saving.',
    rate: 'Rate varies',
    rateType: 'variable',
    minimumAmount: null,
    status: 'available',
    products: [
      { id: 'goal', name: 'Goal Savings', description: 'Save towards a defined goal.' },
      { id: 'target', name: 'Target Savings', description: 'Scheduled saving towards a target.' },
    ],
    terms: 'Products, rates and terms are provided and managed by ALAT by Wema.',
  },
  {
    id: 'carbon',
    name: 'Carbon',
    logo: 'Cb',
    category: 'Savings platform',
    tagline: 'Flexible and locked savings',
    description:
      'Financial app offering flexible and locked savings options alongside everyday money tools.',
    rate: 'Rate varies',
    rateType: 'variable',
    minimumAmount: null,
    status: 'available',
    products: [
      { id: 'flex', name: 'Flex Save', description: 'Save and access funds flexibly.' },
      { id: 'vault', name: 'Vault', description: 'Lock funds for a fixed period.' },
    ],
    terms: 'Products, rates and terms are provided and managed by Carbon.',
  },
  {
    id: 'palmpay',
    name: 'PalmPay Cashbox',
    logo: 'Pp',
    category: 'Savings product',
    tagline: 'Flexible and fixed savings',
    description:
      'Cashbox savings within PalmPay, offering flexible and fixed savings on your balance.',
    rate: 'Rate varies',
    rateType: 'variable',
    minimumAmount: null,
    status: 'available',
    products: [
      { id: 'flexible', name: 'Flexible Cashbox', description: 'Save and withdraw anytime.' },
      { id: 'fixed', name: 'Fixed Cashbox', description: 'Lock funds for a set term.' },
    ],
    terms: 'Products, rates and terms are provided and managed by PalmPay.',
  },
  {
    id: 'sparkle',
    name: 'Sparkle',
    logo: 'Sp',
    category: 'Savings platform',
    tagline: 'Savings and targets',
    description:
      'Digital financial platform with savings and target features for individuals and small businesses.',
    rate: 'Rate varies',
    rateType: 'variable',
    minimumAmount: null,
    status: 'available',
    products: [
      { id: 'savings', name: 'Savings', description: 'Flexible everyday savings.' },
      { id: 'targets', name: 'Targets', description: 'Save towards specific targets.' },
    ],
    terms: 'Products, rates and terms are provided and managed by Sparkle.',
  },
  {
    id: 'v-by-vfd',
    name: 'V by VFD',
    logo: 'V',
    category: 'Savings platform',
    tagline: 'Savings and fixed deposits',
    description:
      'Digital bank offering flexible savings and fixed deposit options for growing your money.',
    rate: 'Rate varies',
    rateType: 'variable',
    minimumAmount: null,
    status: 'available',
    products: [
      { id: 'savings', name: 'Savings', description: 'Flexible savings account.' },
      { id: 'fixed', name: 'Fixed Deposit', description: 'Lock funds for a fixed term.' },
    ],
    terms: 'Products, rates and terms are provided and managed by V by VFD.',
  },
]

export function getSavingsProviders() {
  return SAVINGS_PROVIDERS
}

export function getProviderById(id: string) {
  return SAVINGS_PROVIDERS.find((provider) => provider.id === id)
}

export function getProductById(provider: SavingsProvider, productId: string | null) {
  if (!productId) return provider.products[0]
  return provider.products.find((product) => product.id === productId) ?? provider.products[0]
}

export function formatNaira(amount: number) {
  return `₦${amount.toLocaleString('en-NG')}`
}

export function isValidSavingsAmount(amount: number, minimumAmount: number | null) {
  return Number.isInteger(amount) && amount > 0 && (minimumAmount === null || amount >= minimumAmount)
}
