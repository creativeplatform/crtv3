import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

process.env.GOOGLE_GENERATIVE_AI_API_KEY = 'test-key';

const OWNER = '0xcccccccccccccccccccccccccccccccccccccccc';

const mockRequireWalletAuth = vi.fn();
const mockStreamText = vi.fn();
const mockVerifyPayment = vi.fn();

vi.mock('botid/server', () => ({
  checkBotId: vi.fn(async () => ({ isBot: false })),
}));

vi.mock('@/lib/middleware/botIdGuard', () => ({
  checkBotIdDeep: vi.fn(async () => ({ isBot: false })),
  requireHumanOrVerifiedBot: vi.fn(async () => ({ allowed: true })),
}));

vi.mock('@/lib/middleware/rateLimit', () => ({
  rateLimiters: {
    standard: vi.fn(async () => null),
  },
}));

vi.mock('@/lib/auth/require-wallet', () => ({
  requireWalletAuth: (...args: unknown[]) => mockRequireWalletAuth(...args),
}));

vi.mock('@/lib/agent/creative-guide/verify-payment', () => ({
  verifyCreativeGuidePaymentProof: (...args: unknown[]) => mockVerifyPayment(...args),
}));

vi.mock('ai', () => ({
  streamText: (...args: unknown[]) => mockStreamText(...args),
  tool: (def: unknown) => def,
}));

vi.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: () => () => 'mock-model',
}));

vi.mock('@/lib/utils/logger', () => ({
  serverLogger: { error: vi.fn(), debug: vi.fn(), info: vi.fn() },
}));

import { POST } from './route';
import { CREATIVE_GUIDE_PRICE, CREATIVE_GUIDE_RECIPIENT } from '@/lib/agent/creative-guide/constants';

function creativeGuideRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/agent/creative-guide', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      'X-Wallet-Address': OWNER,
      'X-Wallet-Timestamp': '1',
      'X-Wallet-Signature': '0xabc',
    },
  });
}

describe('creative-guide POST', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireWalletAuth.mockResolvedValue({ address: OWNER });
    mockVerifyPayment.mockResolvedValue({ valid: true });
    mockStreamText.mockReturnValue({
      toDataStreamResponse: () =>
        new Response('stream-data', {
          headers: { 'content-type': 'text/plain; charset=utf-8' },
        }),
    });
  });

  it('reveal_dropzone succeeds with wallet auth only', async () => {
    const res = await POST(creativeGuideRequest({ action: 'reveal_dropzone', address: OWNER }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.reveal).toBe(true);
    expect(Array.isArray(data.steps)).toBe(true);
    expect(mockStreamText).not.toHaveBeenCalled();
  });

  it('canned upload answer succeeds without payment proof', async () => {
    const res = await POST(
      creativeGuideRequest({
        address: OWNER,
        messages: [{ role: 'user', content: 'How do I upload my first clip?' }],
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.type).toBe('canned');
    expect(data.content).toContain('pick a video');
    expect(mockStreamText).not.toHaveBeenCalled();
  });

  it('unmatched message returns 402 without payment proof', async () => {
    const res = await POST(
      creativeGuideRequest({
        address: OWNER,
        messages: [{ role: 'user', content: 'Why is the sky blue?' }],
      }),
    );
    expect(res.status).toBe(402);
    const data = await res.json();
    expect(data.code).toBe('PAYMENT_REQUIRED');
    expect(data.amount).toBe(CREATIVE_GUIDE_PRICE);
    expect(data.recipient).toBe(CREATIVE_GUIDE_RECIPIENT);
    expect(mockStreamText).not.toHaveBeenCalled();
  });

  it('unmatched message with payment proof proceeds to Gemini stream', async () => {
    const res = await POST(
      creativeGuideRequest({
        address: OWNER,
        messages: [{ role: 'user', content: 'Why is the sky blue?' }],
        paymentProof: {
          transactionHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          amount: CREATIVE_GUIDE_PRICE,
        },
      }),
    );

    expect(res.status).toBe(200);
    expect(mockVerifyPayment).toHaveBeenCalled();
    expect(mockStreamText).toHaveBeenCalled();
  });
});
