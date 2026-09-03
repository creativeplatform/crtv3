'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { processDataStream } from 'ai';
import { Trash2 } from 'lucide-react';
import { useWalletAuth } from '@/lib/auth/useWalletAuth';
import { useX402Payment } from '@/lib/hooks/payments/useX402Payment';
import {
  CREATIVE_GUIDE_PRICE,
  CREATIVE_GUIDE_RECIPIENT,
  CREATIVE_GUIDE_X402_ENDPOINT,
} from '@/lib/agent/creative-guide/constants';
import { logger } from '@/lib/utils/logger';

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
}

interface PaymentProof {
  transactionHash: string;
  amount: string;
}

const MEMORY_KEY = 'creative-guide:memory';
const LEGACY_MEMORY_KEY = 'orbguide:memory';
const MAX_MEMORY = 12;

/** Matches BOTID_DENIED_CODE from lib/middleware/botIdGuard (keep client-safe). */
const BOTID_DENIED = 'BOTID_DENIED';

const SESSION_VERIFY_ERROR =
  "Couldn't verify this session. Refresh and try again.";

function formatGuideError(data: { error?: string; code?: string } | null | undefined) {
  if (data?.code === BOTID_DENIED || data?.error === 'Access denied') {
    return SESSION_VERIFY_ERROR;
  }
  return data?.error ?? 'Agent error';
}

/**
 * CreativeGuideChat — collapsible onboarding assistant.
 * - Streams from /api/agent/creative-guide (Gemini) for advanced questions.
 * - Canned answers and upload guide are free (wallet auth only).
 * - Memory persists in localStorage for continuity across reloads.
 */
export function CreativeGuideChat({
  onRevealDropzone,
}: {
  onRevealDropzone?: (steps: string[]) => void;
}) {
  const router = useRouter();
  const { address, getAuthHeaders, isReady } = useWalletAuth();
  const { makePayment, isProcessing: isPaymentProcessing } = useX402Payment();

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [steps, setSteps] = useState<string[] | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const raw =
        localStorage.getItem(MEMORY_KEY) ?? localStorage.getItem(LEGACY_MEMORY_KEY);
      if (raw) {
        setMessages(JSON.parse(raw));
        if (!localStorage.getItem(MEMORY_KEY) && localStorage.getItem(LEGACY_MEMORY_KEY)) {
          localStorage.setItem(MEMORY_KEY, raw);
          localStorage.removeItem(LEGACY_MEMORY_KEY);
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      // Don't write or remove on empty — initial mount is [] before hydrate,
      // and clearChat already removeItem's both keys.
      if (messages.length === 0) return;
      localStorage.setItem(MEMORY_KEY, JSON.stringify(messages.slice(-MAX_MEMORY)));
    } catch {
      /* ignore */
    }
  }, [messages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, busy]);

  const clearChat = useCallback(() => {
    if (busy || isPaymentProcessing) return;
    setMessages([]);
    setSteps(null);
    setInput('');
    try {
      localStorage.removeItem(MEMORY_KEY);
      localStorage.removeItem(LEGACY_MEMORY_KEY);
    } catch {
      /* ignore */
    }
  }, [busy, isPaymentProcessing]);

  const walletGateMessage = useCallback((): string | null => {
    if (!address) return 'Connect your wallet to use Creative Guide.';
    if (!isReady) return 'Your wallet is still initializing — try again in a moment.';
    return null;
  }, [address, isReady]);

  const makeRequest = useCallback(
    async (payload: object, paymentProof?: PaymentProof) => {
      const gate = walletGateMessage();
      if (gate) throw new Error(gate);

      const headers = await getAuthHeaders();
      const res = await fetch('/api/agent/creative-guide', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body: JSON.stringify({ ...payload, address, paymentProof }),
      });
      return res;
    },
    [address, getAuthHeaders, walletGateMessage],
  );

  const obtainPaymentProof = useCallback(async (): Promise<PaymentProof | null> => {
    setMessages((m) => [
      ...m,
      {
        role: 'assistant',
        content: 'Processing $0.005 USDC payment for advanced AI…',
      },
    ]);

    const paymentResult = await makePayment({
      service: 'creative-guide',
      amount: CREATIVE_GUIDE_PRICE,
      endpoint: CREATIVE_GUIDE_X402_ENDPOINT,
      recipientAddress: CREATIVE_GUIDE_RECIPIENT,
    });

    if (!paymentResult.success) {
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content: `⚠️ Payment failed: ${paymentResult.error ?? 'Unknown error'}`,
        },
      ]);
      return null;
    }

    const transactionHash = paymentResult.paymentResponse?.transactionHash;
    if (!transactionHash) {
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content: '⚠️ Payment succeeded but no transaction hash; please try again.',
        },
      ]);
      return null;
    }

    return { transactionHash, amount: CREATIVE_GUIDE_PRICE };
  }, [makePayment]);

  const handleResponse = useCallback(
    async (
      res: Response,
      retry: (paymentProof?: PaymentProof) => Promise<Response>,
    ): Promise<boolean> => {
      if (res.status === 402) {
        const data = await res.json().catch(() => ({}));
        if (data?.code === 'PAYMENT_REQUIRED') {
          const proof = await obtainPaymentProof();
          if (!proof) return true;
          const retryRes = await retry(proof);
          return handleResponse(retryRes, retry);
        }
        setMessages((m) => [
          ...m,
          { role: 'assistant', content: `⚠️ ${data.error ?? 'Payment required'}` },
        ]);
        return true;
      }

      const contentType = res.headers.get('content-type') ?? '';

      if (contentType.includes('application/json')) {
        const data = await res.json().catch(() => ({}));
        if (data?.type === 'canned' && data?.content) {
          setMessages((m) => [...m, { role: 'assistant', content: data.content }]);
          if (data.action?.steps) {
            setSteps(data.action.steps);
            onRevealDropzone?.(data.action.steps);
          }
        } else if (!res.ok) {
          setMessages((m) => [
            ...m,
            { role: 'assistant', content: `⚠️ ${formatGuideError(data)}` },
          ]);
        } else {
          throw new Error('Unexpected response shape');
        }
        return true;
      }

      if (!res.ok || !res.body) {
        const e = await res.json().catch(() => ({}));
        setMessages((m) => [
          ...m,
          { role: 'assistant', content: `⚠️ ${formatGuideError(e)}` },
        ]);
        return true;
      }

      let acc = '';
      setMessages((m) => [...m, { role: 'assistant', content: '' }]);
      await processDataStream({
        stream: res.body,
        onTextPart: (text) => {
          acc += text;
          setMessages((m) => {
            const copy = [...m];
            copy[copy.length - 1] = { role: 'assistant', content: acc };
            return copy;
          });
        },
        onErrorPart: (error) => {
          const message = typeof error === 'string' ? error : 'Stream error';
          setMessages((m) => {
            const copy = [...m];
            copy[copy.length - 1] = { role: 'assistant', content: `⚠️ ${message}` };
            return copy;
          });
        },
      });
      return true;
    },
    [obtainPaymentProof, onRevealDropzone],
  );

  const send = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || busy || isPaymentProcessing) return;

      const gate = walletGateMessage();
      if (gate) {
        setMessages((m) => [...m, { role: 'assistant', content: `⚠️ ${gate}` }]);
        return;
      }

      const next = [...messages, { role: 'user' as const, content }];
      setMessages(next);
      setInput('');
      setBusy(true);

      try {
        const retry = (paymentProof?: PaymentProof) =>
          makeRequest({ messages: next }, paymentProof);
        const res = await retry();
        await handleResponse(res, retry);
      } catch (err) {
        logger.warn('[CreativeGuideChat] chat error:', err);
        setMessages((m) => [
          ...m,
          {
            role: 'assistant',
            content:
              err instanceof Error
                ? `⚠️ ${err.message}`
                : '⚠️ Could not reach Creative Guide.',
          },
        ]);
      } finally {
        setBusy(false);
      }
    },
    [
      messages,
      busy,
      isPaymentProcessing,
      walletGateMessage,
      makeRequest,
      handleResponse,
    ],
  );

  const startUpload = useCallback(async () => {
    if (busy || isPaymentProcessing) return;

    const gate = walletGateMessage();
    if (gate) {
      setMessages((m) => [...m, { role: 'assistant', content: `⚠️ ${gate}` }]);
      return;
    }

    setBusy(true);
    try {
      const res = await makeRequest({ action: 'reveal_dropzone' });
      const data = await res.json().catch(() => ({}));
      if (data?.reveal) {
        const stepsList = data.steps ?? [];
        setSteps(stepsList);
        onRevealDropzone?.(stepsList);
        router.push('/upload');
        setMessages((m) => [
          ...m,
          {
            role: 'assistant',
            content:
              "Let's get your first clip up. I've opened the upload area — " +
              'pick a video, add a title, and publish. Need the steps broken down?',
          },
        ]);
      } else {
        setMessages((m) => [
          ...m,
          { role: 'assistant', content: `⚠️ ${formatGuideError(data)}` },
        ]);
      }
    } catch (err) {
      logger.warn('[CreativeGuideChat] startUpload error:', err);
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content:
            err instanceof Error
              ? `⚠️ ${err.message}`
              : '⚠️ Could not reach Creative Guide.',
        },
      ]);
    } finally {
      setBusy(false);
    }
  }, [
    busy,
    isPaymentProcessing,
    walletGateMessage,
    makeRequest,
    onRevealDropzone,
    router,
  ]);

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
        <div className="flex items-center gap-2">
          {(messages.length > 0 || steps) && (
            <button
              type="button"
              onClick={clearChat}
              disabled={busy || isPaymentProcessing}
              className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-50"
              aria-label="Clear chat"
              title="Clear chat"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-xs text-muted-foreground"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-3 text-sm">
        {messages.length === 0 && (
          <p className="text-muted-foreground">
            Hi — I&apos;ll walk you through uploading your first clip. Ask me anything,
            or tap below to start. Basic upload help is free; advanced AI questions
            cost a small USDC payment.
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
          disabled={busy || isPaymentProcessing}
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
            disabled={busy || isPaymentProcessing}
            className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
