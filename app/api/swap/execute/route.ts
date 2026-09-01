import { NextRequest, NextResponse } from 'next/server';
import { checkBotIdDeep } from '@/lib/middleware/botIdGuard';
import { executeSwap } from '@/lib/sdk/alchemy/swap-client';
import { BASE_TOKENS, type TokenSymbol } from '@/lib/sdk/alchemy/swap-service';
import { serverLogger } from '@/lib/utils/logger';
import { rateLimiters } from '@/lib/middleware/rateLimit';

export async function POST(request: NextRequest) {
  const verification = await checkBotIdDeep();
  if (verification.isBot) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }
  const rl = await rateLimiters.strict(request);
  if (rl) return rl;

  try {
    // Handle JSON parsing errors
    let body;
    try {
      body = await request.json();
    } catch (jsonError) {
      serverLogger.error('Invalid JSON in request body:', jsonError);
      return NextResponse.json(
        { 
          error: 'Invalid JSON in request body',
          success: false
        },
        { status: 400 }
      );
    }
    
    const { fromToken, toToken, fromAmount, minimumToAmount } = body;

    serverLogger.debug('Swap request received:', { fromToken, toToken, fromAmount, minimumToAmount });

    // Validate required fields
    if (!fromToken || !toToken || !fromAmount) {
      return NextResponse.json(
        { error: 'Missing required fields: fromToken, toToken, fromAmount' },
        { status: 400 }
      );
    }

    // Validate token symbols
    const validTokens = Object.keys(BASE_TOKENS) as Array<keyof typeof BASE_TOKENS>;
    if (!validTokens.includes(fromToken) || !validTokens.includes(toToken)) {
      const invalidTokens = [];
      if (!validTokens.includes(fromToken)) invalidTokens.push(`fromToken: ${fromToken}`);
      if (!validTokens.includes(toToken)) invalidTokens.push(`toToken: ${toToken}`);
      
      return NextResponse.json(
        { 
          error: 'Invalid token symbols',
          invalidTokens,
          validTokens: validTokens,
          success: false
        },
        { status: 400 }
      );
    }
    
    // Validate amount is a positive number
    const fromAmountNum = parseFloat(fromAmount);
    if (isNaN(fromAmountNum) || fromAmountNum <= 0) {
      return NextResponse.json(
        { 
          error: 'Invalid fromAmount',
          details: 'fromAmount must be a positive number',
          success: false
        },
        { status: 400 }
      );
    }

    // Check environment variables
    const apiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
    const policyId = process.env.NEXT_PUBLIC_ALCHEMY_PAYMASTER_POLICY_ID;
    const privateKey = process.env.ALCHEMY_SWAP_PRIVATE_KEY;

    serverLogger.debug('Environment check:', {
      hasApiKey: !!apiKey,
      hasPolicyId: !!policyId,
      hasPrivateKey: !!privateKey,
      apiKeyPrefix: apiKey ? apiKey.slice(0, 10) + '...' : 'MISSING',
    });

    if (!apiKey) {
      serverLogger.error('Missing NEXT_PUBLIC_ALCHEMY_API_KEY');
      return NextResponse.json(
        { error: 'Alchemy API key not configured. Please set NEXT_PUBLIC_ALCHEMY_API_KEY environment variable.' },
        { status: 500 }
      );
    }

    if (!policyId) {
      serverLogger.error('Missing NEXT_PUBLIC_ALCHEMY_PAYMASTER_POLICY_ID');
      return NextResponse.json(
        { error: 'Alchemy paymaster policy ID not configured. Please set NEXT_PUBLIC_ALCHEMY_PAYMASTER_POLICY_ID environment variable.' },
        { status: 500 }
      );
    }

    if (!privateKey) {
      serverLogger.error('Missing ALCHEMY_SWAP_PRIVATE_KEY');
      return NextResponse.json(
        { error: 'Alchemy swap private key not configured. Please set ALCHEMY_SWAP_PRIVATE_KEY environment variable.' },
        { status: 500 }
      );
    }

    // Execute the swap
    serverLogger.debug('Executing swap with params:', {
      fromToken: BASE_TOKENS[fromToken as TokenSymbol],
      toToken: BASE_TOKENS[toToken as TokenSymbol],
      fromAmount,
      minimumToAmount,
    });

    const result = await executeSwap({
      fromToken: BASE_TOKENS[fromToken as TokenSymbol],
      toToken: BASE_TOKENS[toToken as TokenSymbol],
      fromAmount,
      minimumToAmount,
    });

    serverLogger.debug('Swap executed successfully:', result);

    return NextResponse.json({
      success: true,
      transactionHash: result.transactionHash,
    });

  } catch (error) {
    serverLogger.error('Swap execution error:', error);
    serverLogger.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    // Handle specific error types
    if (error instanceof Error) {
      // Check for network/connection errors
      if (error.message.includes('network') || error.message.includes('fetch') || error.message.includes('ECONNREFUSED')) {
        return NextResponse.json(
          { 
            error: 'Network error',
            details: 'Unable to connect to the swap service. Please check your network connection and try again.',
            success: false
          },
          { status: 503 }
        );
      }
      
      // Check for insufficient balance errors
      if (error.message.includes('insufficient') || error.message.includes('balance')) {
        return NextResponse.json(
          { 
            error: 'Insufficient balance',
            details: error.message,
            success: false
          },
          { status: 400 }
        );
      }
      
      // Check for transaction errors
      if (error.message.includes('transaction') || error.message.includes('revert')) {
        return NextResponse.json(
          { 
            error: 'Transaction failed',
            details: error.message,
            success: false
          },
          { status: 400 }
        );
      }
    }
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Swap execution failed',
        success: false,
        details: process.env.NODE_ENV === 'development' && error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
