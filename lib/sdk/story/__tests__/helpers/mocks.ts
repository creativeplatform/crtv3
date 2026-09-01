/**
 * Mock utilities for testing Story Protocol factory contract service
 */

import { vi, beforeEach, afterEach } from 'vitest';
import type { Address } from 'viem';

/**
 * Mock smart account client for Account Kit
 */
export function createMockSmartAccountClient() {
  const mockClient = {
    sendUserOperation: vi.fn(),
    waitForUserOperationTransaction: vi.fn(),
    sendTransaction: vi.fn(),
    getAddress: vi.fn(),
    getAddresses: vi.fn(() => Promise.resolve([testData.creatorAddress])),
  };

  return mockClient;
}

/**
 * Mock Supabase client
 */
export function createMockSupabaseClient() {
  const singleMock = vi.fn(() => Promise.resolve({ data: null, error: null }));
  const maybeSingleMock = vi.fn(() => Promise.resolve({ data: null, error: null }));
  const eqMock = vi.fn(() => ({
    single: singleMock,
    maybeSingle: maybeSingleMock,
  }));

  const fromMock = {
    select: vi.fn(() => ({
      eq: eqMock,
    })),
    upsert: vi.fn(() => Promise.resolve({ data: null, error: null })),
    insert: vi.fn(() => Promise.resolve({ data: null, error: null })),
    update: vi.fn(() => Promise.resolve({ data: null, error: null })),
    delete: vi.fn(() => Promise.resolve({ data: null, error: null })),
  };

  const mockClient = {
    from: vi.fn(() => fromMock),
  };

  return mockClient;
}

/**
 * Mock viem public client
 */
export function createMockPublicClient() {
  const mockClient = {
    readContract: vi.fn(),
    waitForTransactionReceipt: vi.fn(),
    getBalance: vi.fn(),
    getChainId: vi.fn(),
  };

  return mockClient;
}

/**
 * Test data factories
 */
export const testData = {
  factoryAddress: '0x1234567890123456789012345678901234567890' as Address,
  creatorAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Address,
  platformMinter: '0x9876543210987654321098765432109876543210' as Address,
  collectionAddress: '0xfEDCBA0987654321FeDcbA0987654321fedCBA09' as Address,
  collectionName: 'Test Collection',
  collectionSymbol: 'TEST',
  metadataURI: 'ipfs://QmTest123456789012345678901234567890123456789012345678901234567890',
  txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as const,
  tokenId: '1',
  bytecode: '0x1234567890' as const,
};

/**
 * Mock transaction receipt with CollectionCreated event
 */
export function createMockTransactionReceipt(collectionAddress: Address) {
  // Event signature: keccak256("CollectionCreated(address,address,string,string)")
  const eventSignature = '0x4f51faf6c4561ff95f067657e43439f0f856d97c04d9eb9075eb457ab0d5e1f1';

  return {
    status: 'success' as const,
    transactionHash: testData.txHash,
    blockNumber: BigInt(12345),
    logs: [
      {
        address: testData.factoryAddress,
        topics: [
          eventSignature,
          `0x000000000000000000000000${testData.creatorAddress.slice(2)}`,
          `0x000000000000000000000000${collectionAddress.slice(2)}`,
        ],
        data: '0x',
      },
    ],
  };
}

/**
 * Helper to mock environment variables.
 *
 * Call this at the top level of a `describe` block (NOT inside `beforeEach`).
 * It captures a snapshot of the relevant env vars, sets defaults before each
 * test, and restores them after each test so tests cannot permanently clobber
 * `process.env` for the rest of the suite.
 */
export function mockEnvVars(overrides: Record<string, string> = {}) {
  const envKeys = [
    'NEXT_PUBLIC_CREATOR_IP_FACTORY_ADDRESS',
    ...Object.keys(overrides),
  ];
  const originalValues = new Map<string, string | undefined>();

  for (const key of envKeys) {
    originalValues.set(key, process.env[key]);
  }

  beforeEach(() => {
    process.env.NEXT_PUBLIC_CREATOR_IP_FACTORY_ADDRESS = testData.factoryAddress;
    for (const [key, value] of Object.entries(overrides)) {
      process.env[key] = value;
    }
  });

  afterEach(() => {
    for (const key of envKeys) {
      process.env[key] = originalValues.get(key);
    }
  });
}


