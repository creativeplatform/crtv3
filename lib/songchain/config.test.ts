import { describe, it, expect, afterEach } from 'vitest';
import { getSongchainConfig, getSongCupConfig } from './config';

describe('getSongchainConfig', () => {
  const env = process.env;

  afterEach(() => {
    process.env = { ...env };
  });

  it('reports enabled when any primitive id is set', () => {
    process.env.NEXT_PUBLIC_SONGCHAIN_FEED_ID = '0xabc0000000000000000000000000000000000001';
    const config = getSongchainConfig();
    expect(config.enabled).toBe(true);
    expect(config.publicFeedId).toBe(
      '0xabc0000000000000000000000000000000000001',
    );
    expect(config.hallidayOutputAsset).toContain(':');
    expect(config.hallidayInputAssets).toEqual(['usd']);
  });

  it('normalizes addresses to lowercase', () => {
    process.env.NEXT_PUBLIC_SONGCHAIN_GROUP_ID =
      '0xAbC0000000000000000000000000000000000001';
    const config = getSongchainConfig();
    expect(config.groupId).toBe(
      '0xabc0000000000000000000000000000000000001',
    );
  });

  it('accepts Lens contract IDs that include an address', () => {
    process.env.NEXT_PUBLIC_SONGCHAIN_FEED_ID =
      'lens:0xAbC0000000000000000000000000000000000001';
    process.env.NEXT_PUBLIC_SONGCHAIN_EXCLUSIVE_FEED_ID =
      'https://developer.lens.xyz/contracts/0xDeF0000000000000000000000000000000000002';

    const config = getSongchainConfig();

    expect(config.publicFeedId).toBe(
      '0xabc0000000000000000000000000000000000001',
    );
    expect(config.exclusiveFeedId).toBe(
      '0xdef0000000000000000000000000000000000002',
    );
  });

  it('reads app id separately from feed ids', () => {
    process.env.NEXT_PUBLIC_SONGCHAIN_APP_ID =
      '0x3412C2509EeF4f9A133E6D3638B9B3c06fc30111';
    process.env.NEXT_PUBLIC_SONGCHAIN_GRAPH_ID =
      '0x2B36706E8E352a273c34D108A5854A55cb2302A6';
    const config = getSongchainConfig();
    expect(config.appId).toBe('0x3412c2509eef4f9a133e6d3638b9b3c06fc30111');
    expect(config.graphId).toBe('0x2b36706e8e352a273c34d108a5854a55cb2302a6');
    expect(config.enabled).toBe(true);
  });

  it('falls back to server-only env keys when NEXT_PUBLIC vars are unset', () => {
    delete process.env.NEXT_PUBLIC_SONGCHAIN_FEED_ID;
    process.env.SONGCHAIN_FEED_ID =
      '0xdef0000000000000000000000000000000000002';
    const config = getSongchainConfig();
    expect(config.publicFeedId).toBe(
      '0xdef0000000000000000000000000000000000002',
    );
    expect(config.enabled).toBe(true);
  });

  it('reads Season 2 Unlock lock address from env', () => {
    process.env.NEXT_PUBLIC_SONGCHAIN_SEASON_2_LOCK_ADDRESS =
      '0xAbC0000000000000000000000000000000000099';
    const config = getSongchainConfig();
    expect(config.season2LockAddress).toBe(
      '0xabc0000000000000000000000000000000000099',
    );
  });

  it('defaults Season 2 lock address to null when unset', () => {
    delete process.env.NEXT_PUBLIC_SONGCHAIN_SEASON_2_LOCK_ADDRESS;
    delete process.env.SONGCHAIN_SEASON_2_LOCK_ADDRESS;
    const config = getSongchainConfig();
    expect(config.season2LockAddress).toBeNull();
  });
});

describe('getSongCupConfig', () => {
  const env = process.env;

  afterEach(() => {
    process.env = { ...env };
  });

  it('reads Song Cup env vars independently of main Songchain config', () => {
    process.env.NEXT_PUBLIC_SONGCHAIN_APP_ID =
      '0x3412C2509EeF4f9A133E6D3638B9B3c06fc30111';
    process.env.NEXT_PUBLIC_SONGCHAIN_FEED_ID =
      '0xabc0000000000000000000000000000000000001';
    process.env.NEXT_PUBLIC_SONG_CUP_APP_ID =
      '0x6210854CbDA1c5aDa470b9911b590C4F20EDcf23';
    process.env.NEXT_PUBLIC_SONG_CUP_FEED_ID =
      '0x5D15E5b8848A2BaFB0B968dC4CB6725551F1addb';
    process.env.NEXT_PUBLIC_SONG_CUP_GROUP_ID =
      '0x0EA378E56930d4602E7b29CAbFdbD84C5Fd1959B';
    process.env.NEXT_PUBLIC_SONG_CUP_GRAPH_ID =
      '0x51f4905F86402Bcfa015b445f73E3dEfF995a279';

    const config = getSongCupConfig();

    expect(config.appId).toBe('0x6210854cbda1c5ada470b9911b590c4f20edcf23');
    expect(config.publicFeedId).toBe(
      '0x5d15e5b8848a2bafb0b968dc4cb6725551f1addb',
    );
    expect(config.groupId).toBe('0x0ea378e56930d4602e7b29cabfdbd84c5fd1959b');
    expect(config.graphId).toBe('0x51f4905f86402bcfa015b445f73e3deff995a279');
    expect(config.enabled).toBe(true);
    expect(config.season2Enabled).toBe(false);
    expect(config.season2PublicFeedId).toBeNull();
    expect(config.season2ExclusiveFeedId).toBeNull();
    expect(config.season2LockAddress).toBeNull();
  });

  it('uses built-in Song Cup club defaults when Song Cup feed/group vars are unset', () => {
    process.env.NEXT_PUBLIC_SONGCHAIN_APP_ID =
      '0x3412C2509EeF4f9A133E6D3638B9B3c06fc30111';
    process.env.NEXT_PUBLIC_SONGCHAIN_FEED_ID =
      '0xabc0000000000000000000000000000000000001';
    delete process.env.NEXT_PUBLIC_SONG_CUP_APP_ID;
    delete process.env.NEXT_PUBLIC_SONG_CUP_FEED_ID;
    delete process.env.NEXT_PUBLIC_SONG_CUP_GROUP_ID;
    delete process.env.NEXT_PUBLIC_SONG_CUP_GRAPH_ID;

    const config = getSongCupConfig();

    expect(config.appId).toBeNull();
    expect(config.publicFeedId).toBe(
      '0x5d15e5b8848a2bafb0b968dc4cb6725551f1addb',
    );
    expect(config.groupId).toBe('0x0ea378e56930d4602e7b29cabfdbd84c5fd1959b');
    expect(config.graphId).toBeNull();
    expect(config.enabled).toBe(true);
  });

  it('falls back to server-only Song Cup env keys', () => {
    delete process.env.NEXT_PUBLIC_SONG_CUP_FEED_ID;
    process.env.SONG_CUP_FEED_ID =
      '0x9FE052e8ebE534AdE89e817FcbDD56C59d1DA5A2';

    const config = getSongCupConfig();

    expect(config.publicFeedId).toBe(
      '0x9fe052e8ebe534ade89e817fcbdd56c59d1da5a2',
    );
    expect(config.enabled).toBe(true);
  });
});
