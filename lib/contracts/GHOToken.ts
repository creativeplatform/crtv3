import { erc20Abi } from "viem";

export const GHO_TOKEN_ADDRESSES = {
  base: "0x6bb7a212910682dcfdbd5bcbb3e28fb4e8da10ee",
} as const;

export const GHO_TOKEN_SYMBOL = "GHO";
export const GHO_TOKEN_DECIMALS = 18;

export function getGhoTokenContract(chain: keyof typeof GHO_TOKEN_ADDRESSES) {
  return {
    address: GHO_TOKEN_ADDRESSES[chain],
    abi: erc20Abi,
    symbol: GHO_TOKEN_SYMBOL,
    decimals: GHO_TOKEN_DECIMALS,
  } as const;
}
