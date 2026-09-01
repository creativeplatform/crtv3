import {
  type Address,
  type Chain,
  createPublicClient,
  http,
} from "viem";
import { base, gnosis, sepolia } from "viem/chains";
import { heartBitAbi } from "./abi";
import {
  DEFAULT_HEARTBIT_CHAIN,
  HEART_BIT_CONFIG,
  type HeartBitChain,
} from "./config";

const VIEM_CHAIN_BY_HEARTBIT: Record<HeartBitChain, Chain> = {
  "0xaa36a7": sepolia,
  "0x2105": base,
  "0x64": gnosis,
};

export type UnsignedMintArgs = {
  startTime: number;
  endTime: number;
  hash: string;
  account: string;
  apiKey: string;
};

/**
 * Thin HeartBit client (viem + Fileverse relayer).
 * Mirrors @fileverse/heartbit-core without the broken npm workspace dep.
 */
export class HeartBitClient {
  readonly chain: HeartBitChain;
  private readonly relayerUrl: string;
  private readonly contractAddress: Address;
  private readonly publicClient;

  constructor(chain: HeartBitChain = DEFAULT_HEARTBIT_CHAIN, rpcUrl?: string) {
    const cfg = HEART_BIT_CONFIG[chain];
    this.chain = chain;
    this.relayerUrl = cfg.relayerUrl;
    this.contractAddress = cfg.contractAddress;
    this.publicClient = createPublicClient({
      chain: VIEM_CHAIN_BY_HEARTBIT[chain],
      transport: http(rpcUrl || cfg.publicRPCUrl),
    });
  }

  async unSignedMintHeartBit(opts: UnsignedMintArgs) {
    const { apiKey, ...rest } = opts;
    const response = await fetch(this.relayerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify(rest),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(
        (data as { message?: string; error?: string })?.message ||
          (data as { error?: string })?.error ||
          `HeartBit mint failed (${response.status})`
      );
    }
    return data;
  }

  async getTokenIdByHash(hash: string): Promise<bigint> {
    return (await this.publicClient.readContract({
      address: this.contractAddress,
      abi: heartBitAbi,
      functionName: "hashTokenMap",
      args: [hash],
    })) as bigint;
  }

  async getTotalHeartBitByHash(hash: string): Promise<number> {
    const tokenId = await this.getTokenIdByHash(hash);
    // tokenId 0 is valid once a hash has been minted (Fileverse maps first hash to 0)
    const supply = (await this.publicClient.readContract({
      address: this.contractAddress,
      abi: heartBitAbi,
      functionName: "totalSupply",
      args: [tokenId],
    })) as bigint;
    return Number(supply);
  }

  async getTotalHeartMintsByUser(hash: string, account: Address): Promise<number> {
    const tokenId = await this.getTokenIdByHash(hash);
    const bal = (await this.publicClient.readContract({
      address: this.contractAddress,
      abi: heartBitAbi,
      functionName: "balanceOf",
      args: [account, tokenId],
    })) as bigint;
    return Number(bal);
  }
}

/** Video-only hash when no sticker; composite `video|sticker` when attached. */
export function buildCompositeHash(
  videoHash: string,
  stickerHash?: string | null
): string {
  if (!stickerHash) return videoHash;
  return `${videoHash}|${stickerHash}`;
}
