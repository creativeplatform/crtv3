import { predictModularAccountV2Address } from "@account-kit/smart-contracts";
import { Address, getAddress } from "viem";
import { base } from "@account-kit/infra";
import {
  modularAccountFactoryAddresses,
  smaBytecodeImplementationAddresses,
} from "@/lib/utils/modularAccount";
import { logger } from '@/lib/utils/logger';

/**
 * Linked Identity Utilities
 *
 * Creative TV uses a "Linked Identity" approach:
 * - Primary Display: Smart Wallet address (or ENS/Basename if available)
 * - Background: EOA address for signing operations (Snapshot, approvals, etc.)
 */

function predictSmaAddress(ownerAddress: string): string | null {
  const factory = modularAccountFactoryAddresses[base.id];
  const implementation = smaBytecodeImplementationAddresses[base.id];
  if (!factory || !implementation) return null;

  try {
    return predictModularAccountV2Address({
      factoryAddress: factory as Address,
      implementationAddress: implementation as Address,
      salt: 0n,
      type: "SMA",
      ownerAddress: getAddress(ownerAddress),
    }).toLowerCase();
  } catch (error) {
    logger.warn("Failed to predict SMA address:", error);
    return null;
  }
}

/**
 * Returns true when `companionAddress` is the EOA owner of `smartWalletAddress`
 * (counterfactual or deployed SMA), verified via CREATE2 prediction — not
 * client trust alone.
 */
export async function isPermittedSigner(
  eoaAddress: string,
  smartWalletAddress: string
): Promise<boolean> {
  try {
    const normalizedEOA = getAddress(eoaAddress).toLowerCase();
    const normalizedSmartWallet = getAddress(smartWalletAddress).toLowerCase();

    if (normalizedEOA === normalizedSmartWallet) {
      return true;
    }

    const predicted = predictSmaAddress(normalizedEOA);
    return Boolean(predicted && predicted === normalizedSmartWallet);
  } catch (error) {
    logger.error("Error checking permitted signer:", error);
    return false;
  }
}

/**
 * Verifies that `companionAddress` is linked to `verifiedAddress` (EOA↔SMA pair).
 * Used server-side after wallet auth to safely include a second balance holder.
 */
export async function isLinkedWalletCompanion(
  verifiedAddress: string,
  companionAddress: string,
): Promise<boolean> {
  try {
    const verified = getAddress(verifiedAddress).toLowerCase();
    const companion = getAddress(companionAddress).toLowerCase();
    if (verified === companion) {
      return false;
    }

    return (
      (await isPermittedSigner(companion, verified)) ||
      (await isPermittedSigner(verified, companion))
    );
  } catch (error) {
    logger.error("Error checking linked wallet companion:", error);
    return false;
  }
}

/**
 * Build the viewer address list for MeToken gate checks: always include the
 * cryptographically verified address, plus a linked companion when provable.
 */
export async function resolveVerifiedViewerAddresses(
  verifiedAddress: string,
  companionAddress?: string | null,
): Promise<string[]> {
  const viewers = [getAddress(verifiedAddress).toLowerCase()];

  if (!companionAddress) {
    return viewers;
  }

  const companion = getAddress(companionAddress).toLowerCase();
  if (companion === viewers[0]) {
    return viewers;
  }

  if (await isLinkedWalletCompanion(verifiedAddress, companionAddress)) {
    viewers.push(companion);
  }

  return viewers;
}

export interface LinkedIdentity {
  primaryAddress: string;
  signingAddress: string;
  primaryName: string | null;
  displayText: string;
  isLinked: boolean;
}

export async function getLinkedIdentity(
  smartWalletAddress: string | null,
  eoaAddress: string | null
): Promise<LinkedIdentity> {
  const primary = smartWalletAddress || eoaAddress || "";
  const signing = eoaAddress || "";

  const isLinked = !!(
    smartWalletAddress &&
    eoaAddress &&
    smartWalletAddress.toLowerCase() !== eoaAddress.toLowerCase()
  );

  const primaryName = null;

  let displayText = "";
  if (isLinked) {
    displayText = primaryName
      ? `${primaryName} (via ${shortenAddress(signing)})`
      : `${shortenAddress(primary)} (via ${shortenAddress(signing)})`;
  } else {
    displayText = primaryName || shortenAddress(primary);
  }

  return {
    primaryAddress: primary,
    signingAddress: signing,
    primaryName,
    displayText,
    isLinked,
  };
}

export function formatProposalAuthor(
  smartWalletAddress: string | null,
  eoaAddress: string,
  primaryName?: string | null
): string {
  if (!smartWalletAddress || smartWalletAddress.toLowerCase() === eoaAddress.toLowerCase()) {
    return primaryName || shortenAddress(eoaAddress);
  }

  const primaryDisplay = primaryName || shortenAddress(smartWalletAddress);
  return `${primaryDisplay} (via ${shortenAddress(eoaAddress)})`;
}

function shortenAddress(address: string): string {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
