import {
  parseCreativeTVUrl,
  type ParsedCreativeTVUrl,
} from "@/lib/utils/creative-tv-url";

const CREATIVE_TV_HOST = "tv.creativeplatform.xyz";

/** Matches http(s) URLs in plain text. */
export const URL_IN_TEXT_REGEX = /https?:\/\/[^\s<>"']+/gi;

export type PostTextSegment =
  | { type: "text"; value: string }
  | {
      type: "internal";
      value: string;
      href: string;
      parsed: Extract<ParsedCreativeTVUrl, { kind: "discover" | "watch" }>;
    }
  | { type: "external"; value: string; href: string };

export function getInternalHref(
  parsed: Extract<ParsedCreativeTVUrl, { kind: "discover" | "watch" }>,
): string {
  if (parsed.kind === "discover") return `/discover/${parsed.assetId}`;
  return `/watch/${parsed.playbackId}`;
}

function classifyUrl(rawUrl: string, origin?: string): PostTextSegment {
  const trimmed = rawUrl.trim();

  try {
    const url = new URL(trimmed);
    const isCreativeTvHost =
      url.hostname.toLowerCase() === CREATIVE_TV_HOST ||
      (typeof window !== "undefined" &&
        url.hostname.toLowerCase() === window.location.hostname.toLowerCase());

    if (isCreativeTvHost) {
      const parsed = parseCreativeTVUrl(trimmed, { origin });
      if (parsed.kind === "discover" || parsed.kind === "watch") {
        return {
          type: "internal",
          value: trimmed,
          href: getInternalHref(parsed),
          parsed,
        };
      }
    }
  } catch {
    // fall through to external
  }

  return { type: "external", value: trimmed, href: trimmed };
}

export function linkifyPostText(
  text: string,
  opts?: { origin?: string },
): PostTextSegment[] {
  if (!text) return [];

  const segments: PostTextSegment[] = [];
  let lastIndex = 0;
  const regex = new RegExp(URL_IN_TEXT_REGEX.source, URL_IN_TEXT_REGEX.flags);

  for (const match of text.matchAll(regex)) {
    const matchIndex = match.index ?? 0;
    if (matchIndex > lastIndex) {
      segments.push({ type: "text", value: text.slice(lastIndex, matchIndex) });
    }
    segments.push(classifyUrl(match[0], opts?.origin));
    lastIndex = matchIndex + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: "text", value: text.slice(lastIndex) });
  }

  return segments.length > 0 ? segments : [{ type: "text", value: text }];
}
