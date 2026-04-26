"use client";

import { useState } from "react";
import { useSendUserOperation, useSmartAccountClient } from "@account-kit/react";
import { encodeFunctionData, type Abi } from "viem";
import { Button } from "@/components/ui/button";
import { appendBuilderCode } from "@/lib/utils/builder-code";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import unlockAbiJson from "@/lib/abis/Unlock.json";

interface CancelMembershipButtonProps {
    lockAddress: string;
    tokenId: string;
}

export function CancelMembershipButton({
    lockAddress,
    tokenId,
}: CancelMembershipButtonProps) {
    const [isOpen, setIsOpen] = useState(false);
    const { client } = useSmartAccountClient({ type: "LightAccount" });

    const { sendUserOperation, isSendingUserOperation } = useSendUserOperation({
        client,
        waitForTxn: true,
        onSuccess: ({ hash }) => {
            console.log("Cancellation successful:", hash);
            toast.success("Membership cancelled successfully");
            setIsOpen(false);
            // Optional: Refresh page or invalidate queries to update UI
            setTimeout(() => window.location.reload(), 2000);
        },
        onError: (error) => {
            console.error("Cancellation error:", error);
            toast.error("Failed to cancel membership. Please try again.");
            setIsOpen(false);
        },
    });

    const handleCancel = () => {
        if (!client) {
            toast.error("Wallet client not initialized");
            return;
        }

        try {
            const data = encodeFunctionData({
                abi: unlockAbiJson.abi as Abi,
                functionName: "cancelAndRefund",
                args: [BigInt(tokenId)],
            });

            sendUserOperation({
                uo: {
                    target: lockAddress as `0x${string}`,
                    data: appendBuilderCode(data),
                    value: 0n,
                },
            });
        } catch (error) {
            console.error("Error preparing transaction:", error);
            toast.error("Error preparing cancellation transaction");
        }
    };

    return (
        <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
            <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                    Cancel Membership
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will cancel your membership immediately. You may receive a prorated refund depending on the lock settings, but access will be revoked right away.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isSendingUserOperation}>
                        Keep Membership
                    </AlertDialogCancel>
                    <AlertDialogAction
                        onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                            e.preventDefault(); // Prevent auto-close
                            handleCancel();
                        }}
                        disabled={isSendingUserOperation}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                        {isSendingUserOperation ? "Cancelling..." : "Yes, Cancel"}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
