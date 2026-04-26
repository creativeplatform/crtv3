/**
 * Server-only Pinata Agents API client.
 *
 * Three endpoints we use:
 *  - `GET /v0/public-templates` (no auth) — discover the Creative AI Digital
 *    Twin template for the onboarding card and its snapshotCid.
 *  - `GET /v0/agents/{agentId}` (Pinata JWT) — fetch the agent's name + the
 *    snapshotCid we compare against the template for the verified badge.
 *  - `GET /v0/agents/{agentId}/gateway-token` (Pinata JWT) — exchange the
 *    creator's JWT for the per-agent gateway token + base URLs that we
 *    persist and use to forward chat requests later.
 *
 * The Pinata JWT is held in memory only — passed to these functions and
 * discarded after the connect flow completes. Only the per-agent gateway
 * token is persisted (and only with service-role read access, see migration
 * 20260425_add_pinata_agent_fields_to_creator_profiles.sql).
 */

const PINATA_AGENTS_BASE = "https://agents.pinata.cloud";

export const CREATIVE_TWIN_TEMPLATE_SLUG = "creative-ai-digital-twin";

/**
 * Subset of the Template schema we render in the UI. The full schema has many
 * more fields (price, tags, version, etc.) — we only type the bits we use.
 */
export interface PinataTemplate {
  templateId: string;
  name: string;
  slug: string;
  description: string;
  longDescription: string | null;
  authorName: string;
  authorLogoUrl: string | null;
  authorUrl: string | null;
  category: string;
  snapshotCid: string;
  defaultVibe: string | null;
  defaultEmoji: string | null;
  requiredSecrets: Array<{
    name: string;
    description: string;
    guideUrl?: string;
    guideSteps?: string[];
    required: boolean;
  }>;
  isFree: boolean;
  version: number;
}

export interface PinataAgent {
  agentId: string;
  name: string;
  description: string | null;
  snapshotCid: string | null;
  status: "starting" | "running" | "not_running" | string;
}

export interface PinataGatewayToken {
  token: string;
  wsUrl: string;
  baseUrl: string;
}

class PinataApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "PinataApiError";
  }
}

type PinataFetchInit = Parameters<typeof fetch>[1] & { jwt?: string };

async function pinataFetch<T>(
  path: string,
  init: PinataFetchInit = {}
): Promise<T> {
  const { jwt, headers, ...rest } = init;
  const res = await fetch(`${PINATA_AGENTS_BASE}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
      ...(headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new PinataApiError(
      res.status,
      `Pinata API ${path} → ${res.status}${body ? `: ${body.slice(0, 300)}` : ""}`
    );
  }
  return (await res.json()) as T;
}

/**
 * Public templates list. Cached in-process for 1 hour to avoid pounding the
 * upstream catalog on every page load.
 */
let templateCache: { value: PinataTemplate[]; expiresAt: number } | null = null;
const TEMPLATE_TTL_MS = 60 * 60 * 1000;

export async function listPublicTemplates(): Promise<PinataTemplate[]> {
  const now = Date.now();
  if (templateCache && templateCache.expiresAt > now) {
    return templateCache.value;
  }
  const data = await pinataFetch<{ templates: PinataTemplate[] }>(
    "/v0/public-templates"
  );
  templateCache = { value: data.templates ?? [], expiresAt: now + TEMPLATE_TTL_MS };
  return templateCache.value;
}

export async function findCreativeTwinTemplate(): Promise<PinataTemplate | null> {
  const all = await listPublicTemplates();
  return all.find((t) => t.slug === CREATIVE_TWIN_TEMPLATE_SLUG) ?? null;
}

export async function getAgentDetails(
  jwt: string,
  agentId: string
): Promise<PinataAgent> {
  if (!jwt) throw new Error("Pinata JWT is required");
  if (!agentId) throw new Error("agentId is required");
  const data = await pinataFetch<{ agent: PinataAgent }>(
    `/v0/agents/${encodeURIComponent(agentId)}`,
    { jwt, method: "GET" }
  );
  if (!data?.agent) {
    throw new Error("Pinata returned no agent for that id");
  }
  return data.agent;
}

export async function getGatewayToken(
  jwt: string,
  agentId: string
): Promise<PinataGatewayToken> {
  if (!jwt) throw new Error("Pinata JWT is required");
  if (!agentId) throw new Error("agentId is required");
  return pinataFetch<PinataGatewayToken>(
    `/v0/agents/${encodeURIComponent(agentId)}/gateway-token`,
    { jwt, method: "GET" }
  );
}

export { PinataApiError };
