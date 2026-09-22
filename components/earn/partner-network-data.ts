export type PartnerPlatform = {
  id: string
  name: string
  slug: string
  logoUrl: string
  category: string
  description: string
  extendedDescription: string
  relationship: string
  officialUrl: string
  route: string
  displayOrder: number
}

const logo = (slug: string) => `https://cdn.simpleicons.org/${slug}`

export const partnerPlatforms: PartnerPlatform[] = [
  { id: "braintrust", name: "Braintrust", slug: "braintrust", logoUrl: logo("braintrust"), category: "Freelance", description: "Professional freelance & talent network", extendedDescription: "Discover professional freelance, contract and talent opportunities through the Braintrust network.", relationship: "Platform Access", officialUrl: "https://www.usebraintrust.com", route: "/earn/platform/braintrust", displayOrder: 1 },
  { id: "laborx", name: "LaborX", slug: "laborx", logoUrl: logo("laborx"), category: "Freelance", description: "Crypto freelance jobs & gigs", extendedDescription: "Explore freelance work designed for the crypto-native economy.", relationship: "Platform Access", officialUrl: "https://laborx.com", route: "/earn/platform/laborx", displayOrder: 2 },
  { id: "bondex", name: "Bondex", slug: "bondex", logoUrl: logo("bondex"), category: "Jobs / Talent", description: "Web3 jobs, talent & referrals", extendedDescription: "Discover Web3 career opportunities, professional networking and referral opportunities.", relationship: "Platform Access", officialUrl: "https://bondex.app", route: "/earn/platform/bondex", displayOrder: 3 },
  { id: "dework", name: "Dework", slug: "dework", logoUrl: logo("dework"), category: "Tasks / Bounties", description: "DAO tasks, bounties & contributor work", extendedDescription: "Find contributor tasks and bounty-based work across Web3 communities.", relationship: "Platform Access", officialUrl: "https://dework.xyz", route: "/earn/platform/dework", displayOrder: 4 },
  { id: "superteam", name: "Superteam Earn", slug: "superteam", logoUrl: logo("superteam"), category: "Bounties / Projects", description: "Web3 bounties, projects & hackathons", extendedDescription: "Discover additional opportunities across the broader Superteam Earn ecosystem.", relationship: "Integrated", officialUrl: "https://superteam.fun/earn", route: "/earn/platform/superteam", displayOrder: 5 },
  { id: "layer3", name: "Layer3", slug: "layer3", logoUrl: logo("layer3"), category: "Quests / Activations", description: "Web3 quests, activations & rewards", extendedDescription: "Explore curated onchain activations, quests and rewards.", relationship: "Platform Access", officialUrl: "https://layer3.xyz", route: "/earn/platform/layer3", displayOrder: 6 },
  { id: "galxe", name: "Galxe", slug: "galxe", logoUrl: logo("galxe"), category: "Quests / Campaigns", description: "Web3 quests, campaigns & rewards", extendedDescription: "Discover community campaigns, quests and Web3 engagement opportunities.", relationship: "Platform Access", officialUrl: "https://galxe.com", route: "/earn/platform/galxe", displayOrder: 7 },
  { id: "zealy", name: "Zealy", slug: "zealy", logoUrl: logo("zealy"), category: "Quests / Rewards", description: "Community quests & rewards", extendedDescription: "Explore community quests and reward-based participation across Web3 ecosystems.", relationship: "Platform Access", officialUrl: "https://zealy.io", route: "/earn/platform/zealy", displayOrder: 8 },
  { id: "github", name: "GitHub", slug: "github", logoUrl: logo("github"), category: "Developer / Open Source", description: "Open-source projects, issues & developer work", extendedDescription: "Discover developer opportunities through repositories, issues, open-source contributions and project communities.", relationship: "Platform Access", officialUrl: "https://github.com", route: "/earn/platform/github", displayOrder: 9 },
  { id: "gitlab", name: "GitLab", slug: "gitlab", logoUrl: logo("gitlab"), category: "Developer / Open Source", description: "Open-source work, issues & DevSecOps projects", extendedDescription: "Explore software projects, issues and contributor opportunities across GitLab.", relationship: "Platform Access", officialUrl: "https://gitlab.com", route: "/earn/platform/gitlab", displayOrder: 10 },
  { id: "metamask", name: "MetaMask", slug: "metamask", logoUrl: logo("metamask"), category: "Web3 Access", description: "Wallet & Web3 application access", extendedDescription: "Connect to Web3 applications, manage wallet access and explore supported onchain experiences.", relationship: "Web3 Access", officialUrl: "https://metamask.io", route: "/earn/platform/metamask", displayOrder: 11 },
]
