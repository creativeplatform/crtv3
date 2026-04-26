import { config } from "@/config";
import { cookieToInitialState } from "@account-kit/core";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import { Providers } from "./providers";
import Navbar from "@/components/Navbar";
import { Tour } from '@/components/Tour/Tour';
import { cn } from "@/lib/utils/utils";
import { Toaster } from "@/components/ui/toaster";
import Footer from "@/components/Footer";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Analytics } from "@vercel/analytics/next";
import Script from "next/script";
import { LayoutClientChunks } from "@/components/LayoutClientChunks";

const inter = Inter({
  subsets: ["latin"],
  display: 'swap',
  preload: true,
  adjustFontFallback: true,
});

export const metadata: Metadata = {
  metadataBase: new URL("https://tv.creativeplatform.xyz"),
  title: "Creative TV",
  description: "The Way Content Should Be.",
  openGraph: {
    title: "Creative TV",
    description: "The Way Content Should Be.",
    siteName: "Creative TV",
    url: "https://tv.creativeplatform.xyz",
    images: [
      {
        url: "/images/Creative_TV_Logo.png",
        width: 500,
        height: 500,
        alt: "Creative TV Logo",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Creative TV",
    description: "The Way Content Should Be.",
    images: ["/Creative_TV.png"],
  },
  other: {
    ...(process.env.NEXT_PUBLIC_BASE_APP_ID && { "base:app_id": process.env.NEXT_PUBLIC_BASE_APP_ID }),
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Persist state across pages
  const headersList = await headers();
  const initialState = cookieToInitialState(
    config,
    headersList.get("cookie") ?? undefined
  );

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#000000" />
        <link
          rel="apple-touch-icon"
          href="/icons/CreativeTV_blur-192x192.png"
        />
        {/* Default favicon */}
        <link rel="icon" href="/favicon.ico" sizes="any" />
        {/* Optional: SVG or PNG favicons */}
        {/* <link rel="icon" type="image/svg+xml" href="/favicon.svg" /> */}
        {/* <link rel="icon" type="image/png" href="/favicon.png" /> */}
      </head>
      <body
        className={cn(
          inter.className,
          "min-h-screen bg-background antialiased"
        )}
        suppressHydrationWarning
      >
        <div id="alchemy-signer-iframe-container" style={{ display: "none" }} />
        {/* Alchemy signer iframe container for modular account functionality */}
        <LayoutClientChunks />
        <Providers initialState={initialState}>
          <ErrorBoundary>
            <Tour />
            <Navbar />
            <div className="min-h-screen flex flex-col">
              <main className="flex-1">{children}</main>
              <Footer />
            </div>
          </ErrorBoundary>
        </Providers>
        <Toaster />
        <Analytics />
        {/* HypeLab SDK: required for @hypelab/sdk-react Banner/Native. Property slug: 33e2e4fa10 */}
        <Script
          id="hypelab-sdk"
          src="https://api.hypelab.com/v1/scripts/sdk.js"
          strategy="afterInteractive"
          data-property-slug="33e2e4fa10"
        />
      </body>
    </html>
  );
}
