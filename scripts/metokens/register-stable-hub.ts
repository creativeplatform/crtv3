#!/usr/bin/env npx tsx
/**
 * Register a stablecoin collateral hub on the MeTokens Diamond (Base).
 *
 * Usage:
 *   HUB_SYMBOL=USDS VAULT_ADDRESS=0x... DIAMOND_OWNER_PRIVATE_KEY=0x... npx tsx scripts/metokens/register-stable-hub.ts
 */
import { createWalletClient, createPublicClient, http, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import {
  METOKEN_DIAMOND_BASE,
  HUB_ASSET_CONFIGS,
  DEFAULT_HUB_CURVE_PARAMS,
  type HubAssetSymbol,
} from '../../lib/contracts/MeTokenHubs';

const DIAMOND = METOKEN_DIAMOND_BASE;

const REGISTER_ABI = parseAbi([
  'function register(address owner, address asset, address vault, uint256 refundRatio, uint256 baseY, uint32 reserveWeight, bytes encodedVaultArgs)',
  'function getHubInfo(uint256 hubId) view returns ((uint256,uint256,uint256,uint256,uint256,address,address,address,bool,bool,bool))',
]);

const REGISTERABLE: HubAssetSymbol[] = ['USDS', 'USDC', 'GHO'];

async function main() {
  const hubSymbol = (process.env.HUB_SYMBOL?.toUpperCase() ?? '') as HubAssetSymbol;
  const privateKey = process.env.DIAMOND_OWNER_PRIVATE_KEY as `0x${string}` | undefined;
  const vaultAddress = (process.env.VAULT_ADDRESS ?? process.env.USDC_VAULT_ADDRESS) as
    | `0x${string}`
    | undefined;
  const hubOwner = (process.env.HUB_OWNER_ADDRESS ??
    (privateKey ? privateKeyToAccount(privateKey).address : undefined)) as
    | `0x${string}`
    | undefined;

  if (!REGISTERABLE.includes(hubSymbol) || !privateKey || !vaultAddress || !hubOwner) {
    console.error(`
Register a stablecoin hub on Base MeTokens Diamond.

Required:
  HUB_SYMBOL                 USDS | USDC | GHO
  VAULT_ADDRESS              Deployed vault for this asset
  DIAMOND_OWNER_PRIVATE_KEY  Admin wallet

Example:
  HUB_SYMBOL=USDS VAULT_ADDRESS=0x... DIAMOND_OWNER_PRIVATE_KEY=0x... npx tsx scripts/metokens/register-stable-hub.ts
`);
    process.exit(1);
  }

  const config = HUB_ASSET_CONFIGS[hubSymbol];
  const publicClient = createPublicClient({ chain: base, transport: http() });
  const account = privateKeyToAccount(privateKey);
  const walletClient = createWalletClient({ account, chain: base, transport: http() });

  const existing = await publicClient.readContract({
    address: DIAMOND,
    abi: REGISTER_ABI,
    functionName: 'getHubInfo',
    args: [BigInt(config.hubId)],
  });

  const assetOnChain = existing[7] as string;
  if (assetOnChain.toLowerCase() === config.address.toLowerCase() && existing[10]) {
    console.log(`${hubSymbol} hub ${config.hubId} already active. Vault: ${existing[6]}`);
    return;
  }

  console.log(`Registering ${hubSymbol} hub (id ${config.hubId})...`);
  const hash = await walletClient.writeContract({
    address: DIAMOND,
    abi: REGISTER_ABI,
    functionName: 'register',
    args: [
      hubOwner,
      config.address,
      vaultAddress,
      BigInt(DEFAULT_HUB_CURVE_PARAMS.refundRatio),
      BigInt(DEFAULT_HUB_CURVE_PARAMS.baseY),
      DEFAULT_HUB_CURVE_PARAMS.reserveWeight,
      '0x',
    ],
  });

  console.log('Transaction submitted:', hash);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`${hubSymbol} hub registered. Status:`, receipt.status);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
