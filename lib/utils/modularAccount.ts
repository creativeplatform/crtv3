import { baseSepolia, base } from "@account-kit/infra";

// Define factory addresses for each chain
export const modularAccountFactoryAddresses: Record<number, string> = {
  // Base Sepolia
  [baseSepolia.id]: "0x00000000000017c61b5bEe81050EC8eFc9c6fecd",
  // Base
  [base.id]: "0x00000000000017c61b5bEe81050EC8eFc9c6fecd",
};

/** Semi-modular bytecode implementation used for SMA address prediction (Account Kit defaults). */
export const smaBytecodeImplementationAddresses: Record<number, string> = {
  [baseSepolia.id]: "0x000000000000c5A9089039570Dd36455b5C07383",
  [base.id]: "0x000000000000c5A9089039570Dd36455b5C07383",
};
