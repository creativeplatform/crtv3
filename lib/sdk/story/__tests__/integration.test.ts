/**
 * End-to-end integration tests for factory contract service
 */

import {
  describe, it, expect, beforeEach, afterEach, vi,
} from 'vitest';
import type { Address } from 'viem';
import {
  deployCreatorCollection,
  getCreatorCollectionAddress,
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

describe('Integration Tests', () => {
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

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Full Flow: Deploy → Grant Role → Mint → Verify', () => {
    it('should complete full workflow successfully', async () => {
      // Step 1: Deploy collection
      const mockReceipt = createMockTransactionReceipt(testData.collectionAddress);
      mockPublicClient.waitForTransactionReceipt.mockResolvedValue(mockReceipt);
      mockPublicClient.readContract.mockResolvedValue(testData.collectionAddress);
      mockSupabase.from().upsert.mockResolvedValue({ data: null, error: null });

      const deployResult = await deployCreatorCollection(
        mockSmartAccountClient as any,
        testData.creatorAddress,
        testData.collectionName,
        testData.collectionSymbol,
        testData.bytecode
      );

      expect(deployResult.collectionAddress).toBe(testData.collectionAddress);
      expect(deployResult.txHash).toBe(testData.txHash);

      // Step 2: Verify collection exists
      const collectionAddress = await getCreatorCollectionAddress(
        testData.creatorAddress
      );
      expect(collectionAddress).toBe(testData.collectionAddress);

      // Step 3: Grant minter role (simulated - in real scenario, creator would do this)
      // Note: This would require creator's smart account client, not platform's
      // For integration test, we'll verify the function exists and can be called
      const grantResult = await grantPlatformMinterRole(
        mockSmartAccountClient as any, // In reality, this would be creator's client
        testData.collectionAddress,
        testData.platformMinter
      );

      expect(grantResult.txHash).toBe(testData.txHash);

      // Step 4: Mint NFT
      mockPublicClient.readContract.mockResolvedValue(BigInt(2)); // currentTokenId after mint

      const mintResult = await mintInCreatorCollection(
        mockSmartAccountClient as any,
        testData.collectionAddress,
        testData.creatorAddress,
        testData.metadataURI
      );

      expect(mintResult.tokenId).toBe('2');
      expect(mintResult.txHash).toBe(testData.txHash);

      // Verify all operations were called
      expect(mockSmartAccountClient.sendTransaction).toHaveBeenCalledTimes(1); // Deploy
      expect(mockSmartAccountClient.sendUserOperation).toHaveBeenCalledTimes(2); // Grant, Mint
    });

    it('should handle errors gracefully at each step', async () => {
      // Deploy fails
      mockSmartAccountClient.sendTransaction.mockRejectedValueOnce(
        new Error('Deployment failed')
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

      // Reset and try minting without deployment
      mockSmartAccountClient.sendUserOperation.mockClear();
      mockSmartAccountClient.sendUserOperation.mockRejectedValueOnce(
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

  describe('Account Kit Integration', () => {
    it('should work with mock smart account client', async () => {
      const mockReceipt = createMockTransactionReceipt(testData.collectionAddress);
      mockPublicClient.waitForTransactionReceipt.mockResolvedValue(mockReceipt);
      mockPublicClient.readContract.mockResolvedValue(testData.collectionAddress);
      mockSupabase.from().upsert.mockResolvedValue({ data: null, error: null });

      // Verify smart account client methods are called correctly
      await deployCreatorCollection(
        mockSmartAccountClient as any,
        testData.creatorAddress,
        testData.collectionName,
        testData.collectionSymbol,
        testData.bytecode
      );

      expect(mockSmartAccountClient.sendTransaction).toHaveBeenCalledWith({
        account: testData.creatorAddress,
        to: testData.factoryAddress,
        data: expect.any(String),
        value: BigInt(0),
      });

      expect(mockPublicClient.waitForTransactionReceipt).toHaveBeenCalledWith({
        hash: testData.txHash,
      });
    });

    it('should batch operations correctly', async () => {
      // In a real scenario, Account Kit allows batching multiple operations
      // This test verifies the service can handle batched calls
      const mockReceipt = createMockTransactionReceipt(testData.collectionAddress);
      mockPublicClient.waitForTransactionReceipt.mockResolvedValue(mockReceipt);
      mockPublicClient.readContract.mockResolvedValue(testData.collectionAddress);
      mockSupabase.from().upsert.mockResolvedValue({ data: null, error: null });

      // Deploy
      await deployCreatorCollection(
        mockSmartAccountClient as any,
        testData.creatorAddress,
        testData.collectionName,
        testData.collectionSymbol,
        testData.bytecode
      );

      // Mint (could be batched in real scenario)
      mockPublicClient.readContract.mockResolvedValue(BigInt(2));
      await mintInCreatorCollection(
        mockSmartAccountClient as any,
        testData.collectionAddress,
        testData.creatorAddress
      );

      // Both operations should succeed
      expect(mockSmartAccountClient.sendTransaction).toHaveBeenCalledTimes(1);
      expect(mockSmartAccountClient.sendUserOperation).toHaveBeenCalledTimes(1);
    });
  });

  describe('Database Integration', () => {
    it('should store collection in database after deployment', async () => {
      const mockReceipt = createMockTransactionReceipt(testData.collectionAddress);
      mockPublicClient.waitForTransactionReceipt.mockResolvedValue(mockReceipt);
      mockPublicClient.readContract.mockResolvedValue(testData.collectionAddress);
      mockSupabase.from().upsert.mockResolvedValue({ data: null, error: null });

      await deployCreatorCollection(
        mockSmartAccountClient as any,
        testData.creatorAddress,
        testData.collectionName,
        testData.collectionSymbol,
        testData.bytecode
      );

      // Verify database upsert was called
      expect(mockSupabase.from).toHaveBeenCalledWith('creator_collections');
      expect(mockSupabase.from().upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          creator_id: testData.creatorAddress,
          collection_address: testData.collectionAddress,
          collection_name: testData.collectionName,
          collection_symbol: testData.collectionSymbol,
        }),
        expect.objectContaining({
          onConflict: 'creator_id',
        })
      );
    });

    it('should fallback to database if factory not configured', async () => {
      process.env.NEXT_PUBLIC_CREATOR_IP_FACTORY_ADDRESS = '';

      mockSupabase.from().select().eq().maybeSingle.mockResolvedValue({
        data: { collection_address: testData.collectionAddress } as any,
        error: null,
      });

      const result = await getCreatorCollectionAddress(testData.creatorAddress);

      expect(result).toBe(testData.collectionAddress);
      expect(mockSupabase.from).toHaveBeenCalledWith('creator_collections');
    });
  });

  describe('Error Scenarios and Recovery', () => {
    it('should handle network errors', async () => {
      mockPublicClient.readContract.mockRejectedValue(
        new Error('Network error')
      );

      const result = await getCreatorCollectionAddress(testData.creatorAddress);

      // Should return null on error (graceful degradation)
      expect(result).toBeNull();
    });

    it('should handle transaction timeout', async () => {
      mockSmartAccountClient.waitForUserOperationTransaction.mockRejectedValue(
        new Error('Transaction timeout')
      );

      await expect(
        deployCreatorCollection(
          mockSmartAccountClient as any,
          testData.creatorAddress,
          testData.collectionName,
          testData.collectionSymbol,
          testData.bytecode
        )
      ).rejects.toThrow();
    });

    it('should handle invalid collection address', async () => {
      mockPublicClient.readContract.mockResolvedValue(
        '0x0000000000000000000000000000000000000000' as Address
      );

      const result = await getCreatorCollectionAddress(testData.creatorAddress);

      expect(result).toBeNull();
    });
  });

  describe('Multiple Creators, Multiple Collections', () => {
    it('should handle multiple creator collections', async () => {
      const creator2 = '0x2222222222222222222222222222222222222222' as Address;
      const collection2 = '0x3333333333333333333333333333333333333333' as Address;

      // Deploy first collection
      const mockReceipt1 = createMockTransactionReceipt(testData.collectionAddress);
      mockPublicClient.waitForTransactionReceipt
        .mockResolvedValueOnce(mockReceipt1)
        .mockResolvedValueOnce({
          ...mockReceipt1,
          logs: [
            {
              ...mockReceipt1.logs[0],
              topics: [
                mockReceipt1.logs[0].topics[0],
                `0x000000000000000000000000${creator2.slice(2)}`,
                `0x000000000000000000000000${collection2.slice(2)}`,
              ],
            },
          ],
        });

      mockPublicClient.readContract
        .mockResolvedValueOnce(testData.collectionAddress)
        .mockResolvedValueOnce(collection2);

      mockSupabase.from().upsert.mockResolvedValue({ data: null, error: null });

      await deployCreatorCollection(
        mockSmartAccountClient as any,
        testData.creatorAddress,
        testData.collectionName,
        testData.collectionSymbol,
        testData.bytecode
      );

      await deployCreatorCollection(
        mockSmartAccountClient as any,
        creator2,
        'Collection 2',
        'COL2',
        testData.bytecode
      );

      // Verify both collections exist
      mockPublicClient.readContract
        .mockResolvedValueOnce(testData.collectionAddress)
        .mockResolvedValueOnce(collection2);

      const collection1 = await getCreatorCollectionAddress(testData.creatorAddress);
      const collection2Result = await getCreatorCollectionAddress(creator2);

      expect(collection1).toBe(testData.collectionAddress);
      expect(collection2Result).toBe(collection2);
    });
  });
});

