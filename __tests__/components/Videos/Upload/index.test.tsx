import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import HookMultiStepForm from '@app/components/Videos/Upload';
import { useActiveAccount } from 'thirdweb/react';
import { useOrbisContext } from '@app/lib/sdk/orbisDB/context';
import { authedOnly } from '@app/api/auth/thirdweb/authentication';
import { hasAccess } from '@app/api/auth/thirdweb/gateCondition';

// Mock the required dependencies
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock('thirdweb/react', () => ({
  useActiveAccount: vi.fn(),
}));

vi.mock('@app/lib/sdk/orbisDB/context', () => ({
  useOrbisContext: vi.fn(),
}));

vi.mock('@app/api/auth/thirdweb/authentication', () => ({
  authedOnly: vi.fn(),
}));

vi.mock('@app/api/auth/thirdweb/gateCondition', () => ({
  hasAccess: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    loading: vi.fn(),
  },
}));

describe('HookMultiStepForm Token Gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock implementations
    (useActiveAccount as any).mockReturnValue({ address: '0x123' });
    (useOrbisContext as any).mockReturnValue({ 
      isConnected: vi.fn().mockResolvedValue(true),
      insert: vi.fn(),
    });
    
    // Reset toast mock before each test
    vi.mocked(toast.error).mockClear();
  });

  it('should allow access when all conditions are met', async () => {
    // Mock successful authentication checks
    (authedOnly as any).mockResolvedValue(true);
    (hasAccess as any).mockResolvedValue(true);
    (useOrbisContext().isConnected as any).mockResolvedValue(true);

    render(<HookMultiStepForm />);
    await waitFor(() => {
      expect(toast.error).not.toHaveBeenCalled();
    });
  });

  it('should deny access when user is not authenticated', async () => {
    // Mock failed authentication
    (authedOnly as any).mockResolvedValue(false);
    (hasAccess as any).mockResolvedValue(true);
    (useOrbisContext().isConnected as any).mockResolvedValue(true);

    render(<HookMultiStepForm />);

    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
        'Access denied. Please ensure you are connected and have an active Creator Pass in your wallet.'
      );
    });
  });

  it('should deny access when user does not have required token', async () => {
    // Mock failed token gate check
    (authedOnly as any).mockResolvedValue(true);
    (hasAccess as any).mockResolvedValue(false);
    (useOrbisContext().isConnected as any).mockResolvedValue(true);

    render(<HookMultiStepForm />);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'Access denied. Please ensure you are connected and have an active Creator Pass in your wallet.'
      );
    });
  });

  it('should deny access when user is not connected to Orbis', async () => {
    // Mock failed Orbis connection
    (authedOnly as any).mockResolvedValue(true);
    (hasAccess as any).mockResolvedValue(true);
    (useOrbisContext().isConnected as any).mockResolvedValue(false);

    render(<HookMultiStepForm />);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'Access denied. Please ensure you are connected and have an active Creator Pass in your wallet.'
      );
    });
  });

  it('should handle authentication check errors', async () => {
    // Mock error during authentication check
    (authedOnly as any).mockRejectedValue(new Error('Auth check failed'));

    render(<HookMultiStepForm />);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'Failed to verify access. Please try again.'
      );
    });
  });
});
