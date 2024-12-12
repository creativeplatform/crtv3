'use server';

import { NextRequest, NextResponse } from 'next/server';

import { getContract } from 'thirdweb';
import { balanceOf as balanceOfERC1155 } from "thirdweb/extensions/erc1155";

import { generateAccessKey, validateAccessKey } from '@app/lib/access-key';
import { getJwtContext } from '@app/api/auth/thirdweb/authentication';
import { defineChain } from 'thirdweb';
import { createThirdwebClient } from 'thirdweb';

export interface WebhookPayload {
  accessKey: string;
  context: WebhookContext;
  timestamp: number;
}

export interface WebhookContext {
  creatorAddress: string;
  tokenId: string;
  contractAddress: string;
  chain: number;
}

export async function POST(request: NextRequest) {
  try {
    const payload: WebhookPayload = await request.json();

    console.log({ payload });

    if (
      !payload.accessKey 
      || !payload.context.creatorAddress 
      || !payload.context.tokenId
      || !payload.context.contractAddress
      || !payload.context.chain
      || !payload.timestamp
    ) {
      return NextResponse.json({ 
        allowed: false,
        message: 'Bad request, missing required fields' 
      }, { status: 400 });
    }

    // Implement custom access control logic here
    const isAccessAllowed = await validateAccess(payload);

    console.log({ isAccessAllowed });

    if (isAccessAllowed) {
      return NextResponse.json({ 
        allowed: true,
        message: 'Access granted' 
      }, { status: 200 });
    } else {
      return NextResponse.json({ 
        allowed: false,
        message: 'Access denied' 
      }, { status: 403 });
    }
  } catch (error) {
    console.error('Access control error:', error);
    return NextResponse.json({ 
      allowed: false,
      message: 'Internal server error' 
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const address = request.nextUrl.searchParams.get("address") as string;
    const creatorAddress = request.nextUrl.searchParams.get("creatorAddress") as string;
    const tokenId = request.nextUrl.searchParams.get("tokenId") as string;
    const contractAddress = request.nextUrl.searchParams.get("contractAddress") as string;
    const chain = parseInt(request.nextUrl.searchParams.get("chain") as string);

    console.log({ 
      address, 
      creatorAddress,
      tokenId,
      contractAddress,
      chain
    });

    if (!address /* || !context */) {
      return NextResponse.json({ 
        allowed: false,
        message: 'Bad request, missing required fields' 
      }, { status: 400 });
    }

    const accessKey = generateAccessKey(
      address, 
      {
        creatorAddress,
        tokenId,
        contractAddress,
        chain
      }
    );

    console.log({ accessKey });

    if (accessKey) {
      return NextResponse.json({ 
        allowed: true,
        accessKey: accessKey
      }, { status: 200 });
    } else {
      return NextResponse.json({ 
        allowed: false,
        message: 'Failed to generate access key.'
      }, { status: 400 });
    }
  } catch (error) {
    console.error('Generate access key error:', error);
    return NextResponse.json({ 
      allowed: false,
      message: 'Internal server error' 
    }, { status: 500 });
  }
}

async function validateAccess(payload: WebhookPayload): Promise<boolean> {
  const { accessKey, context, timestamp } = payload;

  const { address } = await getJwtContext();

  console.log({ address });

  // 1. Validate WebhookContext
  if (
    !address 
    || !context.creatorAddress
    || !context.tokenId 
    || !context.contractAddress 
    || !context.chain
  ) {
    console.error({ address, context });
    return false;
  }
  
  // 2. Validate access key
  const isAccessKeyValid = validateAccessKey(accessKey, address, context);
  console.log({ isAccessKeyValid });
  if (!isAccessKeyValid) {
    return false;
  }

  // 3. Check user-specific conditions
  const userHasToken = await checkUserTokenBalances(address, context);
  console.log({ userHasToken });
  if (!userHasToken) {
    return false;
  }

  // 4. Asset or stream-specific checks
  // const isAssetAccessible = await checkAssetAccessibility(context);
  // console.log({ isAssetAccessible });
  // if (!isAssetAccessible) {
  //   return false;
  // }

  return true;
}

async function checkUserTokenBalances(address: string, context: WebhookContext): Promise<boolean> {
  try {
    const clientId = process.env.NEXT_PUBLIC_TEMPLATE_CLIENT_ID as string;

    if (!clientId) {
      throw new Error('No client ID provided');
    }
    
    const client = createThirdwebClient({
      clientId: clientId,
    });

    const videoTokenContract = getContract({
      address: context.contractAddress,
      chain: defineChain(context.chain),
      client,
    });

    const videoTokenBalance = await balanceOfERC1155({
      contract: videoTokenContract,
      tokenId: BigInt(context.tokenId),
      owner: address,
    });

    console.log({ videoTokenBalance });

    return videoTokenBalance > 0n;
  } catch (error) {
    console.error('Error checking token balances...', error);
    return false; 
  }
}

async function checkAssetAccessibility(context: WebhookContext): Promise<boolean> {
  // Implement actual asset accessibility checking logic
  // For example, check if asset is published or not restricted
  return true;
}