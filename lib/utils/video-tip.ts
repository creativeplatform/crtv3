import { TokenSymbol } from "@/lib/hooks/video/useVideoTip";

export interface TipData {
  amount: string;
  token: TokenSymbol;
  txHash: string;
}

/**
 * Parse a message content to detect if it's a tip message
 */
export function parseTipMessage(content: string): TipData | null {
  try {
    const parsed = JSON.parse(content);
    if (parsed.type === 'tip' && parsed.amount && parsed.token && parsed.txHash) {
      return {
        amount: parsed.amount,
        token: parsed.token,
        txHash: parsed.txHash,
      };
    }
  } catch {
    // Not JSON, treat as regular text
  }
  return null;
}

/**
 * Format a token symbol for display
 */
export function formatTipToken(token: TokenSymbol): string {
  if (token.startsWith('metoken:')) return 'Creator Token';
  return token;
}

/**
 * Get block explorer URL for transaction
 */
export function getExplorerUrl(txHash: string): string {
  return `https://basescan.org/tx/${txHash}`;
}

/**
 * Format a tip for display in chat
 */
export function formatTipMessage(amount: string, token: TokenSymbol): string {
  return `${amount} ${formatTipToken(token)}`;
}
