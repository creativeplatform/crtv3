import { erc20Abi } from "viem";

/** Sky Protocol USDS on Base (successor to DAI). */
export const USDS_TOKEN_ADDRESSES = {
  base: "0x820c137fa70c8691f0e44dc420a5e53c168921dc",
} as const;

export const USDS_TOKEN_SYMBOL = "USDS";
export const USDS_TOKEN_DECIMALS = 18;

export function getUsdsTokenContract(chain: keyof typeof USDS_TOKEN_ADDRESSES) {
  return {
    address: USDS_TOKEN_ADDRESSES[chain],
    abi: erc20Abi,
    symbol: USDS_TOKEN_SYMBOL,
    decimals: USDS_TOKEN_DECIMALS,
  } as const;
}
