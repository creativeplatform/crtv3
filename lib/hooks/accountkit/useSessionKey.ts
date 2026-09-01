import { useCallback, useState } from "react";
import { useSmartAccountClient, useChain } from "@/lib/wallet/react";
import { generatePrivateKey } from "viem/accounts";
import { LocalAccountSigner } from "@aa-sdk/core";
import { createModularAccountV2Client } from "@account-kit/smart-contracts";
import { type SmartAccountSigner } from "@aa-sdk/core";
import { alchemy } from "@account-kit/infra";
import { useSessionKeyStorage } from "./useSessionKeyStorage";
import { buildSessionKeyContext } from "@/lib/wallet/session-keys";
import { logger } from '@/lib/utils/logger';


export interface SessionKeyPermissions {
  isGlobal?: boolean;
  allowedFunctions?: string[];
  timeLimit?: number; // in seconds
  spendingLimit?: bigint;
  allowedAddresses?: string[];
}

interface UseSessionKeyOptions {
  permissions?: SessionKeyPermissions;
}

export function useSessionKey(options: UseSessionKeyOptions = {}) {
  const { chain } = useChain();
  const { client: smartAccountClient } = useSmartAccountClient({
    type: "ModularAccountV2",
  });
  const [isInstalling, setIsInstalling] = useState(false);
  const { sessionKeys } = useSessionKeyStorage();

  const createSessionKey = useCallback(async () => {
    if (!smartAccountClient?.account || !chain) {
      throw new Error("Smart account not initialized or chain not selected");
    }

    setIsInstalling(true);

    try {
      // Generate session key
      const sessionKeyPrivate = generatePrivateKey();
      const sessionKeySigner: SmartAccountSigner =
        LocalAccountSigner.privateKeyToAccountSigner(sessionKeyPrivate);

      // Get API key from existing transport
      const apiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;

      if (!apiKey) {
        throw new Error("Alchemy API key not found");
      }

      // Calculate next entityId based on existing session keys
      const nextEntityId = sessionKeys.length + 1;

      // Create session key client
      const sessionKeyClient = await createModularAccountV2Client({
        chain,
        transport: alchemy({ apiKey }),
        signer: sessionKeySigner,
        accountAddress: smartAccountClient.getAddress(),
        signerEntity: {
          entityId: nextEntityId,
          isGlobalValidation: options.permissions?.isGlobal ?? false,
        },
      });

      // Verify session key client
      const sessionKeyAddress = await sessionKeySigner.getAddress();
      if (!sessionKeyAddress) {
        throw new Error("Failed to get session key address");
      }

      return {
        sessionKeyPrivate,
        sessionKeyClient,
        sessionKeyAddress,
        entityId: nextEntityId,
      };
    } catch (error) {
      logger.error("Error creating session key:", error);
      throw error;
    } finally {
      setIsInstalling(false);
    }
  }, [
    smartAccountClient,
    chain,
    options.permissions?.isGlobal,
    sessionKeys.length,
  ]);

  const useSessionKeyClient = useCallback(
    async (sessionKeyPrivate: string, entityId: number) => {
      if (!smartAccountClient?.account || !chain) {
        throw new Error("Smart account not initialized or chain not selected");
      }

      const apiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
      if (!apiKey) {
        throw new Error("Alchemy API key not found");
      }

      const sessionKeySigner = LocalAccountSigner.privateKeyToAccountSigner(
        sessionKeyPrivate as `0x${string}`
      );

      return createModularAccountV2Client({
        chain,
        transport: alchemy({ apiKey }),
        signer: sessionKeySigner,
        accountAddress: smartAccountClient.getAddress(),
        signerEntity: {
          entityId,
          isGlobalValidation: options.permissions?.isGlobal ?? false,
        },
      });
    },
    [smartAccountClient, chain, options.permissions?.isGlobal]
  );

  return {
    createSessionKey,
    useSessionKeyClient,
    buildSessionKeyContext,
    isInstalling,
  };
}
