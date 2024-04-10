import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThirdwebProvider } from "@/app/thirdweb";
import { TokenGateProvider } from 'collabland-tokengate-react-context';
import { Providers } from "./providers";

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
        <Providers>
          <ThirdwebProvider>
            <TokenGateProvider>
              {children}
            </TokenGateProvider>
          </ThirdwebProvider>
        </Providers>
      </body>
    </html>
  );
}
