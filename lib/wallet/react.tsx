"use client";

/**
 * Drop-in replacements for @account-kit/react hooks after Privy + Wallet APIs v5 migration.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePrivy, useLogout as usePrivyLogout } from "@privy-io/react-auth";
import { useAuthErrorContext } from "./auth-error-context";
import { requestQuoteV0 } from "@alchemy/wallet-apis/experimental";
import type { Address, Hex } from "viem";
import { useWalletChain } from "./chain-context";
import { useWalletClientContext } from "./wallet-context";
import type { CompatSmartAccountClient, SendUserOperationArgs } from "./smart-wallet-client";

export type RequestQuoteV0Result = Awaited<ReturnType<typeof requestQuoteV0>>;

export type CompatUser = {
  address: Address;
  email?: string;
  type: "sca" | "eoa";
};

export function useUser(): CompatUser | null {
  const { user, authenticated } = usePrivy();
  const { eoaAddress, address: scaAddress } = useWalletClientContext();

  return useMemo(() => {
    if (!authenticated || !user) return null;
    const email =
      user.email?.address ??
      user.google?.email ??
      user.twitch?.username ??
      undefined;
    const walletAddress = eoaAddress ?? scaAddress;
    if (!walletAddress) return null;
    return {
      address: walletAddress as Address,
      email,
      type: scaAddress ? ("sca" as const) : ("eoa" as const),
    };
  }, [authenticated, user, eoaAddress, scaAddress]);
}

export function useAuthModal() {
  const { login } = useAuthErrorContext();
  return {
    openAuthModal: login,
  };
}

export function useLogout() {
  const { logout } = usePrivyLogout();
  return { logout };
}

export function useSignerStatus() {
  const { authenticated, ready } = usePrivy();
  return {
    isConnected: authenticated,
    isInitializing: !ready,
    isAuthenticating: !ready,
  };
}

export function useChain() {
  return useWalletChain();
}

type SmartAccountClientOptions = {
  type?: string;
};

export function useSmartAccountClient(_options?: SmartAccountClientOptions) {
  const { client, address, isLoadingClient, error } = useWalletClientContext();
  return {
    client,
    address,
    isLoadingClient,
    error,
  };
}

export function useAccount(_options?: SmartAccountClientOptions) {
  const { address } = useWalletClientContext();
  return { address };
}

export function useSigner() {
  const { signer } = useWalletClientContext();
  return signer ?? null;
}

export function useAuthError() {
  const { authError } = useAuthErrorContext();
  return authError;
}

type SignMessageHookOptions = {
  client?: CompatSmartAccountClient;
  onSuccess?: (signature: Hex) => void;
  onError?: (error: Error) => void;
};

export function useSignMessage(options: SignMessageHookOptions = {}) {
  const { signer } = useWalletClientContext();
  const [isSigningMessage, setIsSigningMessage] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const client = options.client;

  const signMessage = useCallback(
    async (args?: { message: string | Uint8Array }) => {
      const message = args?.message;
      if (!message) {
        const err = new Error("Message is required");
        setError(err);
        optionsRef.current.onError?.(err);
        throw err;
      }

      setIsSigningMessage(true);
      setError(null);
      try {
        let signature: Hex;
        if (client?.signMessage) {
          // Smart-account path: produces an EIP-1271 / ERC-6492 compatible
          // signature that validates against the smart account address.
          signature = await client.signMessage({
            message: typeof message === "string" ? message : { raw: message },
          });
        } else if (signer?.signMessage) {
          // EOA / embedded-wallet fallback.
          signature = (await signer.signMessage({
            message: typeof message === "string" ? message : { raw: message },
          })) as Hex;
        } else {
          const err = new Error("Signer not ready");
          setError(err);
          optionsRef.current.onError?.(err);
          throw err;
        }
        optionsRef.current.onSuccess?.(signature);
        return signature;
      } catch (err) {
        const signError = err instanceof Error ? err : new Error(String(err));
        setError(signError);
        optionsRef.current.onError?.(signError);
        throw signError;
      } finally {
        setIsSigningMessage(false);
      }
    },
    [client, signer],
  );

  return { signMessage, isSigningMessage, error };
}

type TypedDataPayload = {
  domain: Record<string, unknown>;
  types: Record<string, unknown>;
  primaryType: string;
  message: Record<string, unknown>;
};

/**
 * Privy's toViemAccount signs via eth_signTypedData_v4, which JSON-serializes
 * params. Convert BigInt fields to numbers/strings so signing does not throw
 * "Do not know how to serialize a BigInt".
 */
function jsonSafeTypedDataValue(value: unknown): unknown {
  if (typeof value === "bigint") {
    return value <= BigInt(Number.MAX_SAFE_INTEGER) &&
      value >= BigInt(Number.MIN_SAFE_INTEGER)
      ? Number(value)
      : value.toString();
  }
  if (Array.isArray(value)) {
    return value.map(jsonSafeTypedDataValue);
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = jsonSafeTypedDataValue(v);
    }
    return out;
  }
  return value;
}

function toJsonSafeTypedData(typedData: TypedDataPayload): TypedDataPayload {
  return {
    ...typedData,
    domain: jsonSafeTypedDataValue(typedData.domain) as Record<string, unknown>,
    message: jsonSafeTypedDataValue(typedData.message) as Record<string, unknown>,
  };
}

type SignTypedDataHookOptions = {
  client?: CompatSmartAccountClient;
  onSuccess?: (signature: Hex) => void;
  onError?: (error: Error) => void;
};

export function useSignTypedData(options: SignTypedDataHookOptions = {}) {
  const { signer } = useWalletClientContext();
  const [isSigningTypedData, setIsSigningTypedData] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const client = options.client;

  const signTypedData = useCallback(
    async (args: { typedData: TypedDataPayload } | TypedDataPayload) => {
      const raw = "typedData" in args ? args.typedData : args;
      // Always JSON-safe: Privy eth_signTypedData_v4 cannot serialize BigInt.
      const typedData = toJsonSafeTypedData(raw);

      setIsSigningTypedData(true);
      setError(null);
      try {
        let signature: Hex;
        if (client?.signTypedData) {
          signature = (await client.signTypedData(
            typedData as Parameters<NonNullable<typeof client.signTypedData>>[0],
          )) as Hex;
        } else if (signer?.signTypedData) {
          signature = (await signer.signTypedData(
            typedData as Parameters<NonNullable<typeof signer.signTypedData>>[0],
          )) as Hex;
        } else {
          const err = new Error("Signer not ready");
          setError(err);
          optionsRef.current.onError?.(err);
          throw err;
        }
        optionsRef.current.onSuccess?.(signature);
        return signature;
      } catch (err) {
        const signError = err instanceof Error ? err : new Error(String(err));
        setError(signError);
        optionsRef.current.onError?.(signError);
        throw signError;
      } finally {
        setIsSigningTypedData(false);
      }
    },
    [client, signer],
  );

  return { signTypedData, isSigningTypedData, error };
}

type SendUserOperationSuccessArgs = {
  hash: string;
  request?: { sender: Address };
};

type SendUserOperationHookArgs = {
  client?: CompatSmartAccountClient;
  waitForTxn?: boolean;
  onSuccess?: (args: SendUserOperationSuccessArgs) => void;
  onError?: (error: Error) => void;
};

export function useSendUserOperation({
  client: clientOverride,
  waitForTxn = false,
  onSuccess,
  onError,
}: SendUserOperationHookArgs = {}) {
  const { client: contextClient } = useWalletClientContext();
  const client = clientOverride ?? contextClient;
  const [isSendingUserOperation, setIsSendingUserOperation] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const sendUserOperationAsync = useCallback(
    async (args: SendUserOperationArgs) => {
      if (!client) {
        const err = new Error("Smart account client not initialized");
        setError(err);
        onError?.(err);
        throw err;
      }

      setIsSendingUserOperation(true);
      setError(null);
      try {
        const operation = await client.sendUserOperation(args);
        if (waitForTxn) {
          const receipt = await client.waitForUserOperationTransaction({
            hash: operation.hash,
          });
          const successArgs = {
            hash: receipt,
            request: operation.request,
          };
          onSuccess?.(successArgs);
          return { ...operation, hash: receipt };
        }
        onSuccess?.({ hash: operation.hash, request: operation.request });
        return operation;
      } catch (err) {
        const sendError = err instanceof Error ? err : new Error(String(err));
        setError(sendError);
        onError?.(sendError);
        throw sendError;
      } finally {
        setIsSendingUserOperation(false);
      }
    },
    [client, waitForTxn, onSuccess, onError],
  );

  const sendUserOperation = useCallback(
    (args: SendUserOperationArgs) => {
      void sendUserOperationAsync(args);
    },
    [sendUserOperationAsync],
  );

  return {
    sendUserOperation,
    sendUserOperationAsync,
    isSendingUserOperation,
    error,
  };
}

export function usePrivySigner() {
  const { signer } = useWalletClientContext();
  return signer;
}

type SwapHookClient = CompatSmartAccountClient | undefined;

export function usePrepareSwap({ client }: { client?: SwapHookClient } = {}) {
  const [isPreparingSwap, setIsPreparingSwap] = useState(false);

  const prepareSwapAsync = useCallback(
    async (params: Record<string, unknown>): Promise<RequestQuoteV0Result> => {
      if (!client) throw new Error("Smart account client not initialized");
      setIsPreparingSwap(true);
      try {
        const account = client.scaAddress ?? client.getAddress();
        const capabilities = params.capabilities as Record<string, unknown> | undefined;
        const paymasterService = capabilities?.paymasterService as { policyId?: string } | undefined;
        const erc20 = capabilities?.erc20 as { tokenAddress?: string } | undefined;

        const quoteCapabilities =
          paymasterService?.policyId
            ? {
                paymaster: {
                  policyId: paymasterService.policyId,
                  ...(erc20?.tokenAddress
                    ? { erc20: { tokenAddress: erc20.tokenAddress } }
                    : {}),
                },
              }
            : undefined;

        return await requestQuoteV0(client as never, {
          ...params,
          account,
          ...(quoteCapabilities ? { capabilities: quoteCapabilities } : {}),
        } as never);
      } finally {
        setIsPreparingSwap(false);
      }
    },
    [client],
  );

  return { prepareSwapAsync, isPreparingSwap };
}

export function useSignAndSendPreparedCalls({ client }: { client?: SwapHookClient } = {}) {
  const [isSigningAndSendingPreparedCalls, setIsSigning] = useState(false);
  const [signAndSendPreparedCallsResult, setResult] = useState<{
    preparedCallIds: string[];
  } | null>(null);

  const signAndSendPreparedCallsAsync = useCallback(
    async (calls: unknown) => {
      if (!client) throw new Error("Smart account client not initialized");
      setIsSigning(true);
      try {
        const signed = await client.signPreparedCalls(calls);
        const result = await client.sendPreparedCalls(signed);
        setResult(result);
        return result;
      } finally {
        setIsSigning(false);
      }
    },
    [client],
  );

  return {
    signAndSendPreparedCallsAsync,
    isSigningAndSendingPreparedCalls,
    signAndSendPreparedCallsResult,
  };
}

export function useWaitForCallsStatus({
  client,
  id,
}: {
  client?: SwapHookClient;
  id?: string;
} = {}) {
  const [data, setData] = useState<{
    statusCode?: number;
    status?: string;
    receipts?: Array<{ transactionHash?: string }>;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!client || !id) {
      setData(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    void client
      .waitForCallsStatus({ id })
      .then((result) => {
        if (cancelled) return;
        if (result.status === "reverted") {
          setError(new Error("Transaction reverted"));
          setData({ ...result, statusCode: 500 });
          return;
        }
        setData({
          ...result,
          statusCode: result.status === "success" ? 200 : 120,
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [client, id]);

  return { data, isLoading, error };
}

export type { CompatSmartAccountClient, SendUserOperationArgs };
