#!/usr/bin/env npx tsx
/**
 * Validate deployments/metokens/base.json against on-chain state.
 *
 * - Facets: viem `facetAddresses()` on Base Diamond (Louper optional snapshot)
 * - Hubs: viem `getHubInfo`
 *
 * Usage:
 *   yarn metokens:validate-deployments
 *   yarn metokens:validate-deployments --write-louper-snapshot
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPublicClient, http, parseAbi } from 'viem';
import { base } from 'viem/chains';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const BASE_JSON_PATH = join(ROOT, 'deployments/metokens/base.json');
const LOUPER_SNAPSHOT_PATH = join(ROOT, 'deployments/metokens/base.louper.json');

const writeLouperSnapshot = process.argv.includes('--write-louper-snapshot');

type BaseManifest = {
  chainId: number;
  contracts: {
    diamond: { address: string };
    meTokenFactory: { address: string };
    facets: Record<string, string>;
    hubs: Record<
      string,
      { asset: string; assetAddress: string; vault: string; active: boolean }
    >;
  };
};

function loadManifest(): BaseManifest {
  return JSON.parse(readFileSync(BASE_JSON_PATH, 'utf8')) as BaseManifest;
}

function normalizeAddress(address: string): string {
  return address.toLowerCase();
}

function getRpcUrl(): string {
  const key = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY ?? process.env.ALCHEMY_API_KEY;
  return key
    ? `https://base-mainnet.g.alchemy.com/v2/${key}`
    : 'https://mainnet.base.org';
}

function tryLouperSnapshot(diamond: string): unknown | null {
  const candidates = [
    join(ROOT, 'node_modules/.bin/louper-cli'),
    join(ROOT, 'node_modules/@mark3labs/louper-cli/bin/louper-cli'),
  ];
  const bin = candidates.find((p) => existsSync(p));
  if (!bin) return null;

  try {
    const output = execFileSync(
      bin,
      ['inspect', 'diamond', '-a', diamond, '-n', 'base', '--json'],
      { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
    );
    return JSON.parse(output) as unknown;
  } catch {
    return null;
  }
}

async function fetchLiveFacetAddresses(diamond: `0x${string}`): Promise<string[]> {
  const client = createPublicClient({ chain: base, transport: http(getRpcUrl()) });
  const loupeAbi = parseAbi(['function facetAddresses() view returns (address[])']);
  const addresses = await client.readContract({
    address: diamond,
    abi: loupeAbi,
    functionName: 'facetAddresses',
  });
  return addresses.map((a) => normalizeAddress(a));
}

async function validateHubs(
  diamond: `0x${string}`,
  manifest: BaseManifest
): Promise<string[]> {
  const errors: string[] = [];
  const client = createPublicClient({ chain: base, transport: http(getRpcUrl()) });

  const hubInfoAbi = parseAbi([
    'function getHubInfo(uint256 hubId) view returns ((uint256,uint256,uint256,uint256,uint256,address,address,address,bool,bool,bool))',
  ]);

  for (const [hubId, hub] of Object.entries(manifest.contracts.hubs)) {
    try {
      const info = await client.readContract({
        address: diamond,
        abi: hubInfoAbi,
        functionName: 'getHubInfo',
        args: [BigInt(hubId)],
      });

      const asset = normalizeAddress(info[7] as string);
      const vault = normalizeAddress(info[6] as string);
      const active = info[10] as boolean;

      if (asset !== normalizeAddress(hub.assetAddress)) {
        errors.push(
          `Hub ${hubId} asset mismatch: manifest ${hub.assetAddress}, chain ${info[7]}`
        );
      }
      if (vault !== normalizeAddress(hub.vault)) {
        errors.push(
          `Hub ${hubId} vault mismatch: manifest ${hub.vault}, chain ${info[6]}`
        );
      }
      if (active !== hub.active) {
        errors.push(`Hub ${hubId} active mismatch: manifest ${hub.active}, chain ${active}`);
      }
    } catch (err) {
      errors.push(
        `Hub ${hubId} read failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  return errors;
}

async function main() {
  const manifest = loadManifest();
  const diamond = manifest.contracts.diamond.address as `0x${string}`;

  console.log('Validating MeTokens Base deployment manifest...\n');
  console.log(`Diamond: ${diamond}`);

  const louperJson = tryLouperSnapshot(diamond);
  if (writeLouperSnapshot) {
    if (louperJson) {
      mkdirSync(dirname(LOUPER_SNAPSHOT_PATH), { recursive: true });
      writeFileSync(LOUPER_SNAPSHOT_PATH, `${JSON.stringify(louperJson, null, 2)}\n`);
      console.log(`Wrote ${LOUPER_SNAPSHOT_PATH}`);
    } else {
      console.warn(
        'Louper CLI binary not found — skip snapshot. Run: cd node_modules/@mark3labs/louper-cli && npm run postinstall'
      );
    }
  }

  const liveFacets = new Set(await fetchLiveFacetAddresses(diamond));
  const errors: string[] = [];

  for (const [name, address] of Object.entries(manifest.contracts.facets)) {
    const normalized = normalizeAddress(address);
    if (!liveFacets.has(normalized)) {
      errors.push(
        `Facet "${name}" (${address}) not registered on Diamond (loupe facetAddresses)`
      );
    } else {
      console.log(`  ✓ facet ${name}`);
    }
  }

  const hubErrors = await validateHubs(diamond, manifest);
  errors.push(...hubErrors);
  for (const hubId of Object.keys(manifest.contracts.hubs)) {
    if (!hubErrors.some((e) => e.startsWith(`Hub ${hubId}`))) {
      console.log(`  ✓ hub ${hubId}`);
    }
  }

  if (errors.length > 0) {
    console.error('\nValidation failed:\n');
    errors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }

  console.log('\nAll manifest entries match on-chain state.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
