import React from "react";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThirdwebProvider } from "../app/thirdweb";
import { TokenGateProvider } from 'collabland-tokengate-react-context';
import { Providers } from "./providers";
import { ReactQueryClientProvider } from '../../components/ReactQueryClientProvider'
import Layout from "../../components/Layout/layout"

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Creative TV",
  description: "The way content should be",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ReactQueryClientProvider>
          <Providers>
            <ThirdwebProvider>
              <TokenGateProvider>
                <Layout>
                {children}
                </Layout>
              </TokenGateProvider>
            </ThirdwebProvider>
          </Providers>
        </ReactQueryClientProvider>
      </body>
    </html>
  );
}
