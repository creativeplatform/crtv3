"use client";

import { useEffect, useRef } from "react";
import { useAuthError } from "@/lib/wallet/react";
import { toast } from "sonner";
import { formatAccountKitAuthError } from "@/lib/auth/format-account-kit-auth-error";

/**
 * Surfaces Account Kit auth modal errors (OTP, social, passkey) via toast.
 */
export function AuthErrorMonitor() {
  const authError = useAuthError();
  const lastMessageRef = useRef<string | null>(null);

  useEffect(() => {
    if (!authError) {
      lastMessageRef.current = null;
      return;
    }

    const message = formatAccountKitAuthError(authError);
    if (lastMessageRef.current === message) return;

    lastMessageRef.current = message;
    toast.error(message);
  }, [authError]);

  return null;
}
