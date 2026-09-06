'use client';

/**
 * @fileOverview Service for managing premium savings products and performance.
 */

export type SavingsType = 'Flexible' | 'Locked' | 'Goal';

export interface SavingsPlan {
  id: string;
  type: SavingsType;
  title: string;
  balance: number;
  target?: number;
  interestRate: number;
  estimatedEarnings: number;
  duration?: string;
  createdAt: string;
}

export const getSavingsOverview = async () => {
  await new Promise(r => setTimeout(r, 700));
  return {
    totalSavings: 450000,
    interestEarned: 12500.50,
    averageRate: 14.5,
    activePlans: 3
  };
};

export const getActivePlans = async (): Promise<SavingsPlan[]> => {
  return [
    {
      id: '1',
      type: 'Flexible',
      title: 'Emergency Fund',
      balance: 150000,
      interestRate: 12,
      estimatedEarnings: 1500,
      createdAt: '2023-11-01'
    },
    {
      id: '2',
      type: 'Locked',
      title: 'New Car 2024',
      balance: 300000,
      target: 5000000,
      interestRate: 18.5,
      estimatedEarnings: 4500,
      duration: '12 Months',
      createdAt: '2023-12-15'
    }
  ];
};
