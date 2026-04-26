import { useState } from 'react';
import { useSmartAccountClient } from '@account-kit/react';
import { encodeFunctionData, parseEther } from 'viem';
import { useToast } from '@/components/ui/use-toast';
import { useGasSponsorship } from '@/lib/hooks/wallet/useGasSponsorship';
import { logger } from '@/lib/utils/logger';
import { appendBuilderCode } from "@/lib/utils/builder-code";


const ERC20_ABI = [
    {
        "inputs": [
            { "internalType": "address", "name": "recipient", "type": "address" },
            { "internalType": "uint256", "name": "amount", "type": "uint256" }
        ],
        "name": "transfer",
        "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
        "stateMutability": "nonpayable",
        "type": "function"
    }
] as const;

export function useMeTokenPurchase() {
    const { client } = useSmartAccountClient({});
    const { getGasContext } = useGasSponsorship();
    const { toast } = useToast();
    const [isPending, setIsPending] = useState(false);
    const [isConfirming, setIsConfirming] = useState(false);

    const purchaseVideo = async (
        videoId: number,
        price: string,
        meTokenAddress: string,
        creatorAddress: string
    ) => {
        if (!client) {
            toast({
                title: "Error",
                description: "Wallet not connected",
                variant: "destructive",
            });
            return;
        }

        setIsPending(true);
        try {
            const amountWei = parseEther(price);

            // 1. Send Transfer Transaction (Pay the creator)
            // In a real app, this might go to a platform contract that handles splits, 
            // but for now we transfer directly to owner as per requirements.
            // 1. Send Transfer Transaction (Pay the creator)
            const data = encodeFunctionData({
                abi: ERC20_ABI,
                functionName: 'transfer',
                args: [creatorAddress as `0x${string}`, amountWei],
            });

            const uoCallData = {
                target: meTokenAddress as `0x${string}`,
                data: appendBuilderCode(data),
                value: BigInt(0),
            };

            const executeOperation = async (context: any) => {
                return await client.sendUserOperation({
                    uo: uoCallData,
                    context: context,
                    overrides: {
                        paymasterAndData: context ? undefined : undefined,
                    }
                });
            };

            const gasContext = getGasContext('usdc');
            const primaryContext = gasContext.context;

            let uo;
            try {
                uo = await executeOperation(primaryContext);
            } catch (err) {
                if (primaryContext) {
                    logger.warn("Primary gas payment failed, retrying with standard gas...", err);
                    uo = await executeOperation(undefined);
                } else {
                    throw err;
                }
            }

            setIsPending(false);
            setIsConfirming(true);

            const txHash = await client.waitForUserOperationTransaction({
                hash: uo.hash,
            });

            // 2. Register Purchase in DB
            const response = await fetch('/api/purchases/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    videoId,
                    transactionHash: txHash,
                    amount: price,
                    currency: meTokenAddress
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to register purchase');
            }

            setIsConfirming(false);
            toast({
                title: "Success!",
                description: "Video unlocked.",
            });

            return txHash;
        } catch (error) {
            logger.error("Purchase failed:", error);
            setIsPending(false);
            setIsConfirming(false);
            toast({
                title: "Purchase Failed",
                description: error instanceof Error ? error.message : "Unknown error",
                variant: "destructive",
            });
            throw error;
        }
    };

    return {
        purchaseVideo,
        isPending,
        isConfirming,
    };
}
