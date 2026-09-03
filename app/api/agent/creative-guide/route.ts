import { NextRequest, NextResponse } from 'next/server';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText, tool } from 'ai';
import { z } from 'zod';
import { requireHumanOrVerifiedBot } from '@/lib/middleware/botIdGuard';
import { rateLimiters } from '@/lib/middleware/rateLimit';
import { requireWalletAuth } from '@/lib/auth/require-wallet';
import { serverLogger } from '@/lib/utils/logger';
import {
  matchCannedResponse,
  UPLOAD_STEPS,
} from '@/lib/agent/creative-guide/canned-responses';
import {
  CREATIVE_GUIDE_PRICE,
  CREATIVE_GUIDE_RECIPIENT,
} from '@/lib/agent/creative-guide/constants';
import { verifyCreativeGuidePaymentProof } from '@/lib/agent/creative-guide/verify-payment';

/**
 * Creative Guide — onboarding/navigation agent.
 *
 * Production guardrails:
 *  - BotId deep check (humans + verified bots)
 *  - Standard IP rate limiting
 *  - Wallet-auth required for all calls (prevents unauthenticated API-key burn)
 *  - x402 USDC payment proof required only for paid Gemini escalation
 *
 * Two modes, one endpoint:
 *  - mode "chat":  stream a Gemini response with agent tools (paid).
 *  - mode "action": perform a UI action and return JSON the client applies (free).
 */

const SYSTEM_PROMPT = `You are Creative Guide, the onboarding and navigation assistant for
Creative TV on the Creative Platform. You help creators upload their first clip,
understand IP licensing, minting, and MeTokens. Be concise, plain-spoken, and
never use crypto/web3 jargon without a one-line plain explanation.
The upload flow is: 1) connect wallet (already done), 2) choose a video file,
3) add title/description/tags, 4) optionally attach IP licensing, 5) publish.
Keep replies under 3 sentences unless the user asks for detail.`;

function getApiKey() {
  return process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? process.env.GOOGLE_GEMINI_API_KEY;
}

function model() {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('Google Gemini API key not configured');
  const google = createGoogleGenerativeAI({ apiKey });
  return google('gemini-2.0-flash');
}

function paymentRequiredResponse() {
  return NextResponse.json(
    {
      error: 'Payment proof is required for advanced AI questions.',
      code: 'PAYMENT_REQUIRED',
      amount: CREATIVE_GUIDE_PRICE,
      recipient: CREATIVE_GUIDE_RECIPIENT,
    },
    { status: 402 },
  );
}

export async function POST(req: NextRequest) {
  const botGuard = await requireHumanOrVerifiedBot('creative-guide');
  if (!botGuard.allowed) return botGuard.response;

  const rl = await rateLimiters.standard(req);
  if (rl) return rl;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  let verifiedAddress: string;
  try {
    const wallet = await requireWalletAuth(req);
    verifiedAddress = wallet.address;
  } catch (err) {
    const status = err instanceof Error && 'status' in err ? (err as any).status : 401;
    const message = err instanceof Error ? err.message : 'Wallet authentication required';
    return NextResponse.json({ error: message }, { status });
  }

  // Free path: reveal upload dropzone (wallet auth only).
  if (body?.action === 'reveal_dropzone') {
    serverLogger.info('[CreativeGuide] reveal_dropzone for', verifiedAddress);
    return NextResponse.json({
      reveal: true,
      steps: UPLOAD_STEPS,
      addressPresent: Boolean(verifiedAddress),
    });
  }

  const messages = Array.isArray(body?.messages) ? body.messages : [];
  if (messages.length === 0 && body?.action !== 'reveal_dropzone') {
    return NextResponse.json({ error: 'No messages provided' }, { status: 400 });
  }

  // Free path: canned responses (wallet auth only).
  if (messages.length > 0) {
    const lastUserMessage = messages
      .slice()
      .reverse()
      .find((m: any) => m?.role === 'user');
    const userText =
      typeof lastUserMessage?.content === 'string' ? lastUserMessage.content : '';

    const canned = userText ? matchCannedResponse(userText) : { escalate: true };

    if (!canned.escalate && canned.content) {
      serverLogger.debug('[CreativeGuide] canned response used for:', verifiedAddress);
      return NextResponse.json({
        type: 'canned',
        content: canned.content,
        action: canned.action,
      });
    }
  }

  // Paid path: Gemini escalation requires x402 payment proof.
  const paymentProof = body?.paymentProof as
    | { transactionHash: string; amount: string }
    | undefined;

  if (!paymentProof?.transactionHash || !paymentProof?.amount) {
    return paymentRequiredResponse();
  }

  const paymentVerification = await verifyCreativeGuidePaymentProof(
    paymentProof.transactionHash,
    paymentProof.amount,
  );
  if (!paymentVerification.valid) {
    return NextResponse.json(
      { error: paymentVerification.error ?? 'Invalid payment proof' },
      { status: 402 },
    );
  }

  if (!getApiKey()) {
    return NextResponse.json(
      { error: 'Google Gemini API key not configured' },
      { status: 500 },
    );
  }

  try {
    const result = streamText({
      model: model(),
      system: SYSTEM_PROMPT,
      messages,
      maxSteps: 4,
      tools: {
        explain_upload_flow: tool({
          description: 'Explain the clip upload flow in plain language.',
          parameters: z.object({}),
          execute: async () => ({ steps: UPLOAD_STEPS }),
        }),
        get_upload_status: tool({
          description:
            "Summarize the user's current upload readiness from their wallet address.",
          parameters: z.object({ address: z.string().optional() }),
          execute: async ({ address }) => ({
            addressPresent: Boolean(address),
            nextStep: address
              ? 'Choose a video file and add its details.'
              : 'Connect your wallet first.',
          }),
        }),
      },
    });

    return result.toDataStreamResponse();
  } catch (error) {
    serverLogger.error('[CreativeGuide] streamText error:', error);
    const message =
      error instanceof Error ? error.message : 'Creative Guide response failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
