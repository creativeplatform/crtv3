"use client";

import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { isAddress } from "viem";
import {
  Bot,
  AlertCircle,
  Loader2,
  Save,
  ExternalLink,
  ShieldCheck,
  Plug,
  CheckCircle2,
  KeyRound,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/use-toast";
import {
  creatorProfileSupabaseService,
  type CreatorProfile,
} from "@/lib/sdk/supabase/creator-profiles";
import { useWalletAuth } from "@/lib/auth/useWalletAuth";
import { logger } from "@/lib/utils/logger";

interface DigitalTwinSectionProps {
  ownerAddress: string;
  initialProfile?: CreatorProfile | null;
  isOwner: boolean;
  onSaved?: () => void;
}

interface TemplateState {
  templateId: string;
  name: string;
  description: string;
  authorName: string;
  authorLogoUrl: string | null;
  defaultEmoji: string | null;
  snapshotCid: string;
  requiredSecrets: Array<{
    name: string;
    description: string;
    guideUrl?: string;
    guideSteps?: string[];
    required: boolean;
  }>;
}

interface ConnectionStatus {
  connected: boolean;
  verified?: boolean;
  agentId?: string;
  agentName?: string;
  baseUrl?: string;
  connectedAt?: string;
  templateSnapshotCid?: string | null;
  agentSnapshotCid?: string | null;
}

const PINATA_MARKETPLACE_URL = "https://agents.pinata.cloud/marketplace";
const PINATA_API_KEYS_URL = "https://app.pinata.cloud/developers/api-keys";

/**
 * Profile-page section for connecting an external Creative AI Digital Twin
 * deployed on Pinata. Two paths:
 *
 *  1) Onboarding: shows the live template card, a Deploy CTA pointing at the
 *     Pinata marketplace, and a checklist of secrets the creator will need.
 *  2) Connect: agent ID + Pinata JWT one-shot exchange. The JWT is sent once
 *     to /api/twin/connect, traded for the per-agent gateway token + URLs,
 *     then forgotten. After that the proxy at /api/twin/chat uses the stored
 *     token directly, with no further creator action needed.
 *
 * The avatar GLB URL is independent of the Pinata connection — a creator can
 * upload a custom GLB without connecting an agent (chat panel just won't
 * appear), or vice versa.
 */
export function DigitalTwinSection({
  ownerAddress,
  initialProfile,
  isOwner,
  onSaved,
}: DigitalTwinSectionProps) {
  const { toast } = useToast();
  const [twinEnabled, setTwinEnabled] = useState<boolean>(!!initialProfile?.twin_enabled);
  const [glbUrl, setGlbUrl] = useState<string>(initialProfile?.twin_avatar_glb_url || "");
  const [twinAddress, setTwinAddress] = useState<string>(initialProfile?.twin_address || "");
  const [profileLoading, setProfileLoading] = useState(!initialProfile);
  const [savingMeta, setSavingMeta] = useState(false);

  const [template, setTemplate] = useState<TemplateState | null>(null);
  const [templateError, setTemplateError] = useState<string | null>(null);

  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);

  const [agentIdInput, setAgentIdInput] = useState("");
  const [jwtInput, setJwtInput] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [disconnectOpen, setDisconnectOpen] = useState(false);

  const { getAuthHeaders } = useWalletAuth();

  // Profile (avatar GLB + twin address fields).
  useEffect(() => {
    if (initialProfile !== undefined) {
      setTwinEnabled(!!initialProfile?.twin_enabled);
      setGlbUrl(initialProfile?.twin_avatar_glb_url || "");
      setTwinAddress(initialProfile?.twin_address || "");
      setProfileLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const p = await creatorProfileSupabaseService.getCreatorProfileByOwner(ownerAddress);
        if (!cancelled && p) {
          setTwinEnabled(!!p.twin_enabled);
          setGlbUrl(p.twin_avatar_glb_url || "");
          setTwinAddress(p.twin_address || "");
        }
      } catch (err) {
        logger.error("Failed to load profile for twin section:", err);
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ownerAddress, initialProfile]);

  // Live template metadata from Pinata.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/twin/template");
        const json = await res.json();
        if (cancelled) return;
        if (!json.success) {
          setTemplateError(json.error || "Template fetch failed");
          return;
        }
        setTemplate(json.template);
      } catch (err) {
        if (!cancelled) {
          setTemplateError(err instanceof Error ? err.message : "Template fetch failed");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const res = await fetch(
        `/api/twin/status?owner=${encodeURIComponent(ownerAddress)}`
      );
      const json = await res.json();
      if (json.success) {
        setStatus(json);
      } else {
        setStatus({ connected: false });
      }
    } catch (err) {
      logger.error("twin status load failed:", err);
      setStatus({ connected: false });
    } finally {
      setStatusLoading(false);
    }
  }, [ownerAddress]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const validateMeta = (): string | null => {
    if (!twinEnabled) return null;
    if (twinAddress && !isAddress(twinAddress)) {
      return "Twin address must be a valid 0x address";
    }
    return null;
  };

  const handleSaveMeta = async () => {
    const err = validateMeta();
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setSavingMeta(true);
    try {
      const authHeaders = await getAuthHeaders();
      await creatorProfileSupabaseService.upsertCreatorProfile(
        {
          owner_address: ownerAddress,
          twin_enabled: twinEnabled,
          twin_address: twinAddress.trim() ? twinAddress.trim().toLowerCase() : null,
          twin_avatar_glb_url: glbUrl.trim() || null,
        },
        authHeaders
      );
      toast({ title: "Twin settings saved" });
      onSaved?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save";
      setError(msg);
      toast({ variant: "destructive", title: "Error", description: msg });
    } finally {
      setSavingMeta(false);
    }
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setConnectError(null);
    if (!agentIdInput.trim() || !jwtInput.trim()) {
      setConnectError("Both Agent ID and Pinata JWT are required");
      return;
    }
    setConnecting(true);
    try {
      const auth = await getAuthHeaders();
      const res = await fetch("/api/twin/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...auth },
        body: JSON.stringify({
          ownerAddress,
          agentId: agentIdInput.trim(),
          pinataJwt: jwtInput.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || `Connect failed (${res.status})`);
      }
      toast({
        title: "Twin connected",
        description: json.verified
          ? "Verified Creative AI Digital Twin"
          : `Connected as "${json.agentName}". Snapshot doesn't match the marketplace template — that's fine if you've forked it.`,
      });
      setJwtInput("");
      setAgentIdInput("");
      refreshStatus();
      onSaved?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to connect";
      setConnectError(msg);
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnectOpen(false);
    try {
      const auth = await getAuthHeaders();
      const res = await fetch("/api/twin/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...auth },
        body: JSON.stringify({ ownerAddress }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Disconnect failed");
      toast({ title: "Twin disconnected" });
      refreshStatus();
      onSaved?.();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to disconnect",
      });
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/twin/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creatorAddress: ownerAddress,
          message: "Hello — this is a connection test from your profile page.",
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setTestResult({
          ok: false,
          text: json.error || `HTTP ${res.status}`,
        });
        return;
      }
      setTestResult({
        ok: true,
        text: (json.reply || "(empty reply)").slice(0, 400),
      });
    } catch (err) {
      setTestResult({
        ok: false,
        text: err instanceof Error ? err.message : "Test failed",
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          Creative AI Digital Twin
        </CardTitle>
        <CardDescription>
          Deploy your own AI agent on Pinata, then connect it here so viewers
          can chat with your twin during streams.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {profileLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          <>
            {/* Enable toggle */}
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="text-sm font-semibold">Enable digital twin</p>
                <p className="text-xs text-muted-foreground">
                  When on, viewers see your twin overlay during streams.
                </p>
              </div>
              <Switch
                checked={twinEnabled}
                onCheckedChange={setTwinEnabled}
                disabled={!isOwner || savingMeta}
              />
            </div>

            {/* Marketplace template card */}
            {twinEnabled && (
              <div className="rounded-md border p-3 bg-muted/30">
                {template ? (
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      {template.authorLogoUrl ? (
                        <img
                          src={template.authorLogoUrl}
                          alt={template.authorName}
                          className="h-10 w-10 rounded object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded bg-muted flex items-center justify-center text-lg flex-shrink-0">
                          {template.defaultEmoji || "🤖"}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold">{template.name}</p>
                        <p className="text-xs text-muted-foreground">
                          by {template.authorName}
                        </p>
                        <p className="text-xs mt-1">{template.description}</p>
                      </div>
                    </div>

                    {template.requiredSecrets?.length > 0 && (
                      <div className="border-t pt-2">
                        <p className="text-xs font-medium mb-1.5">
                          You'll need these API keys to deploy:
                        </p>
                        <ul className="text-xs space-y-0.5">
                          {template.requiredSecrets.map((s) => (
                            <li key={s.name} className="flex items-center gap-1">
                              <code className="text-[10px]">{s.name}</code>
                              {s.guideUrl && (
                                <a
                                  href={s.guideUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary underline"
                                >
                                  guide
                                </a>
                              )}
                              {!s.required && (
                                <span className="text-muted-foreground">(optional)</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {!status?.connected && (
                      <a
                        href={PINATA_MARKETPLACE_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" /> Deploy this template on Pinata
                      </a>
                    )}
                  </div>
                ) : templateError ? (
                  <p className="text-xs text-muted-foreground">
                    Couldn't load template metadata: {templateError}
                  </p>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" /> Loading template…
                  </div>
                )}
              </div>
            )}

            {/* Connection state */}
            {twinEnabled && (
              <div className="rounded-md border p-3">
                {statusLoading ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" /> Checking connection…
                  </div>
                ) : status?.connected ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                      <p className="text-sm font-semibold">
                        Connected: {status.agentName || status.agentId}
                      </p>
                      {status.verified && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green-700 dark:text-green-300 bg-green-500/10 border border-green-500/40 rounded px-1.5 py-0.5">
                          <ShieldCheck className="h-3 w-3" /> Verified
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground break-all">
                      {status.baseUrl}
                    </p>
                    {!status.verified && status.templateSnapshotCid && (
                      <p className="text-[11px] text-amber-600 dark:text-amber-400">
                        Snapshot doesn't match the marketplace template — still works,
                        just not the verified upstream version.
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleTest}
                        disabled={testing}
                      >
                        {testing ? (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        ) : (
                          <Send className="h-3 w-3 mr-1" />
                        )}
                        Test connection
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setDisconnectOpen(true)}
                      >
                        Disconnect
                      </Button>
                    </div>
                    {testResult && (
                      <Alert variant={testResult.ok ? "default" : "destructive"}>
                        <AlertDescription className="text-xs whitespace-pre-wrap">
                          {testResult.ok ? "✓ " : "✗ "}
                          {testResult.text}
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                ) : (
                  <form onSubmit={handleConnect} className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <Plug className="h-4 w-4" />
                      <p className="text-sm font-semibold">Connect your deployed agent</p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      After deploying on Pinata, find your agent's{" "}
                      <strong>Agent ID</strong> in the agent header (e.g.{" "}
                      <code className="text-[10px]">xljs9fuy</code>) and create a Pinata
                      JWT at{" "}
                      <a
                        href={PINATA_API_KEYS_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline"
                      >
                        Pinata → API Keys
                      </a>
                      . The JWT is used once to fetch your agent's gateway token and
                      then discarded.
                    </p>
                    <div className="space-y-1.5">
                      <Label htmlFor="agent_id">Agent ID</Label>
                      <Input
                        id="agent_id"
                        placeholder="xljs9fuy"
                        value={agentIdInput}
                        onChange={(e) => setAgentIdInput(e.target.value)}
                        disabled={!isOwner || connecting}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="pinata_jwt" className="flex items-center gap-1">
                        <KeyRound className="h-3 w-3" /> Pinata JWT
                      </Label>
                      <Input
                        id="pinata_jwt"
                        type="password"
                        placeholder="eyJhbGciOi…"
                        value={jwtInput}
                        onChange={(e) => setJwtInput(e.target.value)}
                        disabled={!isOwner || connecting}
                        autoComplete="off"
                      />
                    </div>
                    {connectError && (
                      <Alert variant="destructive">
                        <AlertDescription className="text-xs">{connectError}</AlertDescription>
                      </Alert>
                    )}
                    {isOwner && (
                      <Button type="submit" disabled={connecting} size="sm">
                        {connecting ? (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        ) : (
                          <Plug className="h-3 w-3 mr-1" />
                        )}
                        Connect
                      </Button>
                    )}
                  </form>
                )}
              </div>
            )}

            {/* Avatar GLB + twin address (independent of agent connection) */}
            {twinEnabled && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="twin_address">Twin wallet address (optional)</Label>
                  <Input
                    id="twin_address"
                    placeholder="0x… (the agent's EVM address)"
                    value={twinAddress}
                    onChange={(e) => setTwinAddress(e.target.value)}
                    disabled={!isOwner || savingMeta}
                  />
                  <p className="text-xs text-muted-foreground">
                    Lets you grant your twin moderation rights from the Manage
                    Moderators dialog on your live page.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="twin_avatar_glb_url">Avatar GLB URL (optional)</Label>
                  <Input
                    id="twin_avatar_glb_url"
                    placeholder="https://… or ipfs://… (.glb file)"
                    value={glbUrl}
                    onChange={(e) => setGlbUrl(e.target.value)}
                    disabled={!isOwner || savingMeta}
                  />
                  <p className="text-xs text-muted-foreground">
                    If set, viewers see a 3D avatar overlay; if not, they see the
                    chat panel only.
                  </p>
                </div>
              </>
            )}

            {isOwner && (
              <div className="pt-2">
                <Button onClick={handleSaveMeta} disabled={savingMeta} size="sm">
                  {savingMeta ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save twin settings
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>

      <AlertDialog open={disconnectOpen} onOpenChange={setDisconnectOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect this twin?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the stored Pinata gateway token from your profile. Your
              agent on Pinata is unaffected — you can reconnect any time by pasting
              your Agent ID + Pinata JWT again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDisconnect}>Disconnect</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
