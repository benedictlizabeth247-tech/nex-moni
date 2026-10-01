export type EarnPlatform = {
  platformId: string
  name: string
  slug: string
  logoUrl: string
  category: string
  description: string
  extendedDescription: string
  relationshipStatus: string
  officialUrl: string
  route: string
  displayOrder: number
  sourceType: 'official'
  brandGuidelinesUrl?: string
}

const simpleIcon = (slug: string) => `https://cdn.simpleicons.org/${slug}`

export const earnPlatforms: EarnPlatform[] = [
  { platformId: 'braintrust', name: 'Braintrust', slug: 'braintrust', logoUrl: simpleIcon('braintrust'), category: 'Freelance', description: 'Professional freelance & talent network', extendedDescription: 'Discover professional freelance, contract and talent opportunities through the Braintrust network.', relationshipStatus: 'Platform Access', officialUrl: 'https://www.usebraintrust.com/', route: '/earn/platform/braintrust', displayOrder: 1, sourceType: 'official', brandGuidelinesUrl: 'https://www.usebraintrust.com/brand' },
  { platformId: 'laborx', name: 'LaborX', slug: 'laborx', logoUrl: simpleIcon('laborx'), category: 'Freelance', description: 'Crypto freelance jobs & gigs', extendedDescription: 'Explore freelance work designed for the crypto-native economy.', relationshipStatus: 'Platform Access', officialUrl: 'https://laborx.com/', route: '/earn/platform/laborx', displayOrder: 2, sourceType: 'official' },
  { platformId: 'bondex', name: 'Bondex', slug: 'bondex', logoUrl: simpleIcon('bondex'), category: 'Jobs / Talent', description: 'Web3 jobs, talent & referrals', extendedDescription: 'Discover Web3 career opportunities, professional networking and referral opportunities.', relationshipStatus: 'Platform Access', officialUrl: 'https://bondex.app/', route: '/earn/platform/bondex', displayOrder: 3, sourceType: 'official' },
  { platformId: 'dework', name: 'Dework', slug: 'dework', logoUrl: simpleIcon('dework'), category: 'Tasks / Bounties', description: 'DAO tasks, bounties & contributor work', extendedDescription: 'Find contributor tasks and bounty-based work across Web3 communities.', relationshipStatus: 'Platform Access', officialUrl: 'https://dework.xyz/', route: '/earn/platform/dework', displayOrder: 4, sourceType: 'official' },
  { platformId: 'superteam', name: 'Superteam Earn', slug: 'superteam', logoUrl: simpleIcon('superteam'), category: 'Bounties / Projects', description: 'Web3 bounties, projects & hackathons', extendedDescription: 'Discover additional opportunities across the Superteam ecosystem. The live Bounties feed above remains the primary NexMonie listing surface.', relationshipStatus: 'Integrated', officialUrl: 'https://earn.superteam.fun/', route: '/earn/platform/superteam', displayOrder: 5, sourceType: 'official' },
  { platformId: 'layer3', name: 'Layer3', slug: 'layer3', logoUrl: simpleIcon('layer3'), category: 'Quests / Activations', description: 'Web3 quests, activations & rewards', extendedDescription: 'Explore curated onchain activations, quests and rewards.', relationshipStatus: 'Platform Access', officialUrl: 'https://layer3.xyz/', route: '/earn/platform/layer3', displayOrder: 6, sourceType: 'official' },
  { platformId: 'galxe', name: 'Galxe', slug: 'galxe', logoUrl: simpleIcon('galxe'), category: 'Quests / Campaigns', description: 'Web3 quests, campaigns & rewards', extendedDescription: 'Discover community campaigns, quests and Web3 engagement opportunities.', relationshipStatus: 'Platform Access', officialUrl: 'https://app.galxe.com/', route: '/earn/platform/galxe', displayOrder: 7, sourceType: 'official' },
  { platformId: 'zealy', name: 'Zealy', slug: 'zealy', logoUrl: simpleIcon('zealy'), category: 'Quests / Rewards', description: 'Community quests & rewards', extendedDescription: 'Explore community quests and reward-based participation across Web3 ecosystems.', relationshipStatus: 'Platform Access', officialUrl: 'https://zealy.io/', route: '/earn/platform/zealy', displayOrder: 8, sourceType: 'official' },
  { platformId: 'github', name: 'GitHub', slug: 'github', logoUrl: simpleIcon('github'), category: 'Developer / Open Source', description: 'Open-source projects, issues & developer work', extendedDescription: 'Discover developer opportunities through repositories, issues, open-source contributions and project communities.', relationshipStatus: 'Platform Access', officialUrl: 'https://github.com/explore', route: '/earn/platform/github', displayOrder: 9, sourceType: 'official', brandGuidelinesUrl: 'https://brand.github.com/' },
  { platformId: 'gitlab', name: 'GitLab', slug: 'gitlab', logoUrl: simpleIcon('gitlab'), category: 'Developer / Open Source', description: 'Open-source work, issues & DevSecOps projects', extendedDescription: 'Explore software projects, issues and contributor opportunities across GitLab.', relationshipStatus: 'Platform Access', officialUrl: 'https://gitlab.com/explore', route: '/earn/platform/gitlab', displayOrder: 10, sourceType: 'official', brandGuidelinesUrl: 'https://about.gitlab.com/handbook/marketing/corporate-marketing/brand-and-product-marketing/brand-activation/' },
  { platformId: 'metamask', name: 'MetaMask', slug: 'metamask', logoUrl: simpleIcon('metamask'), category: 'Web3 Access', description: 'Wallet & Web3 application access', extendedDescription: 'Connect to Web3 applications, manage wallet access and explore supported onchain experiences.', relationshipStatus: 'Web3 Access', officialUrl: 'https://metamask.io/', route: '/earn/platform/metamask', displayOrder: 11, sourceType: 'official' },
  { platformId: 'gigwork', name: 'GIGwork', slug: 'gigwork', logoUrl: simpleIcon('gigwork'), category: 'Crowdsourcing / Microtasks', description: 'Crowdsourcing projects and microtasks', extendedDescription: 'Explore live projects and tasks from the GIGwork PyBossa API. Task runs are not presented as jobs.', relationshipStatus: 'Platform Access', officialUrl: 'https://www.gigwork.net/', route: '/earn/platform/gigwork', displayOrder: 12, sourceType: 'official', brandGuidelinesUrl: 'https://www.gigwork.net/help/api' },
]

export function getEarnPlatform(slug: string) {
  return earnPlatforms.find((platform) => platform.slug === slug)
}
