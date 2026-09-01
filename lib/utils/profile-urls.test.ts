import { describe, expect, it } from 'vitest';
import {
  getProfileAnalyticsUrl,
  isValidProfileTab,
} from '@/lib/utils/profile-urls';

describe('profile-urls Analytics tab', () => {
  it('accepts Analytics as a valid profile tab', () => {
    expect(isValidProfileTab('Analytics')).toBe(true);
    expect(isValidProfileTab('Uploads')).toBe(true);
    expect(isValidProfileTab('Revenue')).toBe(false);
  });

  it('builds analytics profile URL', () => {
    expect(getProfileAnalyticsUrl('0xabc')).toBe(
      '/profile/0xabc?tab=Analytics',
    );
  });
});
