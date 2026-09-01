'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useUser } from '@/lib/wallet/react';
import { useWalletAuth } from '@/lib/auth/useWalletAuth';
import { logger } from '@/lib/utils/logger';

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
}

interface PaymentProof {
  transactionHash: string;
  amount: string;
}

const MEMORY_KEY = 'orbguide:memory'; // staging continuity (Supabase in doc §6)
const MAX_MEMORY = 12;

/**
 * OrbGuideChat — collapsible onboarding assistant for /upload.
 * - Streams from /api/agent/orbguide (Gemini).
 * - Requires wallet-auth headers and a USDC payment proof on every call.
 * - "Start my first upload" calls the action mode to reveal the dropzone.
 * - Memory persists in localStorage for continuity across reloads.
 *
 * NOTE: This is a staging spike. Do not import into production routes until
 * the payment UX and memory backend are finalized.
 */
export function OrbGuideChat({
  onRevealDropzone,
  paymentProof,
}: {
  onRevealDropzone?: (steps: string[]) => void;
  paymentProof?: PaymentProof;
}) {
  const user = useUser();
  const address = user?.address;
  const { getAuthHeaders, isReady } = useWalletAuth();

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [steps, setSteps] = useState<string[] | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load continuity memory on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(MEMORY_KEY);
      if (raw) setMessages(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);

  // Persist memory.
  useEffect(() => {
    try {
      localStorage.setItem(MEMORY_KEY, JSON.stringify(messages.slice(-MAX_MEMORY)));
    } catch {
      /* ignore */
    }
  }, [messages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, busy]);

  const makeRequest = useCallback(
    async (payload: object) => {
      if (!address || !isReady) {
        throw new Error('Wallet not connected');
      }
      const headers = await getAuthHeaders();
      const res = await fetch('/api/agent/orbguide', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body: JSON.stringify({ ...payload, address, paymentProof }),
      });
      return res;
    },
    [address, isReady, paymentProof, getAuthHeaders],
  );

  const send = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || busy) return;
      if (!address || !paymentProof) {
        setMessages((m) => [
          ...m,
          {
            role: 'assistant',
            content:
              '⚠️ Creative Guide requires a connected wallet and a USDC payment proof to chat.',
          },
        ]);
        return;
      }
      const next = [...messages, { role: 'user' as const, content }];
      setMessages(next);
      setInput('');
      setBusy(true);

      try {
        const res = await makeRequest({ messages: next });
        const contentType = res.headers.get('content-type') ?? '';

        // Canned/fast-path response — no model call, no payment.
        if (contentType.includes('application/json')) {
          const data = await res.json().catch(() => ({}));
          if (data?.type === 'canned' && data?.content) {
            setMessages((m) => [
              ...m,
              { role: 'assistant', content: data.content },
            ]);
            if (data.action?.steps) {
              setSteps(data.action.steps);
              onRevealDropzone?.(data.action.steps);
            }
          } else if (!res.ok) {
            setMessages((m) => [
              ...m,
              { role: 'assistant', content: `⚠️ ${data.error ?? 'Agent error'}` },
            ]);
          } else {
            // Unexpected JSON shape; fall through to generic error below.
            throw new Error('Unexpected response shape');
          }
          return;
        }

        if (!res.ok || !res.body) {
          const e = await res.json().catch(() => ({}));
          setMessages((m) => [
            ...m,
            { role: 'assistant', content: `⚠️ ${e.error ?? 'Agent error'}` },
          ]);
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let acc = '';
        setMessages((m) => [...m, { role: 'assistant', content: '' }]);
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          acc += decoder.decode(value, { stream: true });
          setMessages((m) => {
            const copy = [...m];
            copy[copy.length - 1] = { role: 'assistant', content: acc };
            return copy;
          });
        }
      } catch (err) {
        logger.warn('[OrbGuideChat] chat error:', err);
        setMessages((m) => [
          ...m,
          { role: 'assistant', content: '⚠️ Could not reach Creative Guide.' },
        ]);
      } finally {
        setBusy(false);
      }
    },
    [messages, busy, address, paymentProof, makeRequest],
  );

  const startUpload = useCallback(async () => {
    if (busy) return;
    if (!address || !paymentProof) {
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content:
            '⚠️ Connect your wallet and provide a payment proof to start the upload guide.',
        },
      ]);
      return;
    }
    setBusy(true);
    try {
      const res = await makeRequest({ action: 'reveal_dropzone' });
      const data = await res.json().catch(() => ({}));
      if (data?.reveal) {
        setSteps(data.steps ?? null);
        onRevealDropzone?.(data.steps ?? []);
        setMessages((m) => [
          ...m,
          {
            role: 'assistant',
            content:
              "Let's get your first clip up. I've opened the upload area below — " +
              'pick a video, add a title, and publish. Need the steps broken down?',
          },
        ]);
      } else {
        setMessages((m) => [
          ...m,
          { role: 'assistant', content: `⚠️ ${data.error ?? 'Agent error'}` },
        ]);
      }
    } catch (err) {
      logger.warn('[OrbGuideChat] startUpload error:', err);
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: '⚠️ Could not reach Creative Guide.' },
      ]);
    } finally {
      setBusy(false);
    }
  }, [busy, address, paymentProof, makeRequest, onRevealDropzone]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-50 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-lg"
        aria-label="Open Creative Guide"
      >
        📺 Creative Guide
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex h-[28rem] w-80 flex-col rounded-xl border bg-background shadow-2xl">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-sm font-semibold">📺 Creative Guide</span>
        <button
          onClick={() => setOpen(false)}
          className="text-xs text-muted-foreground"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-3 text-sm">
        {messages.length === 0 && (
          <p className="text-muted-foreground">
            Hi — I'll walk you through uploading your first clip. Ask me anything,
            or tap below to start. A small USDC payment is required per chat.
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={
              m.role === 'user' ? 'text-right' : 'text-left text-foreground'
            }
          >
            <span
              className={
                'inline-block rounded-lg px-3 py-2 ' +
                (m.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted')
              }
            >
              {m.content || '…'}
            </span>
          </div>
        ))}

        {steps && (
          <ol className="list-decimal space-y-1 rounded-lg bg-muted p-3 text-xs">
            {steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        )}
      </div>

      <div className="border-t p-2">
        <button
          onClick={startUpload}
          disabled={busy}
          className="mb-2 w-full rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
        >
          ▶️ Start my first upload
        </button>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Creative Guide…"
            className="flex-1 rounded-md border bg-background px-2 py-1 text-xs outline-none"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
