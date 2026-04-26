import { NextRequest, NextResponse } from 'next/server';
import { checkBotId } from 'botid/server';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import { decodeEventLog } from 'viem';
import { serverLogger } from '@/lib/utils/logger';
import { rateLimiters } from '@/lib/middleware/rateLimit';
import { groveService } from '@/lib/sdk/grove/service';
import { publicClient } from '@/lib/viem';
import { USDC_TOKEN_ADDRESSES } from '@/lib/contracts/USDCToken';

/** Expected USDC recipient for AI thumbnail generation (x402 paid-content) */
const AI_THUMBNAIL_RECIPIENT = '0x31ee83aef931a1af321c505053040e98545a5614' as const;

/** Required USDC amounts (6 decimals): nano-banana 0.5, gemini-3-pro 1.0 */
const MODEL_PRICE: Record<string, string> = {
  'nano-banana': '500000',
  'gemini-3-pro': '1000000',
};

/** Max age of payment tx (ms) to prevent replay */
const PAYMENT_MAX_AGE_MS = 10 * 60 * 1000;

/**
 * Verifies that the given transaction is a USDC transfer to the AI thumbnail recipient
 * with amount >= required for the selected model.
 */
async function verifyPaymentProof(
  transactionHash: string,
  amount: string,
  model: string
): Promise<{ valid: boolean; error?: string }> {
  const requiredAmount = BigInt(MODEL_PRICE[model] ?? MODEL_PRICE['nano-banana']);

  let claimedAmount: bigint;
  try {
    claimedAmount = BigInt(amount);
  } catch {
    return { valid: false, error: 'Invalid payment amount' };
  }

  if (claimedAmount < requiredAmount) {
    return { valid: false, error: 'Payment amount is less than required for this model' };
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
          if (args.to.toLowerCase() === AI_THUMBNAIL_RECIPIENT.toLowerCase()) {
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
    serverLogger.error('[GenerateThumbnail] Payment verification error:', err);
    return {
      valid: false,
      error: err instanceof Error ? err.message : 'Payment verification failed',
    };
  }
}

export async function POST(request: NextRequest) {
  const verification = await checkBotId();
  if (verification.isBot) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }
  const rl = await rateLimiters.standard(request);
  if (rl) return rl;

  try {
    const body = await request.json();
    const { prompt, model, paymentProof } = body as {
      prompt?: string;
      model?: string;
      paymentProof?: { transactionHash: string; amount: string };
    };

    if (!prompt) {
      return NextResponse.json({
        success: false,
        error: 'Prompt is required for image generation',
      });
    }

    const modelKey = model === 'gemini-3-pro' ? 'gemini-3-pro' : 'nano-banana';

    if (!paymentProof?.transactionHash || !paymentProof?.amount) {
      return NextResponse.json({
        success: false,
        error: 'Payment proof is required. Please complete USDC payment before generating.',
      });
    }

    const paymentVerification = await verifyPaymentProof(
      paymentProof.transactionHash,
      paymentProof.amount,
      modelKey
    );
    if (!paymentVerification.valid) {
      return NextResponse.json({
        success: false,
        error: paymentVerification.error ?? 'Invalid payment proof',
      });
    }

    const apiKey =
      process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: 'Google Gemini API key not configured',
      });
    }

    const google = createGoogleGenerativeAI({ apiKey });
    const modelId =
      modelKey === 'gemini-3-pro'
        ? 'gemini-3-pro-image-preview'
        : 'gemini-2.5-flash-image';
    const languageModel = google.chat(modelId, {
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_LOW_AND_ABOVE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_LOW_AND_ABOVE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_LOW_AND_ABOVE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_LOW_AND_ABOVE' },
      ],
    });

    const enhancedPrompt = `
      Create a high-quality, eye-catching thumbnail image for a video platform in 16:9 aspect ratio. 
      
      Scene description: ${prompt}
      
      Technical requirements:
      - 16:9 aspect ratio (perfect for video thumbnails)
      - High resolution and sharp details
      - Professional lighting and composition
      - Vibrant colors that stand out in video thumbnails
      - Clear focal point that draws attention
      
      Style: Photorealistic with cinematic quality. The image should be compelling enough to make viewers want to click and watch the video.
      
      Make it engaging and professional, suitable for a creative video platform.
    `;

    const result = await generateText({
      model: languageModel,
      prompt: enhancedPrompt,
      providerOptions: {
        google: {
          responseModalities: ['TEXT', 'IMAGE'],
        },
      },
    });

    const imageFile = result.files?.find((f) => f.mimeType.startsWith('image/'));
    if (!imageFile) {
      return NextResponse.json({
        success: false,
        error: 'No image was generated. Please try a different prompt.',
      });
    }

    const imageId = `gemini-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const mimeType = imageFile.mimeType;
    const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/jpeg' ? 'jpg' : 'png';

    const buffer = imageFile.uint8Array;
    const file = new File([buffer], `${imageId}.${ext}`, { type: mimeType });

    let url: string;
    let ipfsHash: string | undefined;
    let storage: 'ipfs' | 'temporary' = 'ipfs';

    const uploadResult = await groveService.uploadFile(file);
    if (uploadResult.success && uploadResult.url) {
      url = uploadResult.url;
      ipfsHash = uploadResult.hash;
    } else {
      serverLogger.warn('[GenerateThumbnail] Grove upload failed, using data URL:', uploadResult.error);
      const base64 = Buffer.from(buffer).toString('base64');
      url = `data:${mimeType};base64,${base64}`;
      storage = 'temporary';
    }

    const images = [{ url, ipfsHash, id: imageId, mimeType, storage }];

    return NextResponse.json({
      success: true,
      images,
      prompt: enhancedPrompt,
    });
  } catch (error) {
    serverLogger.error('[GenerateThumbnail] Error:', error);

    let errorMessage = 'AI generation failed';
    if (error instanceof Error) {
      if (error.message.includes('API_KEY') || error.message.includes('authentication')) {
        errorMessage = 'Invalid Google Gemini API key';
      } else if (error.message.includes('QUOTA') || error.message.includes('quota')) {
        errorMessage = 'API quota exceeded. Please try again later';
      } else if (error.message.includes('SAFETY') || error.message.includes('safety')) {
        errorMessage = 'Content blocked by safety filters. Please try a different prompt';
      } else {
        errorMessage = error.message;
      }
    }

    return NextResponse.json({
      success: false,
      error: errorMessage,
    });
  }
}
