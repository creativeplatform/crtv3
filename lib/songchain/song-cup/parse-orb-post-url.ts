const LENS_POST_ID_PATTERN = /0x[0-9a-f]{40,}/i;

/** Extract a Lens post id from an Orb URL or raw id string. */
export function parseOrbPostUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (/^0x[0-9a-f]+$/i.test(trimmed)) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    if (!parsed.hostname.includes("orb.club")) return null;

    const segments = parsed.pathname.split("/").filter(Boolean);
    for (let i = segments.length - 1; i >= 0; i -= 1) {
      const match = segments[i].match(LENS_POST_ID_PATTERN);
      if (match) return match[0];
    }

    const hashMatch = parsed.hash.match(LENS_POST_ID_PATTERN);
    if (hashMatch) return hashMatch[0];
  } catch {
    const inline = trimmed.match(LENS_POST_ID_PATTERN);
    if (inline) return inline[0];
  }

  return null;
}

export function isOrbPostUrl(input: string): boolean {
  return parseOrbPostUrl(input) !== null || input.trim().includes("orb.club");
}
