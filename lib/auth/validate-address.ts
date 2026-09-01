/** Lowercase hex Ethereum address (0x + 40 hex chars). */
export const ETH_ADDRESS_REGEX = /^0x[a-f0-9]{40}$/;

export function isValidEthAddress(address: string): boolean {
  return ETH_ADDRESS_REGEX.test(address.trim().toLowerCase());
}

export function normalizeEthAddress(address: string): string {
  return address.trim().toLowerCase();
}
