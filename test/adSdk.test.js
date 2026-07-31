import { describe, it, expect, vi } from 'vitest';
import { showRewardedAd } from '../game/src/gameplay/adSdk';

describe('showRewardedAd', () => {
  it('resolves to true (stub always succeeds)', async () => {
    vi.useFakeTimers();
    const promise = showRewardedAd();
    vi.runAllTimers();
    const result = await promise;
    expect(result).toBe(true);
    vi.useRealTimers();
  });
});
