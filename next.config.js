/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'snapshotsplugin.s3.us-west-2.amazonaws.com',
      },
      {
        protocol: 'https',
        hostname: 'locksmith.unlock-protocol.com',
      },
      {
        protocol: 'https',
        hostname: 'obj-store.livepeer.cloud',
      },
      {
        protocol: 'https',
        hostname: 'storage.unlock-protocol.com',
      },
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
      },
      {
        protocol: 'https',
        hostname: 'ipfs.dweb.link',
      },
    ],
  },
};

module.exports = nextConfig;
