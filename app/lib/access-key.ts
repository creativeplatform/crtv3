import { WebhookContext } from '@app/api/livepeer/token-gate/route';

// Helper function to convert string to ArrayBuffer
function str2ab(str: string): ArrayBuffer {
  const buf = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    buf[i] = str.charCodeAt(i);
  }
  return buf.buffer;
}

// Helper function to convert ArrayBuffer to hex string
function ab2hex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Generate an access key for the given address and asset ID
export async function generateAccessKey(
  address: string,
  context: WebhookContext,
): Promise<string> {
  const secret = process.env.ACCESS_KEY_SECRET as string;

  if (!secret) {
    throw new Error('No secret provided');
  }

  const payload = JSON.stringify({
    address,
    context,
  });

  // Use Web Crypto API for HMAC
  const key = await crypto.subtle.importKey(
    'raw',
    str2ab(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign('HMAC', key, str2ab(payload));

  return ab2hex(signature);
}

// Validate the generated access key
export async function validateAccessKey(
  accessKey: string,
  address: string,
  context: WebhookContext,
): Promise<boolean> {
  const expectedKey = await generateAccessKey(address, context);
  return accessKey === expectedKey;
}
