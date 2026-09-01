import createPWA from "next-pwa";
import { withAxiom } from "next-axiom";
import { withBotId } from "botid/next/config";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

const withPWA = createPWA({
  dest: "public",
  disable: process.env.NODE_ENV === "development" || process.env.VERCEL === "1",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Optimize memory usage in development
  transpilePackages: ['@privy-io/react-auth', '@privy-io/alchemy-migration'],
  experimental: {
    // Reduce memory usage by optimizing compilation
    optimizePackageImports: ['@privy-io/react-auth', '@privy-io/alchemy-migration', '@apollo/client', 'lucide-react', 'framer-motion'],
  },
  // External packages that should not be processed by the bundler
  // Externalize thread-stream and pino packages on server to avoid bundling test files
  serverExternalPackages: ['thread-stream', 'pino', 'pino-pretty', 'node-datachannel'],
  // Webpack configuration for WebAssembly support
  webpack: (config, { isServer, webpack, dev }) => {
    // Enable async WebAssembly loading (required for XMTP WASM bindings)
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };

    // Configure resolve to ignore problematic patterns
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...config.resolve.alias,
      'node:stream': require.resolve('stream-browserify'),
      'stream': require.resolve('stream-browserify'),
    };

    // Replace node:stream with stream-browserify using plugin to ensure it catches all imports
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(
        /^node:stream$/,
        (resource) => {
          resource.request = require.resolve('stream-browserify');
        }
      )
    );
    // Prevent webpack from resolving test files and benchmarks
    config.resolve.modules = config.resolve.modules || ['node_modules'];

    // Add resolve plugins to filter out problematic files
    if (!config.resolve.plugins) {
      config.resolve.plugins = [];
    }

    // Tell webpack not to parse test files and other non-essential files
    config.module = config.module || {};
    config.module.noParse = config.module.noParse || [];
    // Add regex patterns for files that shouldn't be parsed
    if (Array.isArray(config.module.noParse)) {
      config.module.noParse.push(/node_modules\/thread-stream\/test/);
      config.module.noParse.push(/node_modules\/thread-stream\/.*\.test\./);
      config.module.noParse.push(/node_modules\/thread-stream\/.*\.spec\./);
      config.module.noParse.push(/node_modules\/thread-stream\/bench\.js/);
    }

    // Use IgnorePlugin with multiple patterns to catch all test file references
    // Pattern 1: Ignore test directory imports
    config.plugins.push(
      new webpack.IgnorePlugin({
        checkResource(resource, context) {
          return /^\.\/test\//.test(resource) && /thread-stream/.test(context || '');
        },
      })
    );

    // Pattern 2: Ignore all files in thread-stream/test directory
    config.plugins.push(
      new webpack.IgnorePlugin({
        checkResource(resource) {
          return /thread-stream[\/\\]test[\/\\]/.test(resource || '');
        },
      })
    );

    // Pattern 3: Ignore bench.js file
    config.plugins.push(
      new webpack.IgnorePlugin({
        checkResource(resource) {
          return /thread-stream[\/\\]bench\.js$/.test(resource || '');
        },
      })
    );

    // Pattern 4: Ignore test files by extension
    config.plugins.push(
      new webpack.IgnorePlugin({
        checkResource(resource) {
          return /thread-stream.*\.(test|spec)\.(js|mjs|ts)$/.test(resource || '');
        },
      })
    );

    // Use NormalModuleReplacementPlugin to replace problematic test file imports with empty module
    // This catches imports that reference test files directly
    const emptyModulePath = require.resolve('./lib/webpack/empty-module.cjs');

    // Privy optional peer deps (fiat onramp, Farcaster Solana mini-app). Creative TV is EVM-only.
    config.resolve.alias = {
      ...config.resolve.alias,
      '@stripe/crypto': emptyModulePath,
      '@farcaster/mini-app-solana': emptyModulePath,
    };

    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(
        /thread-stream[\/\\]test[\/\\].*\.(js|mjs|ts)$/,
        (resource) => {
          resource.request = emptyModulePath;
        }
      )
    );

    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(
        /thread-stream[\/\\]bench\.js$/,
        (resource) => {
          resource.request = emptyModulePath;
        }
      )
    );

    // viem/ox Tempo chain defs use dynamic requires — harmless in dev, very noisy in the terminal.
    config.ignoreWarnings = [
      ...(config.ignoreWarnings ?? []),
      { module: /virtualMasterPool\.js/ },
      { message: /Critical dependency: the request of a dependency is an expression/ },
    ];

    // Handle .wasm files as asset resources
    // Place them in static/media/ to match Next.js default behavior
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'asset/resource',
      generator: {
        filename: 'static/media/[name].[contenthash][ext]',
        publicPath: '/_next/static/media/',
      },
    });

    // Ensure proper public path resolution for WASM files
    // Ignore problematic network discovery packages that cause runtime errors in serverless
    config.resolve.alias = {
      ...config.resolve.alias,
      '@achingbrain/ssdp': false,
      '@libp2p/mdns': false,
    };

    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        'pino': false,
        'thread-stream': false,
        'pino-pretty': false,
        'lokijs': false,
        'encoding': false,
      };

      config.resolve.fallback = {
        ...config.resolve.fallback,
        'pino': false,
        'thread-stream': false,
        'pino-pretty': false,
        'lokijs': false,
        'encoding': false,
        'stream': require.resolve('stream-browserify'),
        'node:stream': require.resolve('stream-browserify'),
      };

      // Note: Webpack plugins may not work with Turbopack
      // The runtime patch in wasm-patch.ts should handle this
      // But we can try to add the plugin for non-Turbopack builds
      try {
        const WasmWorkerPlugin = require('./lib/webpack/wasm-worker-plugin.cjs');
        config.plugins.push(new WasmWorkerPlugin());
      } catch (e) {
        // Plugin not available or not needed (Turbopack mode)
        console.warn('WasmWorkerPlugin not loaded (may be using Turbopack):', e.message);
      }
    }

    // Exclude node server-side libraries from client bundle only (avoid mutating server externals)
    if (!isServer && Array.isArray(config.externals)) {
      config.externals.push("pino-pretty", "lokijs", "encoding");
    }

    // App Router uses mini-css-extract for CSS; if the plugin is missing, the loader throws.
    // This can happen with some config merge orders — ensure Next's plugin is present on the client.
    if (!isServer && Array.isArray(config.plugins)) {
      const hasNextCssPlugin = config.plugins.some((p) => p && p.__next_css_remove === true);
      if (!hasNextCssPlugin) {
        const NextMiniCssExtractPlugin = require('next/dist/build/webpack/plugins/mini-css-extract-plugin').default;
        config.plugins.push(
          new NextMiniCssExtractPlugin({
            filename: dev ? 'static/css/[name].css' : 'static/css/[contenthash].css',
            chunkFilename: dev ? 'static/css/[name].css' : 'static/css/[contenthash].css',
            ignoreOrder: true,
            insert: function (linkTag) {
              if (typeof _N_E_STYLE_LOAD === 'function') {
                var href = linkTag.href;
                var onload = linkTag.onload;
                var onerror = linkTag.onerror;
                _N_E_STYLE_LOAD(
                  href.indexOf(window.location.origin) === 0 ? new URL(href).pathname : href
                ).then(
                  function () {
                    if (onload) onload.call(linkTag, { type: 'load' });
                  },
                  function () {
                    if (onerror) onerror.call(linkTag, {});
                  }
                );
              } else {
                document.head.appendChild(linkTag);
              }
            },
          })
        );
      }
    }

    // Privy pulls optional Solana funding UI; Creative TV is EVM-only.
    // Keep @solana-program/* installable — IgnorePlugin left broken runtime requires.
    config.plugins.push(
      new webpack.IgnorePlugin({
        checkResource(resource) {
          return /FundSolWalletWithExternalSolanaWallet/.test(resource || "");
        },
      })
    );

    const alchemySolanaActionsStub = require.resolve('./lib/webpack/alchemy-solana-actions-stub.mjs');
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(
        /solanaSmartWalletActions\.js$/,
        (resource) => {
          if (/@alchemy[\\/]wallet-apis[\\/]dist[\\/]esm[\\/]client\.js$/.test(resource.contextInfo?.issuer || '')) {
            resource.request = alchemySolanaActionsStub;
          }
        }
      )
    );

    return config;
  },
  // Reduce unnecessary rebuilds
  onDemandEntries: {
    // period (in ms) where the server will keep pages in the buffer
    maxInactiveAge: 60 * 1000,
    // number of pages that should be kept simultaneously without being disposed
    pagesBufferLength: 2,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.ipfs.w3s.link",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "w3s.link",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*.ipfs.storacha.link",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "storacha.link",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "ipfs.io",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*.ipfs.dweb.link",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "dweb.link",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "4everland.io",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "nft.storage",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "gateway.pinata.cloud",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "gateway.lighthouse.storage",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*.lighthouse.storage",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*.googleapis.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "snapshotsplugin.s3.us-west-2.amazonaws.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*.livepeer.studio",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*.livepeer.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*.livepeercdn.studio",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*.livepeercdn.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "storage.unlock-protocol.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "api.grove.storage",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "cloudflare-ipfs.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "gateway.ipfscdn.io",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "i.postimg.cc",
        pathname: "/**",
      },
    ],
  },
  async headers() {
    // Privy CSP requirements: https://docs.privy.io/security/implementation-guide/content-security-policy
    const privyChildSrc = [
      "'self'",
      "https://auth.privy.io",
      "https://verify.walletconnect.com",
      "https://verify.walletconnect.org",
    ].join(" ");

    const privyFrameSrc = [
      "'self'",
      "https://auth.privy.io",
      "https://verify.walletconnect.com",
      "https://verify.walletconnect.org",
      "https://challenges.cloudflare.com",
      "https:",
    ].join(" ");

    const privyConnectSrc = [
      "'self'",
      "https://auth.privy.io",
      "wss://relay.walletconnect.com",
      "wss://relay.walletconnect.org",
      "wss://www.walletlink.org",
      "https://*.rpc.privy.systems",
      "https://explorer-api.walletconnect.com",
      "https://api.g.alchemy.com",
      "https:",
      "wss:",
      "ws:",
    ].join(" ");

    const privyScriptSrc = [
      "'self'",
      "'unsafe-eval'",
      "'unsafe-inline'",
      "blob:",
      "https://challenges.cloudflare.com",
      "https://va.vercel-scripts.com",
      "https://vercel.live",
    ].join(" ");

    const mainCsp = [
      "default-src 'self'",
      "img-src 'self' blob: data: https:",
      "media-src 'self' blob: data: https:",
      `script-src ${privyScriptSrc}`,
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self' data:",
      `connect-src ${privyConnectSrc}`,
      `child-src ${privyChildSrc}`,
      `frame-src ${privyFrameSrc}`,
      "worker-src 'self' blob:",
      "manifest-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests",
    ].join("; ");

    const embedCsp = [
      "default-src 'self'",
      "img-src 'self' blob: data: https:",
      "media-src 'self' blob: data: https:",
      `script-src ${privyScriptSrc}`,
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self' data:",
      `connect-src ${privyConnectSrc}`,
      `child-src ${privyChildSrc}`,
      `frame-src ${privyFrameSrc}`,
      "worker-src 'self' blob:",
      "manifest-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors *",
      "upgrade-insecure-requests",
    ].join("; ");

    return [
      {
        source: "/embed/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: embedCsp,
          },
        ],
      },
      {
        // Apply to all routes
        source: '/(.*)',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin-allow-popups',
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'unsafe-none',
          },
          {
            key: 'Content-Security-Policy',
            value: mainCsp,
          },
        ],
      },
    ];
  },
};

export default withAxiom(withPWA(withBotId(nextConfig)));
