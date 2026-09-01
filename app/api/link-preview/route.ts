import { NextRequest, NextResponse } from "next/server";
import dns from "node:dns";

type LinkPreview = {
  title?: string;
  description?: string;
  image?: string;
  domain: string;
};

const CACHE = new Map<string, { data: LinkPreview; expires: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000;
const MAX_HTML_BYTES = 2 * 1024 * 1024;

function extractMeta(html: string, property: string): string | undefined {
  const patterns = [
    new RegExp(
      `<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']+)["']`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${property}["']`,
      "i",
    ),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return match[1].trim();
  }

  return undefined;
}

function isPrivateIp(ip: string): boolean {
  if (
    ip.startsWith("127.") ||
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    ip.startsWith("169.254.") ||
    ip.startsWith("0.")
  ) {
    return true;
  }

  if (ip.startsWith("172.")) {
    const secondOctet = parseInt(ip.split(".")[1] ?? "", 10);
    if (secondOctet >= 16 && secondOctet <= 31) {
      return true;
    }
  }

  if (
    ip === "::1" ||
    ip.startsWith("fe80:") ||
    ip.startsWith("fc00:") ||
    ip.startsWith("fd00:")
  ) {
    return true;
  }

  return false;
}

async function isBlockedHost(hostname: string): Promise<boolean> {
  const host = hostname.toLowerCase();
  const isLocalString =
    host === "localhost" ||
    host.endsWith(".local") ||
    host === "0.0.0.0" ||
    host === "[::1]";

  if (isLocalString) return true;

  try {
    const addresses = await dns.promises.lookup(hostname, { all: true });
    if (addresses.length === 0) return true;
    return addresses.some(({ address }) => isPrivateIp(address));
  } catch {
    return true;
  }
}

export async function GET(request: NextRequest) {
  const rawUrl = request.nextUrl.searchParams.get("url");
  if (!rawUrl) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("Invalid protocol");
    }
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  if (await isBlockedHost(parsed.hostname)) {
    return NextResponse.json({ error: "Blocked url" }, { status: 400 });
  }

  const cached = CACHE.get(rawUrl);
  if (cached && cached.expires > Date.now()) {
    return NextResponse.json(cached.data);
  }

  try {
    const response = await fetch(rawUrl, {
      headers: {
        "User-Agent": "CreativeTV-LinkPreview/1.0",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(8000),
      redirect: "follow",
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch url" }, { status: 502 });
    }

    const contentType = response.headers.get("content-type") || "";
    if (
      !contentType.includes("text/html") &&
      !contentType.includes("application/xhtml+xml")
    ) {
      return NextResponse.json({ error: "Invalid content type" }, { status: 400 });
    }

    const contentLength = response.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_HTML_BYTES) {
      return NextResponse.json({ error: "File too large" }, { status: 400 });
    }

    const html = await response.text();
    if (html.length > MAX_HTML_BYTES) {
      return NextResponse.json({ error: "File too large" }, { status: 400 });
    }

    const title =
      extractMeta(html, "og:title") ||
      html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim();
    const description =
      extractMeta(html, "og:description") || extractMeta(html, "description");
    const image = extractMeta(html, "og:image");

    const data: LinkPreview = {
      title,
      description,
      image,
      domain: parsed.hostname,
    };

    CACHE.set(rawUrl, { data, expires: Date.now() + CACHE_TTL_MS });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Failed to fetch preview" }, { status: 502 });
  }
}
