"use client";
import "@/lib/utils/suppressDevWarnings";
import "@/lib/utils/xmtp/wasm-patch";
// Migration SDK styles use Tailwind v4 @layer base, incompatible with our Tailwind v3
// PostCSS setup. Modal remains functional without the stylesheet.
import { queryClient } from "@/config";
import { PrivyProvider } from "@privy-io/react-auth";
import { MigrationProvider } from "@privy-io/alchemy-migration";
import { alchemyMigrationConfig } from "@/lib/sdk/wallet/migration-config";
import { getPrivyConfig } from "@/lib/wallet/privy-config";
import { WalletChainProvider } from "@/lib/wallet/chain-context";
import { WalletClientProvider } from "@/lib/wallet/wallet-context";
import { AuthErrorProvider } from "@/lib/wallet/auth-error-context";
import { QueryClientProvider } from "@tanstack/react-query";
import { PropsWithChildren, Suspense, useEffect, useState } from "react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { VideoProvider } from "../context/VideoContext";
import { HeliaProvider } from "../context/HeliaContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ApolloNextAppProvider } from "@apollo/client-integration-nextjs";
import { makeClient } from "./apolloWrapper";
import { RadixProvider } from "@/components/ui/radix-provider";
import { cleanupExistingIframes } from "@/components/IframeCleanup";
import { WalletReadyGuard } from "@/components/auth/WalletReadyGuard";
import { AuthErrorMonitor } from "@/components/auth/AuthErrorMonitor";
import { OrbSessionProvider } from "@/context/OrbSessionContext";
import { OrbLoginModal } from "@/components/auth/OrbLoginModal";
import { OrbLinkingOverlay } from "@/components/auth/OrbLinkingOverlay";
import NoSSR from "@/components/NoSSR";
import { MembershipProvider } from "@/lib/context/MembershipContext";

function ErrorFallback({ error }: { error: Error }) {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h2 className="text-lg font-semibold">Something went wrong</h2>
        <p className="mt-2 text-sm text-gray-500">{error.message}</p>
      </div>
    </div>
  );
}

export const Providers = (props: PropsWithChildren) => {
  const [isReady, setIsReady] = useState(false);
  const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const privyClientId = process.env.NEXT_PUBLIC_PRIVY_CLIENT_ID;

  useEffect(() => {
    cleanupExistingIframes();
    setIsReady(true);
  }, []);

  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        Loading...
      </div>
    );
  }

  if (!privyAppId) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Missing NEXT_PUBLIC_PRIVY_APP_ID. Configure Privy in your environment to enable wallet auth.
        </p>
      </div>
    );
  }

  return (
    <ErrorBoundary fallback={(error) => <ErrorFallback error={error} />}>
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center">
            Loading...
          </div>
        }
      >
        <QueryClientProvider client={queryClient}>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <PrivyProvider appId={privyAppId} config={getPrivyConfig()}>
              <AuthErrorProvider>
                <MigrationProvider
                  alchemyConfig={alchemyMigrationConfig}
                  privyAppId={privyAppId}
                  privyClientId={privyClientId}
                  showDebugButton={process.env.NODE_ENV === "development"}
                >
                  <WalletChainProvider>
                    <WalletClientProvider>
                      <ApolloNextAppProvider makeClient={makeClient}>
                        <NoSSR>
                          <RadixProvider>
                            <HeliaProvider>
                              <VideoProvider>
                                <MembershipProvider>
                                  <WalletReadyGuard>
                                    <AuthErrorMonitor />
                                    <OrbSessionProvider>
                                      {props.children}
                                      <OrbLoginModal />
                                      <OrbLinkingOverlay />
                                      <Toaster position="top-right" richColors />
                                    </OrbSessionProvider>
                                  </WalletReadyGuard>
                                </MembershipProvider>
                              </VideoProvider>
                            </HeliaProvider>
                          </RadixProvider>
                        </NoSSR>
                      </ApolloNextAppProvider>
                    </WalletClientProvider>
                  </WalletChainProvider>
                </MigrationProvider>
              </AuthErrorProvider>
            </PrivyProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </Suspense>
    </ErrorBoundary>
  );
};
