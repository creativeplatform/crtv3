"use client";

import { useState } from "react";
import { useAuthModal, useUser } from "@/lib/wallet/react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

/**
 * LoginWithEthereumButton
 * UI component for Account Kit authentication.
 * Uses Account Kit's built-in authentication modal.
 */
export function LoginWithEthereumButton() {
  const { openAuthModal } = useAuthModal();
  const user = useUser();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    try {
      setIsLoading(true);
      openAuthModal();
    } catch (error) {
      toast.error(
        `Authentication failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <Button
        onClick={handleLogin}
        disabled={isLoading || !!user}
        className="px-4 py-2 bg-black text-white rounded hover:bg-gray-800 disabled:opacity-50"
      >
        {isLoading
          ? "Connecting..."
          : user
          ? "Connected"
          : "Connect with Account Kit"}
      </Button>
      {user && (
        <div className="mt-2 text-green-600 text-sm">
          Connected as {user.address}
        </div>
      )}
    </div>
  );
}
