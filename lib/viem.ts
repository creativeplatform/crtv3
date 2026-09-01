import { createPublicClient, http, type Address } from "viem";
import { alchemy, base } from "@account-kit/infra";

const apiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
export const fallbackRpc = "https://mainnet.base.org";

// Create a public client for reading blockchain data
export const publicClient = createPublicClient({
  chain: base,
  transport: apiKey
    ? alchemy({ apiKey })
    : http(fallbackRpc),
});

/** Base public RPC client used when the primary Alchemy transport errors. */
export const fallbackPublicClient = createPublicClient({
  chain: base,
  transport: http(fallbackRpc),
});

/** Helper to read the native ETH balance of an address on Base. */
export async function getEthBalance(address: Address) {
  return publicClient.getBalance({ address });
}

/** Helper to read an ERC-20 balance of an address on Base. */
export async function getErc20Balance({
  token,
  owner,
}: {
  token: Address;
  owner: Address;
}) {
  return publicClient.readContract({
    address: token,
    abi: [
      {
        constant: true,
        inputs: [{ name: "_owner", type: "address" }],
        name: "balanceOf",
        outputs: [{ name: "balance", type: "uint256" }],
        payable: false,
        stateMutability: "view",
        type: "function",
      },
    ] as const,
    functionName: "balanceOf",
    args: [owner],
  }) as Promise<bigint>;
}

const ERC20_ALLOWANCE_ABI = [
  {
    constant: true,
    inputs: [
      { name: "_owner", type: "address" },
      { name: "_spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ name: "remaining", type: "uint256" }],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
] as const;

/** Helper to read an ERC-20 allowance on Base. */
export async function getErc20Allowance({
  token,
  owner,
  spender,
}: {
  token: Address;
  owner: Address;
  spender: Address;
}) {
  return publicClient.readContract({
    address: token,
    abi: ERC20_ALLOWANCE_ABI,
    functionName: "allowance",
    args: [owner, spender],
  }) as Promise<bigint>;
}
