/** USDC recipient for Creative Guide paid Gemini queries (x402 gate). */
export const CREATIVE_GUIDE_RECIPIENT =
  '0x31ee83aef931a1af321c505053040e98545a5614' as const;

/** Required USDC amount in base units (6 decimals): $0.005 USDC per escalated chat. */
export const CREATIVE_GUIDE_PRICE = '5000';

/** Max age of payment tx (ms) to prevent replay. */
export const CREATIVE_GUIDE_PAYMENT_MAX_AGE_MS = 10 * 60 * 1000;

export const CREATIVE_GUIDE_X402_ENDPOINT =
  'https://x402.payai.network/api/base/paid-content';
