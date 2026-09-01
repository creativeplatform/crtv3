import { NextRequest, NextResponse } from 'next/server';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText, tool } from 'ai';
import { z } from 'zod';
import { checkBotIdDeep } from '@/lib/middleware/botIdGuard';
import { rateLimiters } from '@/lib/middleware/rateLimit';
import { requireWalletAuth } from '@/lib/auth/require-wallet';
import { serverLogger } from '@/lib/utils/logger';
import { decodeEventLog } from 'viem';
import { publicClient } from '@/lib/viem';
import { USDC_TOKEN_ADDRESSES } from '@/lib/contracts/USDCToken';
import {
  matchCannedResponse,
  UPLOAD_STEPS,
} from '@/lib/agent/orbguide/canned-responses';

/**
 * OrbGuide — onboarding/navigation agent.
 *
 * Production guardrails:
 *  - BotId deep check
 *  - Standard IP rate limiting
 *  - Wallet-auth required for all calls (prevents unauthenticated API-key burn)
 *  - x402 USDC payment proof required for the paid model call
 *
 * Two modes, one endpoint:
 *  - mode "chat":  stream a Gemini response with agent tools.
 *  - mode "action": perform a UI action and return JSON the client applies.
 */

const SYSTEM_PROMPT = `You are Creative Guide, the onboarding and navigation assistant for the
Creative Platform (crtv3). You help creators upload their first clip. Be concise,
plain-spoken, and never use crypto/web3 jargon without a one-line plain explanation.
The upload flow is: 1) connect wallet (already done), 2) choose a video file,
3) add title/description/tags, 4) optionally attach IP licensing, 5) publish.
Mixtape curation is open to ALL users and is NEVER gated on IP licensing.
Keep replies under 3 sentences unless the user asks for detail.`;

// Reuse the same key env vars as the existing thumbnail route.
const apiKey =
  process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? process.env.GOOGLE_GEMINI_API_KEY;

function model() {
  if (!apiKey) throw new Error('Google Gemini API key not configured');
  const google = createGoogleGenerativeAI({ apiKey });
  return google('gemini-2.0-flash');
}

/** USDC recipient for OrbGuide paid queries (x402/CRTVAI gate). */
const ORBGUIDE_RECIPIENT = '0x31ee83aef931a1af321c505053040e98545a5614' as const;

/** Required USDC amount in base units (6 decimals): $0.005 USDC per chat. */
const ORBGUIDE_PRICE = '5000';

/** Max age of payment tx (ms) to prevent replay. */
const PAYMENT_MAX_AGE_MS = 10 * 60 * 1000;

/**
 * Verifies a USDC transfer to the OrbGuide recipient with amount >= ORBGUIDE_PRICE.
 * Mirrors the x402 proof verification in /api/ai/generate-thumbnail/route.ts.
 */
async function verifyPaymentProof(
  transactionHash: string,
  amount: string,
): Promise<{ valid: boolean; error?: string }> {
  const requiredAmount = BigInt(ORBGUIDE_PRICE);

  let claimedAmount: bigint;
  try {
    claimedAmount = BigInt(amount);
  } catch {
    return { valid: false, error: 'Invalid payment amount' };
  }

  if (claimedAmount < requiredAmount) {
    return { valid: false, error: 'Payment amount is less than required' };
  }

  try {
    const receipt = await publicClient.getTransactionReceipt({
      hash: transactionHash as `0x${string}`,
    });

    if (!receipt) {
      return { valid: false, error: 'Transaction not found' };
    }
    if (receipt.status !== 'success') {
      return { valid: false, error: 'Transaction failed' };
    }

    const now = Date.now();
    const block = await publicClient.getBlock({ blockNumber: receipt.blockNumber });
    const blockTime = Number(block.timestamp) * 1000;
    if (now - blockTime > PAYMENT_MAX_AGE_MS) {
      return { valid: false, error: 'Payment too old; please pay again and retry' };
    }

    const usdcAddress = USDC_TOKEN_ADDRESSES.base.toLowerCase();
    let foundTransfer = false;
    let transferValue = 0n;

    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== usdcAddress) continue;
      try {
        const decoded = decodeEventLog({
          abi: [
            {
              type: 'event',
              name: 'Transfer',
              inputs: [
                { name: 'from', type: 'address', indexed: true },
                { name: 'to', type: 'address', indexed: true },
                { name: 'value', type: 'uint256', indexed: false },
              ],
            },
          ],
          data: log.data,
          topics: log.topics,
        });
        if (decoded.eventName === 'Transfer') {
          const args = decoded.args as { from: string; to: string; value: bigint };
          if (args.to.toLowerCase() === ORBGUIDE_RECIPIENT.toLowerCase()) {
            foundTransfer = true;
            transferValue = args.value;
            break;
          }
        }
      } catch {
        continue;
      }
    }

    if (!foundTransfer || transferValue < requiredAmount) {
      return {
        valid: false,
        error: 'No valid USDC transfer to the service recipient found for this transaction',
      };
    }

    return { valid: true };
  } catch (err) {
    serverLogger.error('[OrbGuide] Payment verification error:', err);
    return {
      valid: false,
      error: err instanceof Error ? err.message : 'Payment verification failed',
    };
  }
}

export async function POST(req: NextRequest) {
  // 1. Production guardrails first.
  const botCheck = await checkBotIdDeep();
  if (botCheck.isBot) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const rl = await rateLimiters.standard(req);
  if (rl) return rl;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const address: string | undefined = body?.address;

  // 2. Wallet-auth required for every call so the API key cannot be burned anonymously.
  let verifiedAddress: string;
  try {
    const wallet = await requireWalletAuth(req);
    verifiedAddress = wallet.address;
  } catch (err) {
    const status = err instanceof Error && 'status' in err ? (err as any).status : 401;
    const message = err instanceof Error ? err.message : 'Wallet authentication required';
    return NextResponse.json({ error: message }, { status });
  }

  // 3. x402 payment proof required before any paid model call.
  const paymentProof = body?.paymentProof as
    | { transactionHash: string; amount: string }
    | undefined;

  if (!paymentProof?.transactionHash || !paymentProof?.amount) {
    return NextResponse.json(
      { error: 'Payment proof is required. Please complete USDC payment before chatting.' },
      { status: 402 },
    );
  }

  const paymentVerification = await verifyPaymentProof(
    paymentProof.transactionHash,
    paymentProof.amount,
  );
  if (!paymentVerification.valid) {
    return NextResponse.json(
      { error: paymentVerification.error ?? 'Invalid payment proof' },
      { status: 402 },
    );
  }

  // 4. Action mode: perform a UI action, return JSON.
  if (body?.action === 'reveal_dropzone') {
    serverLogger.info('[OrbGuide] reveal_dropzone for', verifiedAddress);
    return NextResponse.json({
      reveal: true,
      steps: UPLOAD_STEPS,
      addressPresent: Boolean(verifiedAddress),
    });
  }

  // 5. Chat mode: first try cheap canned responses; escalate only when needed.
  const messages = Array.isArray(body?.messages) ? body.messages : [];
  if (messages.length === 0) {
    return NextResponse.json({ error: 'No messages provided' }, { status: 400 });
  }

  const lastUserMessage = messages
    .slice()
    .reverse()
    .find((m: any) => m?.role === 'user');
  const userText = typeof lastUserMessage?.content === 'string'
    ? lastUserMessage.content
    : '';

  const canned = userText ? matchCannedResponse(userText) : { escalate: true };

  if (!canned.escalate && canned.content) {
    serverLogger.debug('[OrbGuide] canned response used for:', verifiedAddress);
    return NextResponse.json({
      type: 'canned',
      content: canned.content,
      action: canned.action,
    });
  }

  // 6. Escalated chat mode: stream a tool-augmented Gemini response.
  if (!apiKey) {
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
    serverLogger.error('[OrbGuide] streamText error:', error);
    const message =
      error instanceof Error ? error.message : 'Creative Guide response failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
