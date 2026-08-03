# Requirements

## Game features (implemented)

- FPS monkey shooter with headshot/body hitbox split, penetration combos, streaks
- Endless rounds with scaling monkey count / speed / HP; round select & continue
- Weapon shop (gold purchase + equip), 5 guns + bazooka
- Damage & offline upgrades (gold or ad-watch when short)
- Offline reward popup
- Rewarded ads: shop gold (500), free upgrades, bazooka refill (5 rounds)
- Settings (aim sensitivity etc.), high score, tutorial, stage banners

## Ad SDK (this change)

- **Requirement**: replace the always-success `showRewardedAd()` stub with the real Verse8 Ads SDK.
- **SDK**: `@verse8/ads` → `Verse8Ads.showRewarded({ placementId })` resolves to `{ status: 'rewarded' | 'dismissed' | 'failed' }`.
- **Contract**: only `status === 'rewarded'` returns `true`; dismissed/failed → `false` (no grant). Never auto-show; called only from user gestures (button clicks) — already true at all 4 call sites.
- `unsupported_env` / `busy` / `timeout` / `platform_error` failures surface as `false` → menus refresh, no reward, no crash.

## Known issues / notes

- Gold lives in localStorage; no game server → server-side ad verification not applicable.
- Ad buttons remain visible on `failed`; only `busy` disables mid-flight implicitly (SDK single-ad policy).
