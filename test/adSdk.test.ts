import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Verse8Ads } from '@verse8/ads';
import { showRewardedAd } from '../game/src/gameplay/adSdk';

vi.mock('@verse8/ads', () => ({
  Verse8Ads: { showRewarded: vi.fn() },
}));

describe('showRewardedAd', () => {
  beforeEach(() => {
    vi.mocked(Verse8Ads.showRewarded).mockReset();
  });

  it('resolves to true when the ad is fully watched', async () => {
    vi.mocked(Verse8Ads.showRewarded).mockResolvedValue({
      status: 'rewarded',
      reward: { amount: 500, type: 'gold' },
      requestId: 'req-1',
    });
    await expect(showRewardedAd()).resolves.toBe(true);
  });

  it('resolves to false when the ad is dismissed early', async () => {
    vi.mocked(Verse8Ads.showRewarded).mockResolvedValue({
      status: 'dismissed',
      requestId: 'req-2',
    });
    await expect(showRewardedAd()).resolves.toBe(false);
  });

  it('resolves to false when the ad fails', async () => {
    vi.mocked(Verse8Ads.showRewarded).mockResolvedValue({
      status: 'failed',
      error: { code: 'platform_error' },
      requestId: 'req-3',
    });
    await expect(showRewardedAd()).resolves.toBe(false);
  });

  it('passes the configured placement id to the SDK', async () => {
    vi.mocked(Verse8Ads.showRewarded).mockResolvedValue({
      status: 'dismissed',
      requestId: 'req-4',
    });
    await showRewardedAd();
    expect(Verse8Ads.showRewarded).toHaveBeenCalledWith({
      placementId: 'shootshoot-rewarded',
    });
  });
});
