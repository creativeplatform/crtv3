"use client";

import { useState, type ReactNode } from "react";
import { CreditCard, Smartphone, Wallet } from "lucide-react";
import { HeadlessCdpOnramp, type HeadlessPaymentMethod } from "./HeadlessCdpOnramp";
import CoinbaseFundButton from "./coinbase-fund-button";
import { cn } from "@/lib/utils";

type FundingMethod = "apple-pay" | "google-pay" | "coinbase";

interface FundingOptionsProps {
  presetFiatAmount?: number;
  fiatCurrency?: string;
  asset?: string;
  network?: string;
  prefillEmail?: string;
  onSuccess?: () => void;
  onClose?: () => void;
}

const METHODS: {
  id: FundingMethod;
  label: string;
  icon: ReactNode;
  description: string;
}[] = [
  {
    id: "apple-pay",
    label: "Apple Pay",
    icon: <CreditCard className="h-5 w-5" />,
    description: "Quick checkout with Apple Pay",
  },
  {
    id: "google-pay",
    label: "Google Pay",
    icon: <Smartphone className="h-5 w-5" />,
    description: "Quick checkout with Google Pay",
  },
  {
    id: "coinbase",
    label: "Coinbase",
    icon: <Wallet className="h-5 w-5" />,
    description: "Bank, debit card, or Coinbase balance",
  },
];

const METHOD_TO_HEADLESS: Record<"apple-pay" | "google-pay", HeadlessPaymentMethod> = {
  "apple-pay": "GUEST_CHECKOUT_APPLE_PAY",
  "google-pay": "GUEST_CHECKOUT_GOOGLE_PAY",
};

export function FundingOptions({
  presetFiatAmount = 10,
  fiatCurrency = "USD",
  asset = "USDC",
  network = "base",
  prefillEmail,
  onSuccess,
  onClose,
}: FundingOptionsProps) {
  const [method, setMethod] = useState<FundingMethod>("apple-pay");

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {METHODS.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMethod(m.id)}
            className={cn(
              "flex flex-col items-center justify-center gap-1 rounded-lg border p-3 text-sm transition-colors",
              method === m.id
                ? "border-primary bg-primary/5 text-primary"
                : "border-border bg-background hover:bg-muted"
            )}
          >
            {m.icon}
            <span className="font-medium">{m.label}</span>
            <span className="text-[10px] text-muted-foreground text-center">{m.description}</span>
          </button>
        ))}
      </div>

      {method === "coinbase" ? (
        <div className="space-y-3 rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">
            Buy crypto with your Coinbase account, bank transfer, or debit card.
            A secure Coinbase window will open so you can complete the purchase.
          </p>
          <CoinbaseFundButton
            onClose={onClose}
            presetAmount={presetFiatAmount}
            className="w-full"
          />
        </div>
      ) : (
        <HeadlessCdpOnramp
          paymentMethod={METHOD_TO_HEADLESS[method]}
          prefillEmail={prefillEmail}
          presetFiatAmount={presetFiatAmount}
          fiatCurrency={fiatCurrency}
          asset={asset}
          network={network}
          onSuccess={onSuccess}
          onClose={onClose}
        />
      )}
    </div>
  );
}
