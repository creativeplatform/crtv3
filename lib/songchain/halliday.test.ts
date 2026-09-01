import { afterEach, describe, expect, it } from 'vitest';
import {
  buildHallidayInputAssets,
  buildHallidayOutputAsset,
  buildHallidayStoryOutputAsset,
  HALLIDAY_DEFAULT_INPUT_ASSETS,
  isHallidayLensChainAsset,
  isHallidayLensOnrampSupported,
  isHallidaySandboxEnabled,
  LENS_GHO_TOKEN_ADDRESS,
  normalizeHallidayAssetId,
} from './halliday';

describe('normalizeHallidayAssetId', () => {
  it('lowercases fiat symbols', () => {
    expect(normalizeHallidayAssetId('USD')).toBe('usd');
    expect(normalizeHallidayAssetId(' EUR ')).toBe('eur');
  });

  it('lowercases chain slug and token address', () => {
    expect(
      normalizeHallidayAssetId('Lens:0xABCDEF0000000000000000000000000000000001'),
    ).toBe('lens:0xabcdef0000000000000000000000000000000001');
  });

  it('lowercases chain slug and token symbol', () => {
    expect(normalizeHallidayAssetId('Ethereum:USDC')).toBe('ethereum:usdc');
  });
});

describe('buildHallidayOutputAsset', () => {
  const env = process.env;

  afterEach(() => {
    process.env = { ...env };
  });

  it('builds lens mainnet GHO output by default', () => {
    delete process.env.NEXT_PUBLIC_HALLIDAY_OUTPUT_ASSET;
    delete process.env.NEXT_PUBLIC_HALLIDAY_CHAIN_SLUG;
    process.env.NEXT_PUBLIC_LENS_ENV = 'production';

    expect(buildHallidayOutputAsset('mainnet')).toBe(
      `lens:${LENS_GHO_TOKEN_ADDRESS}`,
    );
  });

  it('respects full output asset override and normalizes casing', () => {
    process.env.NEXT_PUBLIC_HALLIDAY_OUTPUT_ASSET = 'Lens:0xAbC';
    expect(buildHallidayOutputAsset('mainnet')).toBe('lens:0xabc');
  });
});

describe('buildHallidayStoryOutputAsset', () => {
  const env = process.env;

  afterEach(() => {
    process.env = { ...env };
  });

  it('builds story testnet native IP output by default', () => {
    delete process.env.NEXT_PUBLIC_HALLIDAY_STORY_OUTPUT_ASSET;
    delete process.env.NEXT_PUBLIC_HALLIDAY_STORY_CHAIN_SLUG;
    delete process.env.NEXT_PUBLIC_STORY_NETWORK;

    expect(buildHallidayStoryOutputAsset('testnet')).toBe('story-testnet:0x');
  });

  it('builds story mainnet native IP output', () => {
    delete process.env.NEXT_PUBLIC_HALLIDAY_STORY_OUTPUT_ASSET;
    expect(buildHallidayStoryOutputAsset('mainnet')).toBe('story:0x');
  });
});

describe('buildHallidayInputAssets', () => {
  const env = process.env;

  afterEach(() => {
    process.env = { ...env };
  });

  it('defaults to usd for fiat onramp', () => {
    delete process.env.NEXT_PUBLIC_HALLIDAY_INPUT_ASSET;
    expect(buildHallidayInputAssets()).toEqual([...HALLIDAY_DEFAULT_INPUT_ASSETS]);
  });

  it('supports comma-separated input overrides with normalization', () => {
    process.env.NEXT_PUBLIC_HALLIDAY_INPUT_ASSET = 'USD, EUR';
    expect(buildHallidayInputAssets()).toEqual(['usd', 'eur']);
  });

  it('falls back to defaults when override is only whitespace or commas', () => {
    process.env.NEXT_PUBLIC_HALLIDAY_INPUT_ASSET = ' , , ';
    expect(buildHallidayInputAssets()).toEqual([...HALLIDAY_DEFAULT_INPUT_ASSETS]);
  });
});

describe('isHallidayLensChainAsset', () => {
  it('detects lens mainnet and testnet assets', () => {
    expect(isHallidayLensChainAsset(`lens:${LENS_GHO_TOKEN_ADDRESS}`)).toBe(true);
    expect(isHallidayLensChainAsset('lens-testnet:0xabc')).toBe(true);
    expect(isHallidayLensChainAsset('story:0x')).toBe(false);
  });
});

describe('isHallidayLensOnrampSupported', () => {
  const env = process.env;

  afterEach(() => {
    process.env = { ...env };
  });

  it('is disabled unless explicitly enabled', () => {
    delete process.env.NEXT_PUBLIC_HALLIDAY_LENS_ENABLED;
    expect(isHallidayLensOnrampSupported()).toBe(false);

    process.env.NEXT_PUBLIC_HALLIDAY_LENS_ENABLED = 'true';
    expect(isHallidayLensOnrampSupported()).toBe(true);
  });
});

describe('isHallidaySandboxEnabled', () => {
  const env = process.env;

  afterEach(() => {
    process.env = { ...env };
  });

  it('returns true when sandbox flag is set', () => {
    process.env.NEXT_PUBLIC_HALLIDAY_SANDBOX = 'true';
    expect(isHallidaySandboxEnabled()).toBe(true);
  });
});
