import { type Address, type WalletClient, encodeFunctionData, type PublicClient } from "viem";
import { base } from "@account-kit/infra";
import { getCanonicalRealityEthArbitratorAddress } from "./reality-eth-client";
import { serverLogger } from "@/lib/utils/logger";
import { appendBuilderCode } from "@/lib/utils/builder-code";

/**
 * Kleros Arbitrator Proxy Interface
 * Based on rule: kleros-oracle.md
 */
export const ARBITRATOR_PROXY_ABI = [
    {
        "inputs": [
            { "internalType": "uint256", "name": "_questionID", "type": "uint256" },
            { "internalType": "string", "name": "_evidenceURI", "type": "string" }
        ],
        "name": "submitEvidence",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
] as const;

/**
 * Kleros (or other) Reality.eth arbitrator proxy — same address used at question creation and for `submitEvidence`.
 * @see getCanonicalRealityEthArbitratorAddress
 */
export function getArbitratorProxyAddress(): Address {
    return getCanonicalRealityEthArbitratorAddress();
}

/**
 * Submit evidence to the Kleros Arbitrator for a specific question.
 * 
 * @param walletClient - Viem wallet client or Account Kit smart account client
 * @param questionId - The Reality.eth question ID (bytes32 hex string)
 * @param evidenceArgs - The evidence data complying with ERC-1497
 * @param ipfsHandler - Optional handler to upload evidence JSON to IPFS and return URI
 *                      If not provided, evidenceArgs must serve as the URI or be pre-uploaded.
 */
export async function submitEvidence(
    walletClient: WalletClient | any,
    questionId: string,
    evidenceUri: string
): Promise<`0x${string}`> {
    const account = walletClient.account?.address;
    if (!account) {
        throw new Error("Wallet account not found");
    }

    // Convert bytes32 questionID to uint256 as required by Kleros Arbitrator Proxy
    // Removing '0x' prefix if present before BigInt conversion
    const questionIdInt = BigInt(questionId);
    const arbitratorAddress = getArbitratorProxyAddress();

    serverLogger.debug("⚖️ Submitting evidence to Kleros:", {
        arbitrator: arbitratorAddress,
        questionId: questionId,
        questionIdInt: questionIdInt.toString(),
        evidenceUri
    });

    const data = encodeFunctionData({
        abi: ARBITRATOR_PROXY_ABI,
        functionName: "submitEvidence",
        args: [questionIdInt, evidenceUri]
    });

    // Check for Account Kit smart account client
    if (walletClient.sendUserOperation && typeof walletClient.sendUserOperation === 'function') {
        serverLogger.debug("📦 Using Account Kit sendUserOperation for submitEvidence");
        try {
            const operation = await walletClient.sendUserOperation({
                uo: {
                    target: arbitratorAddress,
                    data: appendBuilderCode(data as `0x${string}`),
                    value: 0n,
                },
            });

            serverLogger.debug("✅ Evidence user operation sent, hash:", operation.hash);

            if (walletClient.waitForUserOperationTransaction) {
                const receipt = await walletClient.waitForUserOperationTransaction({ hash: operation.hash });
                if (typeof receipt === 'string') return receipt as `0x${string}`;
                if (receipt && typeof receipt === 'object') {
                    if ('transactionHash' in receipt) return (receipt as any).transactionHash as `0x${string}`;
                    if ('receipt' in receipt && (receipt as any).receipt?.transactionHash) return (receipt as any).receipt.transactionHash as `0x${string}`;
                }
            }
            return operation.hash as `0x${string}`;

        } catch (e: any) {
            serverLogger.error("❌ Error sending evidence user operation:", e);
            throw new Error(`Failed to submit evidence: ${e?.message || 'Unknown error'}`);
        }
    }

    // Standard wallet client
    serverLogger.debug("📝 Using regular wallet sendTransaction for evidence");
    try {
        const hash = await walletClient.sendTransaction({
            chain: walletClient.chain || base,
            to: arbitratorAddress,
            data,
            value: 0n,
            account
        });
        return hash;
    } catch (e: any) {
        serverLogger.error("❌ Error sending evidence transaction:", e);
        throw new Error(`Failed to submit evidence: ${e?.message || 'Unknown error'}`);
    }
}
