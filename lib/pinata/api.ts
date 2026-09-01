/**
 * Server-only Pinata Agents API client.
 *
 * Endpoints we use:
 *  - `GET /v0/templates/id/{templateId}` / `GET /v0/templates/{slug}`
 *    (PINATA_JWT) — org template metadata for the Creative AI Digital Twin
 *    onboarding card + snapshotCid (id `tmernpdi`, slug
 *    `creative-ai-digital-twin`).
 *  - `GET /v0/public-templates` (no auth) — marketplace fallback if the org
 *    template is later published under CREATIVE_TWIN_TEMPLATE_SLUG.
 *  - `GET /v0/agents/{agentId}` (Pinata JWT) — fetch the agent's name + the
 *    snapshotCid we compare against the template for the verified badge.
 *  - `GET /v0/agents/{agentId}/gateway-token` (Pinata JWT) — exchange the
 *    creator's JWT for the per-agent gateway token + base URLs that we
 *    persist and use to forward chat requests later.
 *
 * Template ID (`tmernpdi`) is the Pinata *template*, not a deployed agent.
 * Creators deploy their own agent from that template, then connect with
 * their agent ID + JWT.
 *
 * The Pinata JWT is held in memory only — passed to these functions and
 * discarded after the connect flow completes. Only the per-agent gateway
 * token is persisted (and only with service-role read access, see migration
 * 20260425_add_pinata_agent_fields_to_creator_profiles.sql).
 */

const PINATA_AGENTS_BASE = "https://agents.pinata.cloud";

export const PINATA_AGENT_HOST_SUFFIX = ".agents.pinata.cloud";

/** Marketplace / public-catalog slug (used only as a fallback lookup key). */
export const CREATIVE_TWIN_TEMPLATE_SLUG = "creative-ai-digital-twin";

/**
 * Org template ID for Creative AI Digital Twin.
 * Override with CREATIVE_TWIN_TEMPLATE_ID if Pinata reissues the template.
 */
export const CREATIVE_TWIN_TEMPLATE_ID =
  process.env.CREATIVE_TWIN_TEMPLATE_ID?.trim() || "tmernpdi";

/** Pinata org segment used when building the default template page URL. */
const CREATIVE_TWIN_TEMPLATE_ORG =
  process.env.CREATIVE_TWIN_TEMPLATE_ORG?.trim() ||
  "org_3Ar9vPhBBqDLVh1GlNO9kFTsGlS";

/**
 * Direct deploy / template page (org-scoped, not the public marketplace).
 * Derived from CREATIVE_TWIN_TEMPLATE_ID unless CREATIVE_TWIN_TEMPLATE_URL is set,
 * so ID-only overrides stay consistent with the deploy CTA.
 */
export const CREATIVE_TWIN_TEMPLATE_URL =
  process.env.CREATIVE_TWIN_TEMPLATE_URL?.trim() ||
  `https://agents.pinata.cloud/${CREATIVE_TWIN_TEMPLATE_ORG}/templates/${CREATIVE_TWIN_TEMPLATE_ID}`;

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

export type PinataProcessStatus = "starting" | "running" | "not_running" | string;

export interface PinataAgentDetailsResponse {
  agent: PinataAgent;
  processStatus?: PinataProcessStatus;
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
  init: PinataFetchInit = {},
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
      `Pinata API ${path} → ${res.status}${body ? `: ${body.slice(0, 300)}` : ""}`,
    );
  }
  return (await res.json()) as T;
}

export function resolvePinataAgentPublicBaseUrl(agentId: string): string {
  return `https://${agentId}${PINATA_AGENT_HOST_SUFFIX}`;
}

export function resolvePinataAgentGatewayWsUrl(agentId: string): string {
  return `wss://${agentId}${PINATA_AGENT_HOST_SUFFIX}/chat`;
}

export function resolveAgentRuntimeStatus(
  details: PinataAgentDetailsResponse,
): PinataProcessStatus {
  return details.processStatus ?? details.agent.status ?? "unknown";
}

export function isAgentRuntimeRunning(status: PinataProcessStatus): boolean {
  return status === "running";
}

/**
 * Public templates list. Cached in-process for 1 hour to avoid pounding the
 * upstream catalog on every page load.
 */
let publicTemplateCache: { value: PinataTemplate[]; expiresAt: number } | null =
  null;
let twinTemplateCache: { value: PinataTemplate | null; expiresAt: number } | null =
  null;
const TEMPLATE_TTL_MS = 60 * 60 * 1000;
/** Short TTL so a Pinata outage does not pin the static fallback for an hour. */
const FALLBACK_TEMPLATE_TTL_MS = 30 * 1000;

function normalizeTemplate(raw: unknown): PinataTemplate | null {
  if (!raw || typeof raw !== "object") return null;
  const t = raw as Record<string, unknown> & {
    template?: Record<string, unknown>;
  };
  const candidate = (t.template ?? t) as Record<string, unknown>;
  const templateId =
    (typeof candidate.templateId === "string" && candidate.templateId) ||
    (typeof candidate.id === "string" && candidate.id) ||
    null;
  const snapshotCid =
    (typeof candidate.snapshotCid === "string" && candidate.snapshotCid) ||
    (typeof candidate.snapshot_cid === "string" && candidate.snapshot_cid) ||
    null;
  if (!templateId || !snapshotCid) return null;
  return {
    templateId,
    name:
      (typeof candidate.name === "string" && candidate.name) ||
      "Creative AI Digital Twin",
    slug:
      (typeof candidate.slug === "string" && candidate.slug) ||
      CREATIVE_TWIN_TEMPLATE_SLUG,
    description:
      (typeof candidate.description === "string" && candidate.description) ||
      "",
    longDescription:
      typeof candidate.longDescription === "string"
        ? candidate.longDescription
        : null,
    authorName:
      (typeof candidate.authorName === "string" && candidate.authorName) ||
      "Creative",
    authorLogoUrl:
      typeof candidate.authorLogoUrl === "string"
        ? candidate.authorLogoUrl
        : null,
    authorUrl:
      typeof candidate.authorUrl === "string" ? candidate.authorUrl : null,
    category:
      (typeof candidate.category === "string" && candidate.category) || "other",
    snapshotCid,
    defaultVibe:
      typeof candidate.defaultVibe === "string" ? candidate.defaultVibe : null,
    defaultEmoji:
      typeof candidate.defaultEmoji === "string"
        ? candidate.defaultEmoji
        : null,
    requiredSecrets: Array.isArray(candidate.requiredSecrets)
      ? (candidate.requiredSecrets as PinataTemplate["requiredSecrets"])
      : [],
    isFree: candidate.isFree !== false,
    version: typeof candidate.version === "number" ? candidate.version : 1,
  };
}

/** Minimal card when Pinata auth is unavailable; deploy CTA still works. */
function creativeTwinTemplateFallback(): PinataTemplate {
  return {
    templateId: CREATIVE_TWIN_TEMPLATE_ID,
    name: "Creative AI Digital Twin",
    slug: CREATIVE_TWIN_TEMPLATE_SLUG,
    description:
      "Deploy this Pinata template, then paste your agent ID and JWT below to connect.",
    longDescription: null,
    authorName: "Creative",
    authorLogoUrl: null,
    authorUrl: CREATIVE_TWIN_TEMPLATE_URL,
    category: "other",
    // Empty until a live fetch succeeds — verified badge stays off.
    snapshotCid: "",
    defaultVibe: null,
    defaultEmoji: "🤖",
    requiredSecrets: [],
    isFree: true,
    version: 1,
  };
}

export async function listPublicTemplates(): Promise<PinataTemplate[]> {
  const now = Date.now();
  if (publicTemplateCache && publicTemplateCache.expiresAt > now) {
    return publicTemplateCache.value;
  }
  const data = await pinataFetch<{ templates: unknown[] }>(
    "/v0/public-templates",
  );
  const templates = Array.isArray(data?.templates)
    ? data.templates
        .map(normalizeTemplate)
        .filter((t): t is PinataTemplate => t !== null)
    : [];
  publicTemplateCache = {
    value: templates,
    expiresAt: now + TEMPLATE_TTL_MS,
  };
  return publicTemplateCache.value;
}

/**
 * Fetch an org template by ID. Requires PINATA_JWT — these are not in the
 * public marketplace until published.
 */
export async function getTemplateById(
  templateId: string,
  jwt?: string,
): Promise<PinataTemplate | null> {
  if (!templateId) return null;
  return fetchAuthenticatedTemplate(
    `/v0/templates/id/${encodeURIComponent(templateId)}`,
    jwt,
  );
}

/**
 * Fetch a template by slug (e.g. `creative-ai-digital-twin`).
 * Requires PINATA_JWT for org/unpublished templates.
 */
export async function getTemplateBySlug(
  slug: string,
  jwt?: string,
): Promise<PinataTemplate | null> {
  if (!slug) return null;
  return fetchAuthenticatedTemplate(
    `/v0/templates/${encodeURIComponent(slug)}`,
    jwt,
  );
}

async function fetchAuthenticatedTemplate(
  path: string,
  jwt?: string,
): Promise<PinataTemplate | null> {
  const token = jwt?.trim() || process.env.PINATA_JWT?.trim();
  if (!token) return null;
  try {
    const data = await pinataFetch<unknown>(path, {
      jwt: token,
      method: "GET",
    });
    return normalizeTemplate(data);
  } catch (err) {
    if (
      err instanceof PinataApiError &&
      (err.status === 404 ||
        err.status === 401 ||
        err.status === 403 ||
        err.status === 503)
    ) {
      return null;
    }
    throw err;
  }
}

/**
 * Resolve the Creative Twin *template* (not a deployed agent). Prefers org
 * template ID, then slug `creative-ai-digital-twin` (auth + public catalog),
 * then a static fallback so the deploy CTA still points at tmernpdi.
 */
export async function findCreativeTwinTemplate(): Promise<PinataTemplate | null> {
  const now = Date.now();
  if (twinTemplateCache && twinTemplateCache.expiresAt > now) {
    return twinTemplateCache.value;
  }

  let template =
    (await getTemplateById(CREATIVE_TWIN_TEMPLATE_ID).catch(() => null)) ??
    (await getTemplateBySlug(CREATIVE_TWIN_TEMPLATE_SLUG).catch(() => null)) ??
    null;

  if (!template) {
    const all = await listPublicTemplates().catch(() => [] as PinataTemplate[]);
    template =
      all.find((t) => t.templateId === CREATIVE_TWIN_TEMPLATE_ID) ??
      all.find((t) => t.slug === CREATIVE_TWIN_TEMPLATE_SLUG) ??
      null;
  }

  const isFallback = !template;
  if (!template) {
    template = creativeTwinTemplateFallback();
  }

  twinTemplateCache = {
    value: template,
    expiresAt: now + (isFallback ? FALLBACK_TEMPLATE_TTL_MS : TEMPLATE_TTL_MS),
  };
  return template;
}

export async function getAgentDetailsResponse(
  jwt: string,
  agentId: string,
): Promise<PinataAgentDetailsResponse> {
  if (!jwt) throw new Error("Pinata JWT is required");
  if (!agentId) throw new Error("agentId is required");
  const data = await pinataFetch<PinataAgentDetailsResponse>(
    `/v0/agents/${encodeURIComponent(agentId)}`,
    { jwt, method: "GET" },
  );
  if (!data?.agent) {
    throw new Error("Pinata returned no agent for that id");
  }
  return data;
}

export async function getAgentDetails(
  jwt: string,
  agentId: string,
): Promise<PinataAgent> {
  const data = await getAgentDetailsResponse(jwt, agentId);
  return data.agent;
}

export async function getGatewayToken(
  jwt: string,
  agentId: string,
): Promise<PinataGatewayToken> {
  if (!jwt) throw new Error("Pinata JWT is required");
  if (!agentId) throw new Error("agentId is required");
  return pinataFetch<PinataGatewayToken>(
    `/v0/agents/${encodeURIComponent(agentId)}/gateway-token`,
    { jwt, method: "GET" },
  );
}

export async function restartAgent(
  jwt: string,
  agentId: string,
): Promise<void> {
  if (!jwt) throw new Error("Pinata JWT is required");
  if (!agentId) throw new Error("agentId is required");
  await pinataFetch<unknown>(
    `/v0/agents/${encodeURIComponent(agentId)}/restart`,
    { jwt, method: "POST" },
  );
}

export async function approveAllPendingDevices(
  jwt: string,
  agentId: string,
): Promise<void> {
  if (!jwt) throw new Error("Pinata JWT is required");
  if (!agentId) throw new Error("agentId is required");
  await pinataFetch<unknown>(
    `/v0/agents/${encodeURIComponent(agentId)}/devices/approve-all`,
    { jwt, method: "POST" },
  );
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Ensure the agent gateway is running before forwarding chat. Restarts stopped
 * agents and waits briefly for the OpenClaw gateway handler to come up.
 */
export async function ensureAgentRunning(
  jwt: string,
  agentId: string,
  options: { maxWaitMs?: number } = {},
): Promise<PinataAgentDetailsResponse> {
  const maxWaitMs = options.maxWaitMs ?? 20_000;
  let details = await getAgentDetailsResponse(jwt, agentId);
  let status = resolveAgentRuntimeStatus(details);

  if (isAgentRuntimeRunning(status)) {
    return details;
  }

  await restartAgent(jwt, agentId);

  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    await sleep(1_500);
    details = await getAgentDetailsResponse(jwt, agentId);
    status = resolveAgentRuntimeStatus(details);
    if (isAgentRuntimeRunning(status)) {
      return details;
    }
  }

  throw new Error(
    `Pinata agent is ${status}. Start or restart it in the Pinata dashboard (Danger → Restart Gateway), then try again.`,
  );
}

export { PinataApiError };
