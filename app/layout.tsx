import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import { Providers } from "./providers";
import Navbar from "@/components/Navbar";
import { cn } from "@/lib/utils/utils";
import { Toaster } from "@/components/ui/toaster";
import Footer from "@/components/Footer";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Analytics } from "@vercel/analytics/next";
import { LayoutClientChunks } from "@/components/LayoutClientChunks";
import { CreativeGuideChat } from "@/components/agent/CreativeGuideChat";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  preload: false,
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
  const headersList = await headers();
  const isEmbedRoute = headersList.get("x-crtv-embed-route") === "1";

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#000000" />
        <link
          rel="apple-touch-icon"
          href="/icons/CreativeTV_blur-192x192.png"
        />
        <link rel="icon" href="/favicon.ico" sizes="any" />
      </head>
      <body
        className={cn(
          inter.className,
          "min-h-screen bg-background antialiased"
        )}
        suppressHydrationWarning
      >
        <div id="alchemy-signer-iframe-container" style={{ display: "none" }} />
        <LayoutClientChunks />
        <Providers>
          <ErrorBoundary>
            {!isEmbedRoute ? <Navbar /> : null}
            <div className="min-h-screen flex flex-col">
              <main className="flex-1">{children}</main>
              {!isEmbedRoute ? <Footer /> : null}
            </div>
          </ErrorBoundary>
          <CreativeGuideChat />
        </Providers>
        <Toaster />
        <Analytics />
      </body>
    </html>
  );
}
