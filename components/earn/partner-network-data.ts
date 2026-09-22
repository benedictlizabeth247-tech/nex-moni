export type PlatformMetric = { label: string; value: string; sourceUrl?: string }

export type PartnerPlatform = {
  id: string
  name: string
  slug: string
  logoUrl: string
  category: string
  description: string
  extendedDescription: string
  relationshipType: "technology_partner" | "ecosystem_listing" | "affiliate" | "integrated" | "community" | "campaign"
  relationshipVerified: boolean
  relationshipDisplayLabel: string
  relationshipAgreementReference?: string
  relationshipVerifiedAt?: string
  commissionEnabled: boolean
  commissionDisclosureRequired: boolean
  officialUrl: string
  route: string
  headquarters: string
  founded?: string
  metrics: PlatformMetric[]
  displayOrder: number
}

const logo = (domain: string) => `https://www.google.com/s2/favicons?domain=${domain}&sz=128`
const metric = (value: string, label: string): PlatformMetric => ({ value, label })

const base = (data: Omit<PartnerPlatform, "relationshipType" | "relationshipVerified" | "relationshipDisplayLabel" | "commissionEnabled" | "commissionDisclosureRequired">): PartnerPlatform => ({
  ...data,
  relationshipType: "ecosystem_listing",
  relationshipVerified: false,
  relationshipDisplayLabel: "Ecosystem listing",
  commissionEnabled: false,
  commissionDisclosureRequired: false,
})

export const partnerPlatforms: PartnerPlatform[] = [
  base({ id: "braintrust", name: "Braintrust", slug: "braintrust", logoUrl: logo("usebraintrust.com"), category: "Freelance", description: "Professional freelance & talent network", extendedDescription: "Discover professional freelance, contract and talent opportunities through the Braintrust network. It appears here as an additional ecosystem beyond NexMonie Bounties.", officialUrl: "https://www.usebraintrust.com", route: "/earn/platform/braintrust", headquarters: "San Francisco, California, USA", founded: "2018", metrics: [metric("2M+", "Vetted professionals"), metric("100+", "Countries")], displayOrder: 1 }),
  base({ id: "laborx", name: "LaborX", slug: "laborx", logoUrl: logo("laborx.com"), category: "Freelance", description: "Crypto freelance jobs & gigs", extendedDescription: "Explore freelance and employment opportunities designed for the crypto-native economy, built by Chrono.tech.", officialUrl: "https://laborx.com", route: "/earn/platform/laborx", headquarters: "Sydney, New South Wales, Australia", metrics: [metric("100K+", "Registered users — previously publicly stated"), metric("30K+", "Fixed-price gigs — previously publicly stated")], displayOrder: 2 }),
  base({ id: "bondex", name: "Bondex", slug: "bondex", logoUrl: logo("bondex.app"), category: "Jobs / Talent", description: "Web3 jobs, talent & referrals", extendedDescription: "Discover Web3 career opportunities, professional networking and referral opportunities beyond the native NexMonie feed.", officialUrl: "https://bondex.app", route: "/earn/platform/bondex", headquarters: "Miami, Florida, USA", founded: "2021", metrics: [metric("6M+", "Mobile app downloads"), metric("350K+", "Monthly active users"), metric("600K+", "Verified profiles")], displayOrder: 3 }),
  base({ id: "dework", name: "Dework", slug: "dework", logoUrl: logo("dework.xyz"), category: "Tasks / Bounties", description: "DAO tasks, bounties & contributor work", extendedDescription: "Find contributor tasks and bounty-based work across Web3 communities. Dework supports task management, bounties, token payments and wallet integrations.", officialUrl: "https://dework.xyz", route: "/earn/platform/dework", headquarters: "Stockholm, Sweden", founded: "2021", metrics: [metric("Hundreds", "DAOs / organizations")], displayOrder: 4 }),
  base({ id: "superteam", name: "Superteam Earn", slug: "superteam", logoUrl: logo("superteam.fun"), category: "Bounties / Projects", description: "Web3 bounties, projects & hackathons", extendedDescription: "Discover additional opportunities across the broader Superteam Earn ecosystem. This profile is a gateway to the wider platform and does not duplicate the live Superteam bounty feed above.", officialUrl: "https://superteam.fun/earn", route: "/earn/platform/superteam", headquarters: "Singapore", metrics: [metric("$15.845M", "Total value earned"), metric("3,124", "Opportunities listed")], displayOrder: 5 }),
  base({ id: "layer3", name: "Layer3", slug: "layer3", logoUrl: logo("layer3.xyz"), category: "Quests / Activations", description: "Web3 quests, activations & rewards", extendedDescription: "Explore curated onchain activations, quests, rewards and Web3 experiences beyond freelance work.", officialUrl: "https://layer3.xyz", route: "/earn/platform/layer3", headquarters: "Miami, Florida, USA", founded: "2021", metrics: [metric("3M+", "Users"), metric("500M+", "Transactions"), metric("40+", "Chains"), metric("500+", "Apps")], displayOrder: 6 }),
  base({ id: "galxe", name: "Galxe", slug: "galxe", logoUrl: logo("galxe.com"), category: "Quests / Campaigns", description: "Web3 quests, campaigns & rewards", extendedDescription: "Discover community campaigns, quests and Web3 engagement opportunities across a broad ecosystem.", officialUrl: "https://galxe.com", route: "/earn/platform/galxe", headquarters: "Menlo Park, California, USA", founded: "2021", metrics: [metric("7M+", "Users"), metric("7,000+", "Brands"), metric("1.1B+", "Quests completed")], displayOrder: 7 }),
  base({ id: "zealy", name: "Zealy", slug: "zealy", logoUrl: logo("zealy.io"), category: "Quests / Rewards", description: "Community quests & rewards", extendedDescription: "Explore community quests and reward-based participation across Web3 ecosystems without presenting this listing as an endorsement.", officialUrl: "https://zealy.io", route: "/earn/platform/zealy", headquarters: "Paris, France", founded: "2022", metrics: [metric("Millions", "Contributors"), metric("Thousands", "Businesses")], displayOrder: 8 }),
  base({ id: "github", name: "GitHub", slug: "github", logoUrl: logo("github.com"), category: "Developer / Open Source", description: "Open-source projects, issues & developer work", extendedDescription: "Discover developer opportunities through repositories, issues, open-source contributions and project communities.", officialUrl: "https://github.com", route: "/earn/platform/github", headquarters: "San Francisco, California, USA", founded: "2008", metrics: [metric("225M+", "Developers"), metric("4M+", "Organizations"), metric("800M+", "Repositories")], displayOrder: 9 }),
  base({ id: "gitlab", name: "GitLab", slug: "gitlab", logoUrl: logo("gitlab.com"), category: "Developer / Open Source", description: "Open-source work, issues & DevSecOps projects", extendedDescription: "Explore software projects, issues and contributor opportunities across GitLab.", officialUrl: "https://gitlab.com", route: "/earn/platform/gitlab", headquarters: "San Francisco, California, USA", founded: "2014", metrics: [metric("50M+", "Registered users"), metric("5,500+", "Code contributors"), metric("2,500+", "Team members")], displayOrder: 10 }),
  base({ id: "metamask", name: "MetaMask", slug: "metamask", logoUrl: logo("metamask.io"), category: "Web3 Access", description: "Wallet & Web3 application access", extendedDescription: "Connect to Web3 applications, manage wallet access and explore supported onchain experiences. MetaMask is an access layer, not a jobs marketplace.", officialUrl: "https://metamask.io", route: "/earn/platform/metamask", headquarters: "Fort Worth, Texas, USA", founded: "2016", metrics: [metric("100M+", "Downloads"), metric("190+", "Countries"), metric("Trillions", "Cumulative transaction volume")], displayOrder: 11 }),
]
