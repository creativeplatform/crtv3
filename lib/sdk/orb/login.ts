import { createOrbLogin, type OrbLogin } from '@orbclub/modules/auth';
import { getOrbLoginConfig } from '@/lib/sdk/orb/config';

let orbLoginSingleton: OrbLogin | null = null;

export function getOrbLogin(): OrbLogin {
  if (!orbLoginSingleton) {
    orbLoginSingleton = createOrbLogin(getOrbLoginConfig());
  }
  return orbLoginSingleton;
}

export type StoredOrbSession = {
  accessToken: string;
  refreshToken?: string;
  authenticationId?: string;
  idToken?: string;
};

export const ORB_SESSION_STORAGE_KEY = 'crtv_orb_session';

export function loadStoredOrbSession(): StoredOrbSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(ORB_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredOrbSession;
    if (!parsed?.accessToken) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveStoredOrbSession(session: StoredOrbSession | null): void {
  if (typeof window === 'undefined') return;
  if (!session?.accessToken) {
    localStorage.removeItem(ORB_SESSION_STORAGE_KEY);
    return;
  }
  localStorage.setItem(ORB_SESSION_STORAGE_KEY, JSON.stringify(session));
}
