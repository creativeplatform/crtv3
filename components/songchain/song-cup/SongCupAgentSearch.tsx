"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import { cn } from "@/lib/utils/utils";

type SongCupAgentSearchProps = {
  className?: string;
};

export function SongCupAgentSearch({ className }: SongCupAgentSearchProps) {
  const [query, setQuery] = useState("");
  const [session, setSession] = useState<string | undefined>();
  const [reply, setReply] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const message = query.trim();
    if (!message || loading) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/song-cup/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          ...(session ? { session } : {}),
        }),
      });

      const data = (await res.json()) as {
        success?: boolean;
        reply?: string;
        session?: string;
        error?: string;
        code?: string;
      };

      if (!res.ok || !data.success) {
        if (res.status === 403 && data.code === "BOTID_DENIED") {
          throw new Error("Request blocked — please refresh and try again.");
        }
        throw new Error(data.error || `Agent returned ${res.status}`);
      }

      if (data.session) setSession(data.session);
      setReply(data.reply || "(no reply)");
    } catch (err) {
      setReply(null);
      setError(err instanceof Error ? err.message : "Could not reach agent");
    } finally {
      setLoading(false);
    }
  };

  const clearReply = () => {
    setReply(null);
    setError(null);
    setSession(undefined);
  };

  return (
    <div className={cn("w-full", className)}>
      <form onSubmit={(e) => void handleSubmit(e)} className="relative">
        <div
          className={cn(
            "flex items-center gap-2 rounded-full py-2 pl-2 pr-3",
            "bg-muted/60 ring-1 ring-fuchsia-500/25 backdrop-blur-sm",
            "dark:bg-[rgba(173,153,219,0.08)] dark:ring-white/10",
          )}
        >
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-full transition-opacity",
              "bg-fuchsia-500/15 text-foreground",
              "dark:bg-[rgba(173,153,219,0.2)] dark:text-white",
              "hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50",
            )}
            aria-label="Ask Song Cup agent"
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Search className="size-4" strokeWidth={2.25} />
            )}
          </button>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="WHAT WOULD YOU LIKE TO KNOW"
            disabled={loading}
            maxLength={2000}
            className={cn(
              "min-w-0 flex-1 bg-transparent text-sm font-medium tracking-[-0.2px]",
              "text-foreground placeholder:text-muted-foreground",
              "dark:text-white dark:placeholder:text-[#a1a1aa]",
              "focus:outline-none",
            )}
          />
        </div>
      </form>

      {(reply || error) && (
        <div
          className={cn(
            "mt-2 rounded-2xl border p-3 text-sm backdrop-blur-md",
            "border-fuchsia-500/25 bg-card text-foreground",
            "dark:border-white/10 dark:bg-black/60",
            error ? "text-red-600 dark:text-red-300" : "text-foreground/90 dark:text-white/90",
          )}
          role="status"
        >
          <div className="mb-1 flex items-start justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground dark:text-[#a1a1aa]">
              Song Cup agent
            </p>
            <button
              type="button"
              onClick={clearReply}
              className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground dark:text-white/60 dark:hover:text-white"
              aria-label="Dismiss"
            >
              <X className="size-3.5" />
            </button>
          </div>
          <p className="whitespace-pre-wrap leading-relaxed">{error ?? reply}</p>
        </div>
      )}
    </div>
  );
}
