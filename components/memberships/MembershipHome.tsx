"use client";

import { useEffect, useState } from "react";
import { useSendUserOperation, useSmartAccountClient, useUser, useChain } from "@account-kit/react";
import { formatUnits, parseUnits, encodeFunctionData, encodeAbiParameters, type Abi, erc20Abi, createPublicClient, http } from "viem";
import { MembershipButton } from "./MembershipButton";
import { MembershipCard } from "./MembershipCard";
import { MembershipIcon } from "./MembershipIcon";
import unlockAbiJson from "@/lib/abis/Unlock.json";
import { toast } from "sonner";
import { getUsdcTokenContract, USDC_TOKEN_DECIMALS } from "@/lib/contracts/USDCToken";
import { appendBuilderCode } from "@/lib/utils/builder-code";

type HomeProps = {
    setActiveTab: (tab: string) => void;
};

type MembershipTier = {
    name: string;
    price: string;
    periodLabel: string;
    decimals: number;
    address: string;
    features: string[];
    recommended?: boolean;
};

export function MembershipHome({ setActiveTab }: HomeProps) {
    const user = useUser();
    const { chain } = useChain();
    const { client, address: clientAddress } = useSmartAccountClient({});
    // Use same account as AccountDropdown/TokenBalance so balance matches
    const address = client?.account?.address ?? clientAddress ?? user?.address;
    const canPurchase = Boolean(address && client && chain?.id === 8453);
    const { sendUserOperation, isSendingUserOperation } = useSendUserOperation({
        client,
        waitForTxn: true,
        onSuccess: ({ hash, request }) => {
            console.log("Transaction successful:", hash);
            toast.success("Membership purchased successfully!");
            setIsPurchaseModalOpen(false);
        },
        onError: (error) => {
            console.error("Transaction error:", error);
            toast.error("Failed to purchase membership. Please try again.");
        },
    });

    const [usdcBalance, setUsdcBalance] = useState<string>("0");
    const [isBalanceLoading, setIsBalanceLoading] = useState(true);
    const [selectedTier, setSelectedTier] = useState<MembershipTier | null>(null);
    const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
    const [referrer, setReferrer] = useState<string>("0x1Fde40a4046Eda0cA0539Dd6c77ABF8933B94260"); // Default referrer
    const [email, setEmail] = useState<string>("");

    // Membership Tiers Configuration (prices in USDC; displayed as USD for clarity)
    const tiers: MembershipTier[] = [
        {
            name: "Creator",
            price: "30",
            periodLabel: "every 3 months",
            decimals: 6,
            address: "0x13b818daf7016b302383737ba60c3a39fef231cf",
            features: ["Community Access", "Weekly Challenges", "Resource Library"],
        },
        {
            name: "Investor",
            price: "100",
            periodLabel: "per month",
            decimals: 6,
            address: "0x9c3744c96200a52d05a630d4aec0db707d7509be",
            features: ["Priority Access", "Investment Reports", "Direct Creator Access"],
            recommended: true,
        },
        {
            name: "Brand",
            price: "1000",
            periodLabel: "per month",
            decimals: 6,
            address: "0xf7c4cd399395d80f9d61fde833849106775269c6",
            features: ["Partnership Opportunities", "Brand Showcase", "Strategic Consulting"],
        },
    ];

    // Fetch USDC Balance (same account, chain, and contract as TokenBalance in AccountDropdown)
    useEffect(() => {
        async function fetchBalance() {
            if (!address || !chain) {
                setUsdcBalance("0");
                setIsBalanceLoading(false);
                return;
            }
            const chainKey = chain.id === 8453 ? "base" : null;
            if (!chainKey) {
                setUsdcBalance("0");
                setIsBalanceLoading(false);
                return;
            }
            setIsBalanceLoading(true);
            try {
                const publicClient = createPublicClient({
                    chain,
                    transport: http(),
                });
                const usdcContract = getUsdcTokenContract(chainKey);
                const balance = await publicClient.readContract({
                    address: usdcContract.address as `0x${string}`,
                    abi: usdcContract.abi,
                    functionName: "balanceOf",
                    args: [address as `0x${string}`],
                });
                setUsdcBalance(formatUnits(balance as bigint, USDC_TOKEN_DECIMALS));
            } catch (error) {
                console.error("Error fetching USDC balance:", error);
                setUsdcBalance("0");
            } finally {
                setIsBalanceLoading(false);
            }
        }

        if (address && chain) {
            fetchBalance();
            const interval = setInterval(fetchBalance, 10000);
            return () => clearInterval(interval);
        } else {
            setUsdcBalance("0");
            setIsBalanceLoading(false);
        }
    }, [address, chain]);

    // Handle Purchase Interaction
    const handlePurchase = (tier: MembershipTier) => {
        if (!address) {
            toast.error("Please connect your wallet first");
            return;
        }

        if (parseFloat(usdcBalance) < parseFloat(tier.price)) {
            toast.error("Insufficient USDC balance. Add funds via your wallet to continue.");
            return;
        }

        setSelectedTier(tier);
        setIsPurchaseModalOpen(true);
    };

    // Execute Purchase Transaction
    const executePurchase = () => {
        if (!selectedTier || !address) return;

        if (!client) {
            toast.error("Wallet not ready. Please try again in a moment.");
            return;
        }

        if (!email) {
            toast.error("Please enter your email address");
            return;
        }

        const chainKey = chain?.id === 8453 ? "base" : null;
        const usdcAddress = chainKey ? getUsdcTokenContract(chainKey).address : null;
        if (!usdcAddress) {
            toast.error("USDC is not supported on this network. Please switch to Base.");
            return;
        }

        // 1. Prepare Approval Data
        const approvalData = encodeFunctionData({
            abi: erc20Abi,
            functionName: "approve",
            args: [
                selectedTier.address as `0x${string}`,
                parseUnits(selectedTier.price, selectedTier.decimals),
            ],
        });

        // 2. Prepare Purchase Data
        // Using default/placeholder values found in typical Unlock integrations, adjusted for required email metadata
        const purchaseData = encodeFunctionData({
            abi: unlockAbiJson.abi as Abi,
            functionName: "purchase",
            args: [
                [parseUnits(selectedTier.price, selectedTier.decimals)], // values (often ignored for ERC20 locks but passed for consistency)
                [address], // recipients
                [referrer], // referrers
                [address], // keyManagers
                [encodeAbiParameters([{ type: "string", name: "email" }], [email])], // data (email metadata)
            ],
        });

        // 3. Send Batched User Operation
        sendUserOperation({
            uo: [
                {
                    target: usdcAddress as `0x${string}`,
                    data: appendBuilderCode(approvalData),
                    value: 0n,
                },
                {
                    target: selectedTier.address as `0x${string}`,
                    data: appendBuilderCode(purchaseData),
                    value: 0n,
                },
            ],
        });
    };

    return (
        <div className="space-y-6 animate-in fade-in zoom-in duration-300">
            {/* Header / Balance Card */}
            <MembershipCard className="bg-gradient-to-br from-background to-secondary/20">
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-lg font-semibold">Your Balance</h2>
                        <p className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-blue-600">
                            {isBalanceLoading ? (
                                <span className="text-muted-foreground">—</span>
                            ) : (
                                <>${Number.isFinite(parseFloat(usdcBalance)) ? parseFloat(usdcBalance).toFixed(2) : "0.00"} <span className="text-sm text-muted-foreground font-normal">USD (paid in USDC)</span></>
                            )}
                        </p>
                    </div>
                </div>
            </MembershipCard>

            {/* Tiers Grid */}
            <div className="grid gap-4">
                {tiers.map((tier) => (
                    <MembershipCard
                        key={tier.name}
                        className={`relative border-2 ${tier.recommended ? "border-primary shadow-md" : "border-transparent"}`}
                    >
                        {tier.recommended && (
                            <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-bl-lg">
                                Recommended
                            </div>
                        )}
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="text-xl font-bold">{tier.name}</h3>
                                <p className="text-2xl font-bold mt-1">
                                    ${tier.price} <span className="text-sm font-normal text-muted-foreground">{tier.periodLabel}</span>
                                </p>
                            </div>
                            <div className="bg-secondary/50 p-2 rounded-full">
                                <MembershipIcon name="star" className="text-primary" />
                            </div>
                        </div>

                        <ul className="space-y-2 mb-6">
                            {tier.features.map((feature, idx) => (
                                <li key={idx} className="flex items-center text-sm text-muted-foreground">
                                    <MembershipIcon name="check" size="sm" className="mr-2 text-green-500" />
                                    {feature}
                                </li>
                            ))}
                        </ul>

                        <MembershipButton
                            className="w-full"
                            variant={tier.recommended ? "primary" : "secondary"}
                            onClick={() => handlePurchase(tier)}
                            disabled={!canPurchase}
                        >
                            Purchase Membership
                        </MembershipButton>
                    </MembershipCard>
                ))}
            </div>

            {/* Purchase Modal (Simplified as inline overlay for now) */}
            {isPurchaseModalOpen && selectedTier && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-background rounded-xl max-w-md w-full p-6 shadow-2xl border border-border animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold">Confirm Purchase</h3>
                            <button
                                type="button"
                                onClick={() => setIsPurchaseModalOpen(false)}
                                className="text-muted-foreground hover:text-foreground"
                                aria-label="Close"
                            >
                                <MembershipIcon name="x" />
                            </button>
                        </div>

                        <div className="space-y-4 mb-6">
                            <div className="bg-secondary/30 p-4 rounded-lg">
                                <div className="flex justify-between mb-2">
                                    <span className="text-muted-foreground">Item</span>
                                    <span className="font-medium">{selectedTier.name} Membership</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Price</span>
                                    <span className="font-medium">${selectedTier.price} USD (paid in USDC)</span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1.5">Email Address</label>
                                <input
                                    type="email"
                                    className="w-full bg-input border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                    placeholder="name@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                    Required for membership access and receipts.
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <MembershipButton
                                variant="outline"
                                className="flex-1"
                                onClick={() => setIsPurchaseModalOpen(false)}
                            >
                                Cancel
                            </MembershipButton>
                            <MembershipButton
                                className="flex-1"
                                onClick={executePurchase}
                                disabled={isSendingUserOperation}
                            >
                                {isSendingUserOperation ? "Processing..." : "Confirm Purchase"}
                            </MembershipButton>
                        </div>
                    </div>
                </div>
            )}

            {/* Footer / Links */}
            <div className="text-center">
                <button
                    onClick={() => setActiveTab("features")}
                    className="text-sm text-muted-foreground hover:text-primary underline transition-colors"
                >
                    View detailed feature comparison
                </button>
            </div>
        </div>
    );
}
