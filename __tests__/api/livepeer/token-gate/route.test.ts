import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST, GET } from '@app/api/livepeer/token-gate/route';
import { generateAccessKey } from '@app/lib/access-key';
import * as auth from '@app/api/auth/thirdweb/authentication';
import * as thirdweb from 'thirdweb';

// Mock dependencies
vi.mock('@app/lib/access-key');
// vi.mock('@app/lib/sdk/thirdweb/client');
// vi.mock('@app/lib/sdk/thirdweb/auth');
vi.mock('@app/api/auth/thirdweb/authentication');
vi.mock('thirdweb');

describe('Token Gate Route', () => {
//   beforeEach(() => {

//   });
  
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST endpoint', () => {
    it('should return 400 if required fields are missing', async () => {
      const req = new NextRequest('http://localhost:3000/api/livepeer/token-gate', {
        method: 'POST',
        body: JSON.stringify({
          accessKey: 'test-key',
          // Missing required fields
          context: {},
          timestamp: Date.now(),
        }),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.allowed).toBe(false);
      expect(data.message).toContain('missing required fields');
    });

    it('should validate access successfully', async () => {
      // Mock dependencies
      vi.mocked(auth.getJwtContext).mockResolvedValue({ address: '0x123' });
      vi.mocked(generateAccessKey).mockReturnValue('f1eebd4b32d7493fd92844910340e4375bf68f434d5eb3921fc4b994aef5fdb8');
      vi.mocked(thirdweb.balanceOf).mockResolvedValue(1n);

      const req = new NextRequest('http://localhost:3000/api/livepeer/token-gate', {
        method: 'POST',
        body: JSON.stringify({
          accessKey: 'f1eebd4b32d7493fd92844910340e4375bf68f434d5eb3921fc4b994aef5fdb8',
          context: {
            creatorAddress: '0x456',
            tokenId: '1',
            contractAddress: '0x789',
            chain: 1,
          },
          timestamp: Date.now(),
        }),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.allowed).toBe(true);
    });
  });

  describe('GET endpoint', () => {
    it('should return 400 if address is missing', async () => {
      const req = new NextRequest('http://localhost:3000/api/livepeer/token-gate?tokenId=1');
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.allowed).toBe(false);
    });

    it('should generate access key successfully', async () => {
      vi.mocked(generateAccessKey).mockReturnValue('f1eebd4b32d7493fd92844910340e4375bf68f434d5eb3921fc4b994aef5fdb8');

      const req = new NextRequest(
        'http://localhost?address=0x123&creatorAddress=0x456&tokenId=1&contractAddress=0x789&chain=1'
      );

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.allowed).toBe(true);
      expect(data.accessKey).toBe('f1eebd4b32d7493fd92844910340e4375bf68f434d5eb3921fc4b994aef5fdb8');
    });
  });
});