/**
 * Base Builder Code (ERC-8021) Attribution
 *
 * Appends an ERC-8021 data suffix to transaction calldata so that
 * onchain activity is attributed to this app on base.dev.
 *
 * @see https://docs.base.org/base-chain/builder-codes/app-developers
 */

import { Attribution } from "ox/erc8021";
import type { Hex } from "viem";

const BUILDER_CODE = process.env.NEXT_PUBLIC_BASE_BUILDER_CODE;

/**
 * ERC-8021 data suffix generated from the builder code.
 * Returns undefined if no builder code is configured.
 */
export const DATA_SUFFIX: Hex | undefined = BUILDER_CODE
  ? (Attribution.toDataSuffix({ codes: [BUILDER_CODE] }) as Hex)
  : undefined;

/**
 * Append the Base Builder Code attribution suffix to calldata.
 * If no builder code is configured, returns the data unchanged.
 */
export function appendBuilderCode(data: Hex): Hex {
  if (!DATA_SUFFIX) return data;
  // Strip the "0x" prefix from the suffix before concatenating
  return `${data}${DATA_SUFFIX.slice(2)}` as Hex;
}
