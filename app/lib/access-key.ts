import { WebhookContext } from '@app/api/livepeer/token-gate/route';
import crypto from 'crypto';

// Generate an access key for the given address and asset ID
export function generateAccessKey(
  address: string,
  context: WebhookContext
): string {
  const secret = process.env.ACCESS_KEY_SECRET as string;
  // const timestamp = Date.now();
  
  if (!secret) {
    throw new Error("No secret provided");
  }

  const payload = JSON.stringify({
    address,
    context
  });

  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
}

// Validate the generated access key
export function validateAccessKey(
  accessKey: string, 
  address: string,
  context: WebhookContext
): boolean {
  // console.log({ msg: 'validateAccessKey()', accessKey, address, context });
  const regeneratedKey = generateAccessKey(address, context);
  // console.log({ msg: 'validateAccessKey()', regeneratedKey });
  return crypto.timingSafeEqual(
    new Uint8Array(Buffer.from(accessKey)), 
    new Uint8Array(Buffer.from(regeneratedKey))
  );
}