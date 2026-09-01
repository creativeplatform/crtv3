import { LOCK_ADDRESSES, type LockAddressValue } from "@/lib/sdk/unlock/services";

export type MembershipTierConfig = {
  name: string;
  price: string;
  periodLabel: string;
  priceLabel: string;
  decimals: number;
  address: LockAddressValue;
  features: string[];
  detailedFeatures: string[];
  recommended?: boolean;
};

/**
 * Memberships offered for purchase. Plus locks are retired — AI agents are
 * purchased/deployed on Pinata and connected from the creator profile.
 * Existing Plus holders still map to the matching base tier via
 * {@link getTierIndexByAddress}.
 */
export const MEMBERSHIP_TIERS: MembershipTierConfig[] = [
  {
    name: "Creative Creator Pass",
    price: "10",
    periodLabel: "per month",
    priceLabel: "$10 USD per month",
    decimals: 6,
    address: LOCK_ADDRESSES.BASE_CREATIVE_PASS,
    features: [
      "Community Access",
      "Weekly Challenges",
      "Bring Your Own Pinata Agent",
    ],
    detailedFeatures: [
      "Access to exclusive creative resources and events",
      "Media exposure opportunities",
      "Seasonal creative challenges and competitions",
      "Competitive revenue sharing and earning opportunities",
      "Access to creative Web3/AI software and tools",
      "Community feedback and collaboration spaces",
      "Attach a Pinata AI agent to your profile for live streams (purchase/deploy on Pinata)",
    ],
  },
  {
    name: "Creative Investor Pass",
    price: "100",
    periodLabel: "per month",
    priceLabel: "$100 USD per month",
    decimals: 6,
    address: LOCK_ADDRESSES.BASE_CREATIVE_PASS_2,
    features: ["Priority Access", "Investment Reports", "Direct Creator Access"],
    detailedFeatures: [
      "Exclusive access to emerging creative talent",
      "Priority investment opportunities in creative projects",
      "Detailed market analysis and trend reports",
      "Direct connections with top-tier creators",
      "Portfolio diversification strategies",
      "Exclusive investor-only events and networking",
      "Advanced analytics and performance tracking",
    ],
    recommended: true,
  },
  {
    name: "Creative Brand Pass",
    price: "1000",
    periodLabel: "per month",
    priceLabel: "$1,000 USD per month",
    decimals: 6,
    address: LOCK_ADDRESSES.BASE_CREATIVE_PASS_3,
    features: [
      "Partnership Opportunities",
      "Brand Showcase",
      "Strategic Consulting",
    ],
    detailedFeatures: [
      "Curated creator partnerships and collaborations",
      "Custom brand integration and storytelling campaigns",
      "Access to premium creative talent pool",
      "Strategic marketing consultation and campaign planning",
      "Exclusive brand showcase and visibility opportunities",
      "Priority access to trending creators and influencers",
      "Comprehensive brand analytics and ROI tracking",
    ],
  },
];

/** Retired Plus locks → matching base tier address (for UI highlight / upgrades). */
const PLUS_TO_BASE_TIER: Record<string, LockAddressValue> = {
  [LOCK_ADDRESSES.BASE_CREATIVE_CREATOR_PLUS.toLowerCase()]:
    LOCK_ADDRESSES.BASE_CREATIVE_PASS,
  [LOCK_ADDRESSES.BASE_CREATIVE_INVESTOR_PLUS.toLowerCase()]:
    LOCK_ADDRESSES.BASE_CREATIVE_PASS_2,
  [LOCK_ADDRESSES.BASE_CREATIVE_BRAND_PLUS.toLowerCase()]:
    LOCK_ADDRESSES.BASE_CREATIVE_PASS_3,
};

export function getTierIndexByAddress(address?: string | null): number {
  if (!address) return 0;
  const normalized = address.toLowerCase();
  const resolved =
    PLUS_TO_BASE_TIER[normalized] ?? (address as LockAddressValue);
  const index = MEMBERSHIP_TIERS.findIndex(
    (tier) => tier.address.toLowerCase() === resolved.toLowerCase()
  );
  return index >= 0 ? index : 0;
}

export function isCurrentTier(
  tierAddress: string,
  currentMembershipAddress?: string
): boolean {
  if (!currentMembershipAddress) return false;
  const current = currentMembershipAddress.toLowerCase();
  const tier = tierAddress.toLowerCase();
  if (tier === current) return true;
  // Treat a Plus lock as "current" for its matching base tier card.
  return PLUS_TO_BASE_TIER[current]?.toLowerCase() === tier;
}
