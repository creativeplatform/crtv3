import type { LensAuthPluginConfig } from '@orbclub/modules/auth/lens';
import type { MediaPluginConfig } from '@orbclub/modules/media';
import type { QrAuthPluginConfig } from '@orbclub/modules/auth/qr';
import type { OrbLoginConfig } from '@orbclub/modules/auth';
import type { GroveUploadPluginConfig } from '@orbclub/modules/upload/grove';
import { getLensChainId } from '@/lib/sdk/lens/chains';

/** Resolved Orb/Lens auth + media config from app env (package does not read env). */
export function getOrbLoginConfig(): OrbLoginConfig {
  const qr: QrAuthPluginConfig = {};
  const lens: LensAuthPluginConfig = {};

  const graphqlUrl = process.env.NEXT_PUBLIC_LENS_GRAPHQL_URL?.trim();
  if (graphqlUrl) lens.graphqlUrl = graphqlUrl;

  const qrInit = process.env.NEXT_PUBLIC_ORB_QR_INIT_URL?.trim();
  const qrPoll = process.env.NEXT_PUBLIC_ORB_QR_POLL_URL?.trim();
  if (qrInit) qr.initUrl = qrInit;
  if (qrPoll) qr.pollUrl = qrPoll;

  return { qr, lens };
}

export function getOrbMediaConfig(): MediaPluginConfig {
  const ipfsGateway =
    process.env.NEXT_PUBLIC_IPFS_GATEWAY?.trim() || 'https://w3s.link/ipfs';
  return {
    ipfsGateway,
    imageGateway: process.env.NEXT_PUBLIC_ORB_MEDIA_GATEWAY?.trim() || ipfsGateway,
    lensGateway:
      process.env.NEXT_PUBLIC_ORB_LENS_GATEWAY?.trim() ||
      'https://api.grove.storage/ipfs',
    arweaveGateway:
      process.env.NEXT_PUBLIC_ORB_ARWEAVE_GATEWAY?.trim() ||
      'https://arweave.net',
    defaultThumbnailDimension: 768,
  };
}

export function getOrbGroveUploadConfig(): GroveUploadPluginConfig {
  return {
    apiUrl: process.env.NEXT_PUBLIC_GROVE_API_URL?.trim(),
    chainId: getLensChainId(),
  };
}
