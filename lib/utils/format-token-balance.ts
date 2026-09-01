import { formatUnits } from "viem";

/** Format a decimal string token amount for display (no symbol suffix). */
export function formatBalanceDisplay(amount: string): string {
  const num = Number.parseFloat(amount);
  if (!Number.isFinite(num) || num <= 0) return "0";
  if (num < 0.000001) return "< 0.000001";

  if (num < 1) {
    return new Intl.NumberFormat("en-US", {
      maximumFractionDigits: 6,
      minimumFractionDigits: 0,
      useGrouping: false,
    }).format(num);
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 4,
    minimumFractionDigits: 0,
    useGrouping: true,
  }).format(num);
}

export function formatTokenBalance(balance: bigint, decimals: number): string {
  return formatBalanceDisplay(formatUnits(balance, decimals));
}

/** Convert on-chain balance to USD while preserving fractional precision from formatUnits. */
export function tokenBalanceToUsd(
  balance: bigint,
  decimals: number,
  price: number
): number {
  if (balance === 0n || price === 0) return 0;

  const units = formatUnits(balance, decimals);
  const [wholePart, fractionalPart = ""] = units.split(".");
  const whole = BigInt(wholePart || "0");
  const fractionValue =
    fractionalPart.length > 0
      ? Number(fractionalPart) / 10 ** fractionalPart.length
      : 0;

  return (Number(whole) + fractionValue) * price;
}
