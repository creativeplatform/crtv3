export type ClubCircleMember = {
  handle: string;
  address: string | null;
  avatarUrl: string | null;
  name: string | null;
  /** Activity weight — higher = more recently active (drives node size). */
  count: number;
};

export type ClubCircleCenter = {
  label: string;
  logoUrl: string | null;
};

export type ClubCircleData = {
  center: ClubCircleCenter;
  members: ClubCircleMember[];
};

export function orbProfileUrl(member: Pick<ClubCircleMember, "handle" | "address">): string {
  const handle = member.handle?.replace(/^@/, "").trim();
  if (handle && handle !== "member") {
    return `https://orb.club/p/${encodeURIComponent(handle)}`;
  }
  if (member.address) {
    return `https://orb.club/p/${encodeURIComponent(member.address)}`;
  }
  return "https://orb.club";
}
