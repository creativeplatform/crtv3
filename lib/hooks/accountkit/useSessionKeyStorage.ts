import { useState, useEffect } from "react";
import { useUser } from "@/lib/wallet/react";
import { type SessionKeyPermissions } from "./useSessionKey";
import { logger } from '@/lib/utils/logger';


export interface SessionKeyData {
  address: string;
  privateKey: string;
  entityId: number;
  permissions: SessionKeyPermissions;
  createdAt: number;
}

export function useSessionKeyStorage() {
  const [sessionKeys, setSessionKeys] = useState<SessionKeyData[]>([]);
  const user = useUser();

  // Load session keys from localStorage on mount
  useEffect(() => {
    if (!user?.address) return;

    const storageKey = `session-keys-${user.address}`;
    const storedKeys = localStorage.getItem(storageKey);

    if (storedKeys) {
      try {
        const parsedKeys = JSON.parse(storedKeys, (key, value) => {
          // Handle BigInt serialization
          if (
            key === "spendingLimit" &&
            typeof value === "string" &&
            value.includes("n")
          ) {
            return BigInt(value.slice(0, -1));
          }
          return value;
        });
        setSessionKeys(parsedKeys);
      } catch (error) {
        logger.error("Error parsing stored session keys:", error);
        localStorage.removeItem(storageKey);
      }
    }
  }, [user?.address]);

  // Save session keys to localStorage whenever they change
  const updateSessionKeys = (newKeys: SessionKeyData[]) => {
    if (!user?.address) return;

    const storageKey = `session-keys-${user.address}`;

    // Filter out expired session keys
    const currentTime = Math.floor(Date.now() / 1000);
    const validKeys = newKeys.filter((key) => {
      // Check time-based expiry
      if (key.permissions.timeLimit) {
        const expiryTime = key.createdAt + key.permissions.timeLimit;
        if (expiryTime <= currentTime) return false;
      }

      // Check spending limit (if applicable)
      // Note: This would require tracking actual spending in a real implementation
      return true;
    });

    setSessionKeys(validKeys);

    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify(validKeys, (key, value) => {
          // Handle BigInt serialization
          if (typeof value === "bigint") {
            return value.toString() + "n";
          }
          return value;
        })
      );
    } catch (error) {
      logger.error("Error storing session keys:", error);
    }
  };

  const addSessionKey = (key: Omit<SessionKeyData, "createdAt">) => {
    const newKey = {
      ...key,
      createdAt: Math.floor(Date.now() / 1000),
    };
    const newKeys = [...sessionKeys, newKey];
    updateSessionKeys(newKeys);
    return newKey;
  };

  const removeSessionKey = (address: string) => {
    const newKeys = sessionKeys.filter((key) => key.address !== address);
    updateSessionKeys(newKeys);
  };

  const getSessionKey = (address: string) => {
    return sessionKeys.find((key) => key.address === address);
  };

  const getSessionKeyByEntityId = (entityId: number) => {
    return sessionKeys.find((key) => key.entityId === entityId);
  };

  return {
    sessionKeys,
    addSessionKey,
    removeSessionKey,
    getSessionKey,
    getSessionKeyByEntityId,
    updateSessionKeys,
  };
}
