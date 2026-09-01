/** Matches `[core.precog.markets/8453/18]` suffix in question titles. */
export const PRECOG_REF_PATTERN =
  /\[core\.precog\.markets\/(\d+)\/(\d+)\]\s*$/i;

export type PrecogMarketRef = {
  chainId: number;
  marketId: number;
  raw: string;
};

export function parsePrecogReference(text: string): PrecogMarketRef | null {
  const match = (text ?? "").trim().match(PRECOG_REF_PATTERN);
  if (!match) return null;
  return {
    chainId: Number(match[1]),
    marketId: Number(match[2]),
    raw: match[0],
  };
}

export function stripPrecogReference(text: string): string {
  return (text ?? "").replace(PRECOG_REF_PATTERN, "").trim();
}

export type PrecogMarketData = {
  title?: string;
  outcomes: string[];
  category?: string;
};

const precogCache = new Map<string, { data: PrecogMarketData; expires: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX_SIZE = 1000;

function evictPrecogCacheIfNeeded(): void {
  if (precogCache.size <= CACHE_MAX_SIZE) return;
  const now = Date.now();
  for (const [key, entry] of precogCache.entries()) {
    if (entry.expires <= now) {
      precogCache.delete(key);
    }
  }
  if (precogCache.size > CACHE_MAX_SIZE) {
    precogCache.clear();
  }
}

function cacheKey(chainId: number, marketId: number): string {
  return `${chainId}:${marketId}`;
}

function normalizeOutcomes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object" && "label" in item) {
        return String((item as { label: unknown }).label).trim();
      }
      if (item && typeof item === "object" && "name" in item) {
        return String((item as { name: unknown }).name).trim();
      }
      return "";
    })
    .filter(Boolean);
}

/** Parse Precog API JSON into display-friendly outcomes. */
export function parsePrecogMarketPayload(json: unknown): PrecogMarketData {
  if (!json || typeof json !== "object") {
    return { outcomes: [] };
  }
  const obj = json as Record<string, unknown>;
  const market =
    obj.market && typeof obj.market === "object"
      ? (obj.market as Record<string, unknown>)
      : obj;

  let outcomes = normalizeOutcomes(market.outcomes);
  if (outcomes.length === 0) outcomes = normalizeOutcomes(market.options);
  if (outcomes.length === 0) outcomes = normalizeOutcomes(market.choices);

  const title =
    typeof market.title === "string"
      ? market.title
      : typeof market.question === "string"
        ? market.question
        : undefined;

  const category =
    typeof market.category === "string" ? market.category : undefined;

  return { title, outcomes, category };
}

export async function fetchPrecogMarket(
  chainId: number,
  marketId: number,
  fetchImpl: typeof fetch = fetch
): Promise<PrecogMarketData | null> {
  const key = cacheKey(chainId, marketId);
  const cached = precogCache.get(key);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }

  const endpoints = [
    `https://core.precog.markets/api/markets/${chainId}/${marketId}`,
    `https://core.precog.markets/api/v1/markets/${chainId}/${marketId}`,
  ];

  for (const url of endpoints) {
    try {
      const res = await fetchImpl(url, {
        headers: { Accept: "application/json" },
        next: { revalidate: 300 },
      });
      if (!res.ok) continue;
      const json = await res.json();
      const data = parsePrecogMarketPayload(json);
      if (data.outcomes.length > 0 || data.title) {
        evictPrecogCacheIfNeeded();
        precogCache.set(key, { data, expires: Date.now() + CACHE_TTL_MS });
        return data;
      }
    } catch {
      continue;
    }
  }

  return null;
}
