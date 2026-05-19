"use client";
import "@/lib/utils/suppressDevWarnings";
import "@/lib/utils/xmtp/wasm-patch";
import { config, queryClient } from "@/config";
import { AlchemyAccountProvider } from "@account-kit/react";
import { AlchemyClientState } from "@account-kit/core";
import { QueryClientProvider } from "@tanstack/react-query";
import { PropsWithChildren, Suspense, useEffect, useState } from "react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { VideoProvider } from "../context/VideoContext";
import { TourProvider } from "../context/TourContext";
import { HeliaProvider } from "../context/HeliaContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ApolloNextAppProvider } from "@apollo/client-integration-nextjs";
import { makeClient } from "./apolloWrapper";
import { RadixProvider } from "@/components/ui/radix-provider";
import { cleanupExistingIframes } from "@/components/IframeCleanup";
import { MembershipGuard } from "@/components/auth/MembershipGuard";
import { AccountKitStoreGuard } from "@/components/auth/AccountKitStoreGuard";
import { OrbSessionProvider } from "@/context/OrbSessionContext";
import { OrbLoginModal } from "@/components/auth/OrbLoginModal";
import NoSSR from "@/components/NoSSR";

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

export const Providers = (
  props: PropsWithChildren<{ initialState?: AlchemyClientState }>
) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Only clean up DUPLICATE iframes, not the active one
    // This prevents breaking the signer connection while still handling hot-reload duplicates
    cleanupExistingIframes();
    setIsReady(true);
  }, []);

  // Don't render providers until ready
  // Note: We removed aggressive iframe cleanup to preserve the signer connection
  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        Loading...
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
            <ApolloNextAppProvider makeClient={makeClient}>
              <NoSSR>
                <AlchemyAccountProvider
                  config={config}
                  queryClient={queryClient}
                  initialState={props.initialState}
                >
                  <RadixProvider>
                    <HeliaProvider>
                      <TourProvider>
                        <VideoProvider>
                          <OrbSessionProvider>
                            <AccountKitStoreGuard>
                              <MembershipGuard>
                                {props.children}
                              </MembershipGuard>
                            </AccountKitStoreGuard>
                            <OrbLoginModal />
                            <Toaster position="top-right" richColors />
                          </OrbSessionProvider>
                        </VideoProvider>
                      </TourProvider>
                    </HeliaProvider>
                  </RadixProvider>
                </AlchemyAccountProvider>
              </NoSSR>
            </ApolloNextAppProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </Suspense>
    </ErrorBoundary>
  );
};
