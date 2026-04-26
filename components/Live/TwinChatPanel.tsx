"use client";

import type React from "react";
import { useState } from "react";
import { Bot, Send, ChevronDown, ChevronUp, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/utils/logger";

interface TwinChatPanelProps {
  creatorAddress: string;
  creatorName: string;
  className?: string;
}

interface PanelMessage {
  id: string;
  role: "user" | "twin";
  content: string;
}

/**
 * Lightweight chat panel that proxies messages to the creator's configured
 * `twin_chat_endpoint` via /api/twin/chat. Used when a creator has registered
 * a twin but no GLB avatar — the panel takes the visual slot the avatar would
 * have occupied.
 */
export function TwinChatPanel({
  creatorAddress,
  creatorName,
  className,
}: TwinChatPanelProps) {
  const [open, setOpen] = useState(true);
  const [messages, setMessages] = useState<PanelMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    const userMsg: PanelMessage = {
      id: `u-${Date.now()}-${Math.random()}`,
      role: "user",
      content: text,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);
    setError(null);

    try {
      const res = await fetch("/api/twin/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creatorAddress,
          message: text,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Twin endpoint returned ${res.status}`);
      }

      const data = await res.json();
      const reply = data.reply || data.message || data.content || "";
      setMessages((prev) => [
        ...prev,
        {
          id: `t-${Date.now()}-${Math.random()}`,
          role: "twin",
          content: reply || "(no reply)",
        },
      ]);
    } catch (err) {
      logger.error("Twin chat request failed:", err);
      setError(err instanceof Error ? err.message : "Failed to reach twin");
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className={cn(
        "absolute bottom-4 right-4 w-72 z-30 rounded-lg border bg-background shadow-lg",
        className
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between p-2 border-b"
      >
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4" />
          <span className="text-xs font-semibold">
            Chat with {creatorName}&apos;s twin
          </span>
        </div>
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
      </button>
      {open && (
        <div className="flex flex-col h-72">
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5 text-xs">
            {messages.length === 0 ? (
              <p className="text-muted-foreground text-center pt-6">
                Ask the twin anything — they speak for the creator while they stream.
              </p>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    "rounded-md px-2 py-1.5",
                    m.role === "user"
                      ? "ml-auto max-w-[85%] bg-primary text-primary-foreground"
                      : "mr-auto max-w-[85%] bg-muted"
                  )}
                >
                  {m.content}
                </div>
              ))
            )}
            {error && (
              <div className="flex items-center gap-1 text-destructive text-[11px]">
                <AlertCircle className="h-3 w-3" /> {error}
              </div>
            )}
          </div>
          <form onSubmit={handleSubmit} className="p-2 border-t">
            <div className="flex gap-1.5">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type a question…"
                disabled={sending}
                className="h-8 text-xs"
                maxLength={500}
              />
              <Button
                type="submit"
                size="sm"
                className="h-8 px-2"
                disabled={sending || !input.trim()}
              >
                {sending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
