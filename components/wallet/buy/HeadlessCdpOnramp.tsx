"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CreditCard, Smartphone, AlertCircle, CheckCircle2 } from "lucide-react";
import { useAccount, useSignMessage } from "@/lib/wallet/react";
import { toast } from "sonner";

export type HeadlessPaymentMethod =
  | "GUEST_CHECKOUT_APPLE_PAY"
  | "GUEST_CHECKOUT_GOOGLE_PAY";

interface HeadlessCdpOnrampProps {
  paymentMethod: HeadlessPaymentMethod;
  prefillEmail?: string;
  presetFiatAmount?: number;
  fiatCurrency?: string;
  asset?: string;
  network?: string;
  onSuccess?: () => void;
  onClose?: () => void;
}

interface OnrampOrderResponse {
  paymentLink?: string;
  orderId?: string;
  error?: string;
}

export function HeadlessCdpOnramp({
  paymentMethod,
  prefillEmail = "",
  presetFiatAmount = 10,
  fiatCurrency = "USD",
  asset = "USDC",
  network = "base",
  onSuccess,
  onClose,
}: HeadlessCdpOnrampProps) {
  const { address } = useAccount();
  const { signMessage } = useSignMessage();
  const [email, setEmail] = useState(prefillEmail);
  const [hasPrefilled, setHasPrefilled] = useState(false);
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState(presetFiatAmount.toString());
  const [loading, setLoading] = useState(false);
  const [paymentLink, setPaymentLink] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "success" | "error" | "cancelled">("idle");
  const [statusMessage, setStatusMessage] = useState("");

  // Keep email in sync if the prefilled value arrives after mount, but only once.
  useEffect(() => {
    if (prefillEmail && !hasPrefilled) {
      setEmail(prefillEmail);
      setHasPrefilled(true);
    }
  }, [prefillEmail, hasPrefilled]);

  const formattedPhone = useMemo(() => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 0) return "";
    if (digits.length > 6) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
    } else if (digits.length > 3) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    }
    return digits;
  }, [phone]);

  const signAuthMessage = useCallback(async () => {
    if (!address) throw new Error("Wallet not connected");
    const timestamp = Math.floor(Date.now() / 1000);
    const message = `Authorize Coinbase headless onramp order for address ${address} at ${timestamp}`;
    const signature = await signMessage({ message });
    return { message, signature };
  }, [address, signMessage]);

  const createOrder = useCallback(async () => {
    if (!address) {
      toast.error("Connect your wallet first");
      return;
    }
    const emailTrim = email.trim();
    const phoneDigits = phone.replace(/\D/g, "");
    if (!emailTrim || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) {
      toast.error("Enter a valid email");
      return;
    }
    if (phoneDigits.length !== 10) {
      toast.error("Enter a valid 10-digit US phone number");
      return;
    }
    const fiatAmount = parseFloat(amount);
    if (Number.isNaN(fiatAmount) || fiatAmount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }

    setLoading(true);
    try {
      const { message, signature } = await signAuthMessage();
      const res = await fetch("/api/coinbase/onramp/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address,
          email: emailTrim,
          phoneNumber: `+1${phoneDigits}`,
          fiatAmount,
          fiatCurrency: fiatCurrency.toUpperCase(),
          asset: asset.toUpperCase(),
          network,
          paymentMethod,
          message,
          signature,
        }),
      });
      const data: OnrampOrderResponse = await res.json();
      if (!res.ok || !data.paymentLink) {
        throw new Error(data.error || "Failed to create onramp order");
      }
      setPaymentLink(data.paymentLink);
      setOrderId(data.orderId || null);
      setStatus("idle");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setStatus("error");
      setStatusMessage(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [
    address,
    email,
    phone,
    amount,
    fiatCurrency,
    asset,
    network,
    paymentMethod,
    signAuthMessage,
  ]);

  useEffect(() => {
    if (!paymentLink) return;

    const handler = (event: MessageEvent) => {
      // Only trust messages from pay.coinbase.com
      if (event.origin !== "https://pay.coinbase.com") return;
      if (!event.data || typeof event.data !== "string") return;

      let payload: { eventName?: string; data?: { errorCode?: string; errorMessage?: string } } | undefined;
      try {
        payload = JSON.parse(event.data);
      } catch {
        return;
      }
      if (!payload?.eventName) return;

      switch (payload.eventName) {
        case "onramp_api.load_success":
          setStatusMessage("Payment ready");
          break;
        case "onramp_api.commit_success":
          setStatus("idle");
          setStatusMessage("Payment submitted — waiting for settlement");
          break;
        case "onramp_api.polling_success":
          setStatus("success");
          setStatusMessage("Purchase complete");
          toast.success("On-ramp purchase complete");
          onSuccess?.();
          break;
        case "onramp_api.polling_error":
        case "onramp_api.commit_error":
        case "onramp_api.load_error":
          setStatus("error");
          setStatusMessage(payload.data?.errorMessage || "Payment failed");
          toast.error(payload.data?.errorMessage || "Payment failed");
          break;
        case "onramp_api.cancel":
          setStatus("cancelled");
          setStatusMessage("Payment cancelled");
          break;
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [paymentLink, onSuccess]);

  if (status === "success") {
    return (
      <div className="space-y-4 text-center py-6">
        <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
        <h3 className="text-lg font-semibold">Purchase Complete</h3>
        <p className="text-sm text-muted-foreground">
          Your {asset} should arrive on {network} shortly.
        </p>
        {orderId && (
          <p className="text-xs text-muted-foreground font-mono break-all">
            Order: {orderId}
          </p>
        )}
        <Button onClick={onClose} className="w-full">Close</Button>
      </div>
    );
  }

  if (paymentLink) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border bg-background overflow-hidden">
          <iframe
            src={paymentLink}
            allow="payment"
            sandbox="allow-scripts allow-same-origin"
            referrerPolicy="no-referrer"
            title="Coinbase Onramp"
            className="w-full h-[420px] sm:h-[520px] border-0"
          />
        </div>
        {statusMessage && (
          <div className="text-xs text-center text-muted-foreground">{statusMessage}</div>
        )}
        {status === "error" && (
          <div className="flex items-start gap-2 rounded-md bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-600 dark:text-red-400">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}
        <Button
          variant="outline"
          onClick={() => {
            setPaymentLink(null);
            setStatus("idle");
            setStatusMessage("");
          }}
          className="w-full"
        >
          Back
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="onramp-email">Email</Label>
        <Input
          id="onramp-email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="onramp-phone">Phone Number (US)</Label>
        <Input
          id="onramp-phone"
          type="tel"
          placeholder="(555) 123-4567"
          value={formattedPhone}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
            setPhone(digits);
          }}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="onramp-amount">Amount ({fiatCurrency})</Label>
        <Input
          id="onramp-amount"
          type="number"
          min={1}
          step={1}
          placeholder="10"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>

      <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
        By purchasing, you agree to Coinbase’s
        {' '}
        <a href="https://www.coinbase.com/legal/guest-checkout/us" target="_blank" rel="noopener noreferrer" className="underline">Guest Checkout Terms</a>,
        {' '}
        <a href="https://www.coinbase.com/legal/user_agreement" target="_blank" rel="noopener noreferrer" className="underline">User Agreement</a>,
        {' '}
        and
        {' '}
        <a href="https://www.coinbase.com/legal/privacy" target="_blank" rel="noopener noreferrer" className="underline">Privacy Policy</a>.
      </div>

      <Button onClick={createOrder} disabled={loading || !address} className="w-full">
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Creating order...
          </>
        ) : (
          <>
            {paymentMethod === "GUEST_CHECKOUT_APPLE_PAY" ? (
              <CreditCard className="mr-2 h-4 w-4" />
            ) : (
              <Smartphone className="mr-2 h-4 w-4" />
            )}
            Pay with {paymentMethod === "GUEST_CHECKOUT_APPLE_PAY" ? "Apple Pay" : "Google Pay"}
          </>
        )}
      </Button>

      {status === "error" && statusMessage && (
        <div className="flex items-start gap-2 rounded-md bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-600 dark:text-red-400">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}
    </div>
  );
}
