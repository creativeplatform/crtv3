import {
  encodeFunctionData,
  erc20Abi,
  maxUint256,
  parseEventLogs,
  type Address,
  type Hash,
  type Hex,
} from 'viem';
import { appendBuilderCode } from '@/lib/utils/builder-code';
import { METOKEN_DIAMOND_BASE } from '@/lib/contracts/metokens/deployments';
import { publicClient } from '@/lib/viem';
import type { HubCollateralConfig } from '@/lib/metokens/hub-onchain';
import type { CompatSmartAccountClient, SendUserOperationArgs } from '@/lib/wallet/smart-wallet-client';
import type { MeTokenCreationGasResult } from '@/lib/metokens/metoken-gas';
import { formatMeTokenCreationError } from '@/lib/metokens/metoken-gas';

const DIAMOND = METOKEN_DIAMOND_BASE;

const SUBSCRIBE_ABI = [
  {
    inputs: [
      { internalType: 'string', name: 'name', type: 'string' },
      { internalType: 'string', name: 'symbol', type: 'string' },
      { internalType: 'uint256', name: 'hubId', type: 'uint256' },
      { internalType: 'uint256', name: 'assetsDeposited', type: 'uint256' },
    ],
    name: 'subscribe',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

const SUBSCRIBE_EVENT_ABI = [
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'meToken', type: 'address' },
      { indexed: true, internalType: 'address', name: 'owner', type: 'address' },
      { indexed: false, internalType: 'uint256', name: 'minted', type: 'uint256' },
      { indexed: false, internalType: 'address', name: 'asset', type: 'address' },
      { indexed: false, internalType: 'uint256', name: 'assetsDeposited', type: 'uint256' },
      { indexed: false, internalType: 'string', name: 'name', type: 'string' },
      { indexed: false, internalType: 'string', name: 'symbol', type: 'string' },
      { indexed: false, internalType: 'uint256', name: 'hubId', type: 'uint256' },
    ],
    name: 'Subscribe',
    type: 'event',
  },
] as const;

export type MeTokenCreationCall = {
  target: Address;
  data: Hex;
  value: bigint;
};

export function buildMeTokenCreationCalls(params: {
  collateral: HubCollateralConfig;
  vaultAddress: Address;
  name: string;
  symbol: string;
  hubId: number;
  depositAmount: bigint;
}): MeTokenCreationCall[] {
  const { collateral, vaultAddress, name, symbol, hubId, depositAmount } = params;

  const subscribeData = encodeFunctionData({
    abi: SUBSCRIBE_ABI,
    functionName: 'subscribe',
    args: [name, symbol, BigInt(hubId), depositAmount],
  });

  const calls: MeTokenCreationCall[] = [];

  if (depositAmount > BigInt(0)) {
    const approveData = encodeFunctionData({
      abi: erc20Abi,
      functionName: 'approve',
      args: [vaultAddress, maxUint256],
    });

    calls.push({
      target: collateral.address,
      data: appendBuilderCode(approveData),
      value: BigInt(0),
    });
  }

  calls.push({
    target: DIAMOND,
    data: appendBuilderCode(subscribeData),
    value: BigInt(0),
  });

  return calls;
}

export type MeTokenCreationReceiptResult = {
  meTokenAddress?: Address;
  hasApprovalEvent: boolean;
};

export async function verifyMeTokenCreationReceipt(params: {
  txHash: Hash;
  owner: Address;
  vaultAddress?: Address;
  collateralToken?: Address;
  depositAmount: bigint;
}): Promise<MeTokenCreationReceiptResult> {
  const receipt = await publicClient.getTransactionReceipt({ hash: params.txHash });

  if (receipt.status !== 'success') {
    throw new Error(
      formatMeTokenCreationError({
        message: 'MeToken creation transaction reverted on-chain.',
        txHash: params.txHash,
      })
    );
  }

  let hasApprovalEvent = false;
  let meTokenAddress: Address | undefined;

  if (
    params.depositAmount > BigInt(0) &&
    params.collateralToken &&
    params.vaultAddress
  ) {
    const approvalLogs = parseEventLogs({
      abi: erc20Abi,
      logs: receipt.logs,
      eventName: 'Approval',
    });

    hasApprovalEvent = approvalLogs.some(
      (log) =>
        log.args.owner?.toLowerCase() === params.owner.toLowerCase() &&
        log.args.spender?.toLowerCase() === params.vaultAddress!.toLowerCase() &&
        (log.args.value ?? BigInt(0)) >= params.depositAmount
    );
  }

  const subscribeLogs = parseEventLogs({
    abi: SUBSCRIBE_EVENT_ABI,
    logs: receipt.logs,
    eventName: 'Subscribe',
  });

  const subscribeLog = subscribeLogs.find(
    (log) => log.args.owner?.toLowerCase() === params.owner.toLowerCase()
  );

  if (subscribeLog?.args.meToken) {
    meTokenAddress = subscribeLog.args.meToken;
  }

  if (!meTokenAddress) {
    const message = hasApprovalEvent
      ? 'Transaction confirmed but MeToken Subscribe did not complete. Collateral may have been approved without creating your MeToken.'
      : params.depositAmount > BigInt(0)
        ? 'Transaction confirmed but no collateral Approval or Subscribe event was found.'
        : 'Transaction confirmed but no Subscribe event was found. Your MeToken was not created.';

    throw new Error(
      formatMeTokenCreationError({
        message,
        txHash: params.txHash,
      })
    );
  }

  return { meTokenAddress, hasApprovalEvent };
}

const SEND_TIMEOUT_MS = 60_000;
const WAIT_TIMEOUT_MS = 120_000;

export async function sendMeTokenCreationUserOp(params: {
  client: CompatSmartAccountClient;
  calls: MeTokenCreationCall[];
  gas: MeTokenCreationGasResult;
  ethFallback?: () => MeTokenCreationGasResult;
}): Promise<{ hash: string; policyId?: string; usedEthFallback: boolean }> {
  const { client, calls, gas, ethFallback } = params;

  const uo = calls.map((call) => ({
    target: call.target,
    data: call.data,
    value: call.value,
  }));

  const sendWithContext = async (context: SendUserOperationArgs['context']) => {
    const sendPromise = client.sendUserOperation({ uo, context });
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Sending MeToken creation operation timed out')), SEND_TIMEOUT_MS);
    });
    return Promise.race([sendPromise, timeoutPromise]);
  };

  try {
    const operation = await sendWithContext(gas.context);
    return { hash: operation.hash, policyId: gas.policyId, usedEthFallback: false };
  } catch (primaryError) {
    if (!gas.context || !ethFallback) {
      throw primaryError;
    }

    const fallbackGas = ethFallback();
    if (fallbackGas.context) {
      throw primaryError;
    }

    const operation = await sendWithContext(fallbackGas.context);
    return { hash: operation.hash, policyId: fallbackGas.policyId, usedEthFallback: true };
  }
}

export async function waitForMeTokenCreationTx(
  client: CompatSmartAccountClient,
  userOpHash: string
): Promise<Hash> {
  const waitPromise = client.waitForUserOperationTransaction({ hash: userOpHash });
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(
      () =>
        reject(
          new Error(
            'MeToken creation confirmation timed out. Sponsored operations expire after about 10 minutes — please retry.'
          )
        ),
      WAIT_TIMEOUT_MS
    );
  });

  return Promise.race([waitPromise, timeoutPromise]);
}
