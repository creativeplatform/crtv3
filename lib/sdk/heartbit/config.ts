import type { Address } from "viem";

/** Fileverse HeartBit chain identifiers */
export type HeartBitChain = "0xaa36a7" | "0x2105" | "0x64";

export const HEART_BIT_CONFIG: Record<
  HeartBitChain,
  {
    chainId: number;
    relayerUrl: string;
    contractAddress: Address;
    publicRPCUrl: string;
  }
> = {
  "0xaa36a7": {
    chainId: 11155111,
    relayerUrl: "https://sepolia-heartbit.fileverse.io",
    contractAddress: "0x47E3fd3331a89822A980DA7Fe51592bD6f900FE6",
    publicRPCUrl: "https://rpc.ankr.com/eth_sepolia",
  },
  "0x2105": {
    chainId: 8453,
    relayerUrl: "https://base-heartbit.fileverse.io",
    contractAddress: "0x5290B2e25c98015cE80b43C5c5CfBd01aA372E04",
    publicRPCUrl: "https://mainnet.base.org",
  },
  "0x64": {
    chainId: 100,
    relayerUrl: "http://gnosis-heartbit.fileverse.io",
    contractAddress: "0xD9De9EdE4EFB6088a257C6AdB21619dE656C0863",
    publicRPCUrl: "https://rpc.ankr.com/gnosis",
  },
};

/** Default to Base mainnet for Creative TV */
export const DEFAULT_HEARTBIT_CHAIN: HeartBitChain = "0x2105";

/** USDC charged per second of hold (uncapped — tip size = hold duration × rate). */
export const USDC_TIP_RATE_PER_SECOND = 0.01;

/**
 * Soft ceiling for a single hold session (mint + ledger validation).
 * Not a tip-amount cap — users may tip repeatedly. 1 hour supports long live holds.
 */
export const MAX_HOLD_SECONDS = 3600;
