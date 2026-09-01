"use client";

import { useState, useEffect } from "react";
import {
  useAuthModal,
  useUser,
  useSmartAccountClient,
} from "@/lib/wallet/react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { logger } from '@/lib/utils/logger';


interface LoginButtonProps {
  className?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg";
}

export function LoginButton({
  className,
  variant = "default",
  size = "default",
}: LoginButtonProps) {
  const { openAuthModal } = useAuthModal();
  const user = useUser();
  const { client: smartAccountClient } = useSmartAccountClient({});
  const [isDeploying, setIsDeploying] = useState(false);

  // Check if the smart account needs deployment
  useEffect(() => {
    async function checkDeployment() {
      if (!smartAccountClient?.account) return;
      try {
        const code = await smartAccountClient.transport.request({
          method: "eth_getCode",
          params: [smartAccountClient.account.address],
        });
        setIsDeploying(code === "0x");
      } catch (error) {
        logger.error("Error checking deployment:", error);
      }
    }
    checkDeployment();
  }, [smartAccountClient]);

  // Reset states when user logs out
  useEffect(() => {
    if (!user) {
      setIsDeploying(false);
    }
  }, [user]);

  const handleLogin = () => {
    logger.debug('Opening auth modal...', { hasUser: !!user });
    try {
      openAuthModal();
    } catch (error) {
      logger.error('Failed to open auth modal:', error);
      toast.error('Failed to open login. Please refresh the page.');
    }
  };

  if (isDeploying) {
    return (
      <Button className={className} variant={variant} size={size} disabled>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Deploying Account...
      </Button>
    );
  }

  if (user) {
    return (
      <Button className={className} variant={variant} size={size} disabled>
        Connected
      </Button>
    );
  }

  return (
    <Button
      onClick={handleLogin}
      className={`bg-gradient-to-r from-blue-600 to-purple-600 
        hover:from-blue-700 hover:to-purple-700 text-white 
        transition-all duration-300 hover:shadow-lg ${className}`}
      variant={variant}
      size={size}
      id="connect-wallet-btn"
    >
      Get Started
    </Button>
  );
}
