"use client";

import { MeTokenPortfolio } from '@/components/wallet/balance/MeTokenPortfolio';
import { useUser } from '@/lib/wallet/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Wallet, TrendingUp, Plus, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function PortfolioPage() {
  const user = useUser();

  if (!user?.address) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-6 w-6" />
                Portfolio
              </CardTitle>
              <CardDescription>Connect your wallet to view your MeToken portfolio</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Wallet className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">
                  Please connect your wallet to view your MeToken holdings.
                </p>
                <Button asChild>
                  <Link href="/">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Go Home
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Wallet className="h-8 w-8" />
              My Portfolio
            </h1>
            <p className="text-muted-foreground mt-2">
              Manage your MeToken holdings and discover new creators
            </p>
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/explore">
                <TrendingUp className="h-4 w-4 mr-2" />
                Explore
              </Link>
            </Button>
            <Button asChild>
              <Link href="/profile">
                <Plus className="h-4 w-4 mr-2" />
                Create MeToken
              </Link>
            </Button>
          </div>
        </div>

        {/* Portfolio Component */}
        <MeTokenPortfolio />
        
        {/* Additional Info */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>About MeToken Holdings</CardTitle>
            <CardDescription>
              Learn how MeToken holdings work and how to maximize your portfolio
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold mb-2">What are MeToken Holdings?</h3>
                <p className="text-sm text-muted-foreground">
                  MeToken holdings represent your investment in creators&apos; personal tokens. 
                  These tokens can appreciate in value as creators grow their audience and success.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Portfolio Benefits</h3>
                <p className="text-sm text-muted-foreground">
                  Track your investments, view creator profiles, and discover new opportunities 
                  in the MeToken ecosystem.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
