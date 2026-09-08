'use client';

/**
 * @fileOverview Service for managing KYC (Know Your Customer) verification states.
 */

export type KycStatus = 'pending' | 'verified' | 'unverified' | 'action_required';

export interface KycLevel {
  level: number;
  title: string;
  status: KycStatus;
  requirement: string;
  limit: string;
}

export const getKycLevels = async (): Promise<KycLevel[]> => {
  return [
    {
      level: 1,
      title: 'Email & Phone',
      status: 'verified',
      requirement: 'Verified contact details',
      limit: '₦50,000 Daily'
    },
    {
      level: 2,
      title: 'Identity (BVN/NIN)',
      status: 'verified',
      requirement: 'BVN and valid ID',
      limit: '₦500,000 Daily'
    },
    {
      level: 3,
      title: 'Address Verification',
      status: 'unverified',
      requirement: 'Utility bill or bank statement',
      limit: 'Unlimited'
    }
  ];
};

export const verifyBvn = async (bvn: string): Promise<{ success: boolean; name?: string; error?: string }> => {
  await new Promise(r => setTimeout(r, 2000));
  if (bvn.length === 11) {
    return { success: true, name: 'CHUKWUMA OGBONNA' };
  }
  return { success: false, error: 'Invalid BVN length' };
};
