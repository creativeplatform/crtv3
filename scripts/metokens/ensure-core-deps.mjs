#!/usr/bin/env node
/**
 * meTokens-core yarn install can leave a broken node_modules on Node 22
 * (yarn reports "Already up-to-date" while devDependencies are missing).
 * Verify required Hardhat plugins exist; reinstall from scratch if not.
 */
import { existsSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const CORE = join(ROOT, 'packages/metokens/core');
const NM = join(CORE, 'node_modules');

const REQUIRED = [
  'hardhat-deploy',
  '@typechain/hardhat',
  '@nomiclabs/hardhat-ethers',
  'hardhat-abi-exporter',
  '@nomiclabs/hardhat-waffle',
];

function missingPackages() {
  return REQUIRED.filter((pkg) => {
    const path = pkg.startsWith('@')
      ? join(NM, pkg.split('/')[0], pkg.split('/')[1])
      : join(NM, pkg);
    return !existsSync(path);
  });
}

const missing = missingPackages();

if (missing.length > 0) {
  console.warn(
    `[metokens] Incomplete install (${missing.join(', ')} missing). Reinstalling core deps…`
  );
  if (existsSync(NM)) {
    rmSync(NM, { recursive: true, force: true });
  }
}

// NODE_ENV=production (common in Next.js shells) skips devDependencies unless overridden.
execFileSync('yarn', ['install', '--production=false'], {
  cwd: CORE,
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'development',
    YARN_PRODUCTION: 'false',
    npm_config_production: 'false',
  },
});

const stillMissing = missingPackages();
if (stillMissing.length > 0) {
  console.error(
    `[metokens] Install failed — still missing: ${stillMissing.join(', ')}\n` +
      'Try manually: cd packages/metokens/core && rm -rf node_modules && yarn install'
  );
  process.exit(1);
}

console.log('[metokens] core dependencies OK');
