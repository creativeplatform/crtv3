#!/usr/bin/env npx tsx
/**
 * Register a USDC collateral hub on the MeTokens Diamond (Base).
 *
 * Usage:
 *   USDC_VAULT_ADDRESS=0x... DIAMOND_OWNER_PRIVATE_KEY=0x... npx tsx scripts/metokens/register-usdc-hub.ts
 *
 * See docs/METOKENS_CONTRACTS.md and docs/USDC_HUB_SETUP.md
 */
import { createWalletClient, createPublicClient, http, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import {
  METOKEN_DIAMOND_BASE,
  HUB_ASSET_CONFIGS,
  DEFAULT_HUB_CURVE_PARAMS,
  USDC_HUB_ID,
} from '../../lib/contracts/MeTokenHubs';

const DIAMOND = METOKEN_DIAMOND_BASE;
const USDC = HUB_ASSET_CONFIGS.USDC.address;

const REGISTER_ABI = parseAbi([
  'function register(address owner, address asset, address vault, uint256 refundRatio, uint256 baseY, uint32 reserveWeight, bytes encodedVaultArgs)',
  'function getHubInfo(uint256 hubId) view returns ((uint256,uint256,uint256,uint256,uint256,address,address,address,bool,bool,bool))',
]);

async function main() {
  const privateKey = process.env.DIAMOND_OWNER_PRIVATE_KEY as `0x${string}` | undefined;
  const vaultAddress = process.env.USDC_VAULT_ADDRESS as `0x${string}` | undefined;
  const hubOwner = (process.env.HUB_OWNER_ADDRESS ??
    (privateKey ? privateKeyToAccount(privateKey as `0x${string}`).address : undefined)) as
    | `0x${string}`
    | undefined;

  if (!privateKey || !vaultAddress || !hubOwner) {
    console.error(`
Missing required environment variables:
  DIAMOND_OWNER_PRIVATE_KEY  — wallet with Diamond hub registration rights
  USDC_VAULT_ADDRESS         — deployed USDC vault (see meTokens-core add-vault task)
  HUB_OWNER_ADDRESS          — optional; defaults to signer address

USDC on Base: ${USDC}
Diamond:      ${DIAMOND}
Target hub:   ${USDC_HUB_ID}
`);
    process.exit(1);
  }

  const publicClient = createPublicClient({ chain: base, transport: http() });
  const account = privateKeyToAccount(privateKey);
  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http(),
  });

  const existing = await publicClient.readContract({
    address: DIAMOND,
    abi: REGISTER_ABI,
    functionName: 'getHubInfo',
    args: [BigInt(USDC_HUB_ID)],
  });

  const asset = existing[7] as string;
  if (asset.toLowerCase() === USDC.toLowerCase() && existing[10]) {
    console.log(`USDC hub ${USDC_HUB_ID} already active. Vault: ${existing[6]}`);
    return;
  }

  console.log('Registering USDC hub...');
  const hash = await walletClient.writeContract({
    address: DIAMOND,
    abi: REGISTER_ABI,
    functionName: 'register',
    args: [
      hubOwner,
      USDC,
      vaultAddress,
      BigInt(DEFAULT_HUB_CURVE_PARAMS.refundRatio),
      BigInt(DEFAULT_HUB_CURVE_PARAMS.baseY),
      DEFAULT_HUB_CURVE_PARAMS.reserveWeight,
      '0x',
    ],
  });

  console.log('Transaction submitted:', hash);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log('USDC hub registered. Status:', receipt.status);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
