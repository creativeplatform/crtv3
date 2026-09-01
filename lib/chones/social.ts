export const CHONES_X_HANDLE = "ChonesWeaving";
export const CREATIVE_TV_X_HANDLE = "CreativeCrtv";
export const NEARCHOS_X_HANDLE = "Nearchos_xyz";

export const CHONES_X_URL = `https://x.com/${CHONES_X_HANDLE}`;
export const CREATIVE_TV_X_URL = `https://x.com/${CREATIVE_TV_X_HANDLE}`;
export const NEARCHOS_X_URL = `https://x.com/${NEARCHOS_X_HANDLE}`;

export const HACK_BETA_HASHTAG = "ChonesHackBeta";

export function buildHackBetaShareText(opts?: {
  title?: string | null;
  pageUrl?: string;
}): string {
  const title = opts?.title?.trim();
  const pageUrl = opts?.pageUrl?.trim();
  const lines = [
    title
      ? `Check out my HACKATHON BETA demo: ${title}`
      : "Check out Chones HACKATHON BETA on Creative TV",
    `@${CHONES_X_HANDLE} @${CREATIVE_TV_X_HANDLE} @${NEARCHOS_X_HANDLE} #${HACK_BETA_HASHTAG}`,
  ];
  if (pageUrl) lines.push(pageUrl);
  return lines.join("\n\n");
}

export function buildHackBetaTweetIntentUrl(opts?: {
  title?: string | null;
  pageUrl?: string;
}): string {
  const text = encodeURIComponent(buildHackBetaShareText(opts));
  return `https://twitter.com/intent/tweet?text=${text}`;
}
