import { StackClient } from '@stackso/js-core';
import { safeToBase64Url } from '@app/lib/utils/base64url';

// Initialize the client
export const stack = new StackClient({
  apiKey: process.env.NEXT_PUBLIC_STACK_API_KEY ?? '',
  pointSystemId: 2777,
});

// Helper function to ensure proper token format
export const ensureValidToken = (token: string | object): string => {
  if (!token) return '';

  // If it's already a string, return it as is
  if (typeof token === 'string') return token;

  // Handle object types
  if (typeof token === 'object') {
    // If it's a Thirdweb auth object, extract the address
    if ('address' in token) {
      return token.address as string;
    }

    // Use our safe base64url encoding utility
    return safeToBase64Url(token);
  }

  // For any other type, convert to string and encode
  return safeToBase64Url(token);
};

// Helper function to format address for Stack
export const formatAddress = (
  address: string | object | null | undefined,
): string => {
  if (!address) return '';

  if (typeof address === 'object') {
    // If it's a Thirdweb account object, extract the address
    if ('address' in address) {
      return address.address as string;
    }
    return '';
  }

  return address;
};

// Server actions for Stack operations
async function getLeaderboard(query: any) {
  'use server';
  try {
    return await stack.getLeaderboard({ query });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    throw new Error('Failed to fetch leaderboard data');
  }
}

async function getPoints(address: string) {
  'use server';
  try {
    const formattedAddress = formatAddress(address);
    return await stack.getPoints(formattedAddress);
  } catch (error) {
    console.error('Error fetching points:', error);
    throw new Error('Failed to fetch points');
  }
}

async function track(event: string, data: any) {
  'use server';
  try {
    return await stack.track(event, data);
  } catch (error) {
    console.error('Error tracking event:', error);
    throw new Error('Failed to track event');
  }
}

export const stackActions = {
  getLeaderboard,
  getPoints,
  track,
};
