const PROFILE_TABS = ["Uploads", "Analytics", "MeTokens", "Bank", "Membership"] as const;
export type ProfileTab = (typeof PROFILE_TABS)[number];

export function getProfileMembershipUrl(address: string): string {
  return `/profile/${address}?tab=Membership`;
}

export function getProfileAnalyticsUrl(address: string): string {
  return `/profile/${address}?tab=Analytics`;
}

export function isValidProfileTab(tab: string | null): tab is ProfileTab {
  return tab !== null && PROFILE_TABS.includes(tab as ProfileTab);
}
