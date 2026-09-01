/**
 * Tests for factory-contract-service.ts
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Address } from 'viem';
import {
  deployCreatorCollection,
  getCreatorCollectionAddress,
  hasCreatorCollection,
  mintInCreatorCollection,
  grantPlatformMinterRole,
} from '../factory-contract-service';
import {
  createMockSmartAccountClient,
  createMockSupabaseClient,
  createMockPublicClient,
  testData,
  createMockTransactionReceipt,
  mockEnvVars,
} from './helpers/mocks';

// Mock dependencies
let storyPublicClient: ReturnType<typeof createMockPublicClient>;
let serviceSupabase: ReturnType<typeof createMockSupabaseClient>;

vi.mock('@/lib/sdk/story/client', () => ({
  createStoryPublicClient: () => storyPublicClient,
}));

vi.mock('@/lib/sdk/supabase/service', () => ({
  createServiceClient: () => serviceSupabase,
}));

describe('factory-contract-service', () => {
  mockEnvVars();

  let mockSmartAccountClient: ReturnType<typeof createMockSmartAccountClient>;
  let mockPublicClient: ReturnType<typeof createMockPublicClient>;
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(() => {
    mockSmartAccountClient = createMockSmartAccountClient();
    mockPublicClient = createMockPublicClient();
    mockSupabase = createMockSupabaseClient();

    storyPublicClient = mockPublicClient;
    serviceSupabase = mockSupabase;

    // Setup default mocks
    mockSmartAccountClient.sendUserOperation.mockResolvedValue({
      hash: '0xoperationhash',
    });
    mockSmartAccountClient.waitForUserOperationTransaction.mockResolvedValue(
      testData.txHash
    );
    mockSmartAccountClient.sendTransaction.mockResolvedValue(testData.txHash);
  });

  describe('deployCreatorCollection', () => {
    it('should successfully deploy a collection', async () => {
      const mockReceipt = createMockTransactionReceipt(testData.collectionAddress);
      mockPublicClient.waitForTransactionReceipt.mockResolvedValue(mockReceipt);
      mockPublicClient.readContract.mockResolvedValue(testData.collectionAddress);
      mockSupabase.from().upsert.mockResolvedValue({ data: null, error: null });

      const result = await deployCreatorCollection(
        mockSmartAccountClient as any,
        testData.creatorAddress,
        testData.collectionName,
        testData.collectionSymbol,
        testData.bytecode
      );

      expect(result.collectionAddress).toBe(testData.collectionAddress);
      expect(result.txHash).toBe(testData.txHash);
      expect(mockSmartAccountClient.sendTransaction).toHaveBeenCalled();
      expect(mockSupabase.from().upsert).toHaveBeenCalled();
    });

    it('should extract collection address from event', async () => {
      const mockReceipt = createMockTransactionReceipt(testData.collectionAddress);
      mockPublicClient.waitForTransactionReceipt.mockResolvedValue(mockReceipt);
      mockSupabase.from().upsert.mockResolvedValue({ data: null, error: null });

      const result = await deployCreatorCollection(
        mockSmartAccountClient as any,
        testData.creatorAddress,
        testData.collectionName,
        testData.collectionSymbol,
        testData.bytecode
      );

      expect(result.collectionAddress).toBe(testData.collectionAddress);
    });

    it('should fallback to contract read if event not found', async () => {
      const mockReceipt = {
        ...createMockTransactionReceipt(testData.collectionAddress),
        logs: [], // No events
      };
      mockPublicClient.waitForTransactionReceipt.mockResolvedValue(mockReceipt);
      mockPublicClient.readContract.mockResolvedValue(testData.collectionAddress);
      mockSupabase.from().upsert.mockResolvedValue({ data: null, error: null });

      const result = await deployCreatorCollection(
        mockSmartAccountClient as any,
        testData.creatorAddress,
        testData.collectionName,
        testData.collectionSymbol,
        testData.bytecode
      );

      expect(mockPublicClient.readContract).toHaveBeenCalled();
      expect(result.collectionAddress).toBe(testData.collectionAddress);
    });

    it('should throw error if factory address not configured', async () => {
      process.env.NEXT_PUBLIC_CREATOR_IP_FACTORY_ADDRESS = '';

      await expect(
        deployCreatorCollection(
          mockSmartAccountClient as any,
          testData.creatorAddress,
          testData.collectionName,
          testData.collectionSymbol,
          testData.bytecode
        )
      ).rejects.toThrow('Factory contract address not configured');
    });

    it('should handle transaction failure', async () => {
      mockSmartAccountClient.sendTransaction.mockRejectedValue(
        new Error('Transaction failed')
      );

      await expect(
        deployCreatorCollection(
          mockSmartAccountClient as any,
          testData.creatorAddress,
          testData.collectionName,
          testData.collectionSymbol,
          testData.bytecode
        )
      ).rejects.toThrow('Collection deployment failed');
    });
  });

  describe('getCreatorCollectionAddress', () => {
    it('should return collection address from factory', async () => {
      mockPublicClient.readContract.mockResolvedValue(testData.collectionAddress);

      const result = await getCreatorCollectionAddress(testData.creatorAddress);

      expect(result).toBe(testData.collectionAddress);
      expect(mockPublicClient.readContract).toHaveBeenCalled();
    });

    it('should return null for zero address', async () => {
      mockPublicClient.readContract.mockResolvedValue(
        '0x0000000000000000000000000000000000000000' as Address
      );

      const result = await getCreatorCollectionAddress(testData.creatorAddress);

      expect(result).toBeNull();
    });

    it('should fallback to database if factory not configured', async () => {
      process.env.NEXT_PUBLIC_CREATOR_IP_FACTORY_ADDRESS = '';
      mockSupabase.from().select().eq().maybeSingle.mockResolvedValue({
        data: { collection_address: testData.collectionAddress },
        error: null,
      });

      const result = await getCreatorCollectionAddress(testData.creatorAddress);

      expect(result).toBe(testData.collectionAddress);
    });

    it('should return null on error', async () => {
      mockPublicClient.readContract.mockRejectedValue(new Error('RPC error'));

      const result = await getCreatorCollectionAddress(testData.creatorAddress);

      expect(result).toBeNull();
    });
  });

  describe('hasCreatorCollection', () => {
    it('should return true if collection exists', async () => {
      mockPublicClient.readContract.mockResolvedValue(testData.collectionAddress);

      const result = await hasCreatorCollection(testData.creatorAddress);

      expect(result).toBe(true);
    });

    it('should return false if collection does not exist', async () => {
      mockPublicClient.readContract.mockResolvedValue(
        '0x0000000000000000000000000000000000000000' as Address
      );

      const result = await hasCreatorCollection(testData.creatorAddress);

      expect(result).toBe(false);
    });
  });

  describe('mintInCreatorCollection', () => {
    it('should mint without URI', async () => {
      mockPublicClient.readContract.mockResolvedValue(BigInt(2)); // currentTokenId after mint

      const result = await mintInCreatorCollection(
        mockSmartAccountClient as any,
        testData.collectionAddress,
        testData.creatorAddress
      );

      expect(result.tokenId).toBe('2');
      expect(result.txHash).toBe(testData.txHash);
      expect(mockSmartAccountClient.sendUserOperation).toHaveBeenCalled();
    });

    it('should mint with URI', async () => {
      mockPublicClient.readContract.mockResolvedValue(BigInt(2));

      const result = await mintInCreatorCollection(
        mockSmartAccountClient as any,
        testData.collectionAddress,
        testData.creatorAddress,
        testData.metadataURI
      );

      expect(result.tokenId).toBe('2');
      expect(mockSmartAccountClient.sendUserOperation).toHaveBeenCalled();
    });

    it('should handle minting errors', async () => {
      mockSmartAccountClient.sendUserOperation.mockRejectedValue(
        new Error('Minting failed')
      );

      await expect(
        mintInCreatorCollection(
          mockSmartAccountClient as any,
          testData.collectionAddress,
          testData.creatorAddress
        )
      ).rejects.toThrow('Minting failed');
    });
  });

  describe('grantPlatformMinterRole', () => {
    it('should grant minter role successfully', async () => {
      const result = await grantPlatformMinterRole(
        mockSmartAccountClient as any,
        testData.collectionAddress,
        testData.platformMinter
      );

      expect(result.txHash).toBe(testData.txHash);
      expect(mockSmartAccountClient.sendUserOperation).toHaveBeenCalled();
    });

    it('should handle errors', async () => {
      mockSmartAccountClient.sendUserOperation.mockRejectedValue(
        new Error('Grant failed')
      );

      await expect(
        grantPlatformMinterRole(
          mockSmartAccountClient as any,
          testData.collectionAddress,
          testData.platformMinter
        )
      ).rejects.toThrow('Grant minter role failed');
    });
  });
});

