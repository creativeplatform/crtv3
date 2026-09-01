"use client";

import { AlchemySwapWidget } from './AlchemySwapWidget';
import { DaiSwapButton } from './DaiSwapButton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { logger } from '@/lib/utils/logger';


export function SwapDemo() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Token Swap Demo</CardTitle>
          <CardDescription>
            Test Alchemy&apos;s swap functionality with ETH, USDC, and DAI on Base
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="full-widget" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="full-widget">Full Swap Widget</TabsTrigger>
              <TabsTrigger value="dai-swap">DAI Swap Button</TabsTrigger>
            </TabsList>
            
            <TabsContent value="full-widget" className="mt-6">
              <AlchemySwapWidget 
                onSwapSuccess={() => {
                  logger.debug('Full widget swap completed!');
                }}
              />
            </TabsContent>
            
            <TabsContent value="dai-swap" className="mt-6">
              <DaiSwapButton 
                onSwapSuccess={() => {
                  logger.debug('DAI swap completed!');
                }}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Features</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="text-sm">
              <strong>✅ Supported Tokens:</strong> ETH, USDC, USDS, DAI, GHO on Base
            </div>
            <div className="text-sm">
              <strong>✅ Gasless Swaps:</strong> Paymaster integration for sponsored gas
            </div>
            <div className="text-sm">
              <strong>✅ Smart Wallet Integration:</strong> Uses Account Kit for seamless UX
            </div>
            <div className="text-sm">
              <strong>✅ Real-time Quotes:</strong> Live pricing from Alchemy&apos;s swap API
            </div>
            <div className="text-sm">
              <strong>✅ Transaction Tracking:</strong> Real-time status updates
            </div>
            <div className="text-sm">
              <strong>✅ Error Handling:</strong> Comprehensive error messages and recovery
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default SwapDemo;
