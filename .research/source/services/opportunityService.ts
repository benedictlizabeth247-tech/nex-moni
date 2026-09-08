'use client';

/**
 * @fileOverview Modular service for Web3 opportunities.
 * Prepared for Supabase 'opportunities' and 'organizations' tables.
 */

export type OpportunityCategory = 
  | 'Job' | 'Bounty' | 'Hackathon' | 'Grant' 
  | 'Quest' | 'Airdrop' | 'Ambassador' | 'Content' 
  | 'Development' | 'Design' | 'Marketing' | 'Community';

export type Difficulty = 'Beginner' | 'Intermediate' | 'Expert';

export interface Opportunity {
  id: string;
  title: string;
  organizationId: string;
  organizationName: string;
  isVerified: boolean;
  shortDescription: string;
  description: string;
  rewardAmount: number;
  rewardCurrency: string;
  category: OpportunityCategory;
  location: string;
  isRemote: boolean;
  difficulty: Difficulty;
  deadline: string;
  estimatedTime: string;
  applicantsCount: number;
  tags: string[];
  isFeatured: boolean;
  isSaved?: boolean;
  isApplied?: boolean;
  ecosystem?: string;
  requirements?: string[];
  benefits?: string[];
}

export const getMockOpportunities = async (): Promise<Opportunity[]> => {
  // Simulate network delay
  await new Promise(r => setTimeout(r, 800));

  return [
    {
      id: 'opp-1',
      title: 'Decentralized Identity Framework Grant',
      organizationId: 'solana-fdn',
      organizationName: 'Solana Foundation',
      isVerified: true,
      shortDescription: 'Propose and build a zero-knowledge identity layer for the Solana ecosystem.',
      description: 'The Solana Foundation is looking for high-impact teams to build robust, scalable, and privacy-preserving identity solutions. This grant covers initial research, architecture design, and a functional MVP.',
      rewardAmount: 15000,
      rewardCurrency: 'USDC',
      category: 'Grant',
      location: 'Global',
      isRemote: true,
      difficulty: 'Expert',
      deadline: '2024-04-15',
      estimatedTime: '3 Months',
      applicantsCount: 82,
      tags: ['ZK', 'Rust', 'Identity'],
      isFeatured: true,
      ecosystem: 'Solana',
      requirements: [
        'Proven experience with Rust and Solana core',
        'Understanding of ZK-proof constructions',
        'Detailed technical roadmap'
      ],
      benefits: [
        'Direct mentorship from Solana core engineers',
        'Integration support',
        'Co-marketing opportunities'
      ]
    },
    {
      id: 'opp-2',
      title: 'Technical Documentation Writing',
      organizationId: 'superteam-ng',
      organizationName: 'Superteam Nigeria',
      isVerified: true,
      shortDescription: 'Create comprehensive developer guides for the latest nexMonie SDK updates.',
      description: 'Help developers onboard into the nexMonie ecosystem by writing clear, concise, and accurate technical documentation for our new payment APIs.',
      rewardAmount: 500000,
      rewardCurrency: 'NGN',
      category: 'Content',
      location: 'Nigeria',
      isRemote: true,
      difficulty: 'Intermediate',
      deadline: '2024-03-30',
      estimatedTime: '2 Weeks',
      applicantsCount: 14,
      tags: ['Writing', 'API', 'Fintech'],
      isFeatured: false,
      ecosystem: 'nexMonie',
      requirements: [
        'Strong English writing skills',
        'Basic understanding of Next.js and APIs',
        'Ability to simplify complex technical concepts'
      ]
    },
    {
      id: 'opp-3',
      title: 'Community Moderator (Global)',
      organizationId: 'jupiter-exchange',
      organizationName: 'Jupiter',
      isVerified: true,
      shortDescription: 'Engage with and moderate the Jupiter community across Discord and X.',
      description: 'Join the Jupiter family and help us maintain a positive, helpful environment for our global user base.',
      rewardAmount: 2500,
      rewardCurrency: 'USDC',
      category: 'Community',
      location: 'Remote',
      isRemote: true,
      difficulty: 'Beginner',
      deadline: '2024-04-01',
      estimatedTime: 'Long-term',
      applicantsCount: 450,
      tags: ['Discord', 'Social', 'Global'],
      isFeatured: true,
      ecosystem: 'Solana'
    }
  ];
};
