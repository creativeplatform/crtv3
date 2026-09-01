import { PublicClient, type SessionClient } from '@lens-protocol/client';
import {
  CredentialsStorage,
  InMemoryStorageProvider,
} from '@lens-protocol/storage';
import type { AccessToken, IdToken, RefreshToken } from '@lens-protocol/types';
import type { StoredOrbSession } from '@/lib/sdk/orb/login';
import { isStaleOrbSessionError } from '@/lib/sdk/orb/session-errors';
import { getLensSdkEnvironment } from '@/lib/sdk/lens/create-client';

const sessionCache = new Map<string, Promise<SessionClient>>();

/** Clears cached Lens sessions (e.g. on Orb logout). */
export function clearLensSessionCache(): void {
  sessionCache.clear();
}

/**
 * Resume a Lens SessionClient from Orb QR credentials (same tokens Lens API expects).
 * Caches by access token so the storage provider can rotate tokens across calls.
 */
export async function resumeLensSessionFromOrb(
  session: StoredOrbSession,
): Promise<SessionClient> {
  if (!session.accessToken?.trim()) {
    throw new Error('Orb session is missing an access token');
  }

  if (!session.refreshToken?.trim()) {
    throw new Error('Orb session is missing a refresh token');
  }

  const cacheKey = session.accessToken;
  const cached = sessionCache.get(cacheKey);
  if (cached) return cached;

  const sessionPromise = (async () => {
    const environment = getLensSdkEnvironment();
    const storageProvider = new InMemoryStorageProvider();
    const publicClient = PublicClient.create({
      environment,
      storage: storageProvider,
    });

    const credentialsStorage = CredentialsStorage.from(
      storageProvider,
      environment.name,
    );

    const tokens = {
      accessToken: session.accessToken as AccessToken,
      idToken: (session.idToken ?? session.accessToken) as IdToken,
      refreshToken: session.refreshToken as RefreshToken,
    };

    const setResult = await credentialsStorage.set(tokens);
    if (setResult.isErr()) {
      throw new Error(setResult.error.message);
    }

    const resumeResult = await publicClient.resumeSession();
    if (resumeResult.isErr()) {
      const message = resumeResult.error.message;
      if (isStaleOrbSessionError(message)) {
        sessionCache.delete(cacheKey);
      }
      throw new Error(message);
    }

    return resumeResult.value;
  })();

  sessionCache.set(cacheKey, sessionPromise);

  sessionPromise.catch(() => {
    sessionCache.delete(cacheKey);
  });

  return sessionPromise;
}
