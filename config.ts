import {
  createConfig,
  type AlchemyAccountsUIConfig,
  type CreateConfigProps,
} from "@account-kit/react";
import { alchemy, base } from "@account-kit/infra";
import { http } from "viem";
import { QueryClient } from "@tanstack/react-query";
import { modularAccountFactoryAddresses } from "./lib/utils/modularAccount";
import { getStoryChain } from "./lib/sdk/story/chains";
import { getLensChain } from "./lib/sdk/lens/chains";
import { SITE_TOPIC_LOGO } from "./context/context";
import Image from "next/image";
import React from "react";

// Define the chains we want to support (Base + Story + Lens for client-side signing)
const storyChain = getStoryChain();
export const lensChain = getLensChain();
export const chains = [base, storyChain, lensChain];

// Default chain for initial connection
const defaultChain = base;

// Create transport
const transport = alchemy({
  apiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY as string,
});

// Custom storage implementation with 30-day expiration to prevent auto-logout
// Must be a function that returns the storage object (CreateStorageFn)
const customStorage = (config?: { sessionLength?: number; domain?: string }) => ({
  getItem: (key: string) => {
    if (typeof document === "undefined") return null;
    const match = document.cookie.match(new RegExp(`(^| )${key}=([^;]+)`));
    return match ? decodeURIComponent(match[2]) : null;
  },
  setItem: (key: string, value: string) => {
    if (typeof document === "undefined") return;
    // NOTE:
    // On http://localhost, cookies with the `Secure` attribute are ignored by the browser.
    // Account Kit session storage relies on cookies, so in local dev we must omit `Secure`.
    const isHttps =
      typeof window !== "undefined" && window.location?.protocol === "https:";
    // Set cookie with 30-day expiration (2592000 seconds)
    // SameSite=Lax is standard for auth cookies
    // Path=/ ensures it works across the entire site
    document.cookie = `${key}=${encodeURIComponent(value)}; max-age=2592000; path=/; SameSite=Lax${isHttps ? "; Secure" : ""
      }`;
  },
  removeItem: (key: string) => {
    if (typeof document === "undefined") return;
    const isHttps =
      typeof window !== "undefined" && window.location?.protocol === "https:";
    document.cookie = `${key}=; max-age=0; path=/; SameSite=Lax${isHttps ? "; Secure" : ""
      }`;
  },
  clear: () => {
    if (typeof document === "undefined") return;
    const isHttps =
      typeof window !== "undefined" && window.location?.protocol === "https:";
    const cookies = document.cookie.split(";");
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i];
      const eqPos = cookie.indexOf("=");
      const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie;
      document.cookie = `${name}=; max-age=0; path=/; SameSite=Lax${isHttps ? "; Secure" : ""
        }`;
    }
  },
  length: 0, // Placeholder
  key: (index: number) => null, // Placeholder
});

// Create query client with optimized settings for memory management
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Reduce memory usage by limiting cache time in development
      gcTime: 1000 * 60 * 5, // 5 minutes (previously cacheTime)
      staleTime: 1000 * 60, // 1 minute
      refetchOnWindowFocus: false, // Reduce unnecessary refetches
      retry: (failureCount, error) => {
        // Don't retry on abort errors
        if (error instanceof Error && error.name === 'AbortError') {
          return false;
        }
        // Limit retries in development
        return failureCount < 1;
      },
    },
    mutations: {
      retry: (failureCount, error) => {
        // Don't retry mutations on abort errors
        if (error instanceof Error && error.name === 'AbortError') {
          return false;
        }
        return failureCount < 1;
      },
    },
  },
});

const uiConfig: AlchemyAccountsUIConfig = {
  illustrationStyle: "linear",
  auth: {
    sections: [
      [{ type: "email", emailMode: "otp" }, { type: "passkey" }],
      [
        { type: "social", authProviderId: "google", mode: "popup" },
        { type: "social", authProviderId: "facebook", mode: "popup" },
        { type: "social", authProviderId: "twitch", mode: "popup" },
      ],
    ],
    addPasskeyOnSignup: true,
    header: React.createElement(Image, {
      src: SITE_TOPIC_LOGO,
      alt: "Site Logo",
      width: 80,
      height: 80,
    }),
  },
  supportUrl: process.env.NEXT_PUBLIC_SUPPORT_URL,
};

// Transport for Story Protocol (RPC only; client-side signing uses this chain)
const storyTransport = http(storyChain.rpcUrls.default.http[0] as string);
const lensTransport = http(lensChain.rpcUrls.default.http[0] as string);

// Create the Account Kit config
export const config = createConfig(
  {
    transport,
    chain: defaultChain,
    chains: [
      { chain: base, transport },
      { chain: storyChain, transport: storyTransport },
      { chain: lensChain, transport: lensTransport },
    ],
    ssr: true,
    enablePopupOauth: true,
    // Configure persistent sessions
    sessionConfig: {
      expirationTimeMs: 1000 * 60 * 60 * 24 * 30, // 30 days
      storage: customStorage(),
    },
    accountConfig: {
      type: "ModularAccountV2",
      accountParams: {
        mode: "7702", // Use EIP-7702 mode for Alchemy swap compatibility
        factoryAddresses: modularAccountFactoryAddresses,
      },
      gasManagerConfig: {
        policyId: process.env.NEXT_PUBLIC_ALCHEMY_PAYMASTER_POLICY_ID,
        sponsorUserOperations: false,
      },
    },
  } as CreateConfigProps,
  uiConfig
);
