# Status

## Recent activity (2026-08-02)

- **Settings panel tuning**: removed internal scroll + compacted size. Cause: shared `.responsive-panel` `overflow:auto` treated the out-of-panel close button (-14px) as scrollable overflow. Added `.settings-panel` override (overflow visible, no max-height) in `theme.css`; tightened title/slider/label/actions spacing; `min-width` 300→260px.

- **Ad SDK integration** (`@verse8/ads` v0.4.0):
  - `game/src/gameplay/adSdk.ts`: replaced the 500ms always-`true` stub with a real `Verse8Ads.showRewarded({ placementId })` call; `rewarded` → `true`, everything else → `false`.
  - `game/src/config.ts`: added `CONFIG.adReward.placementId = 'shootshoot-rewarded'`.
  - `test/adSdk.test.ts`: rewrote to mock `@verse8/ads`; 4 tests (rewarded/dismissed/failed + placement passthrough).
  - Verified: 262 tests pass (30 files), `tsc --noEmit` clean.

## Status

- All tests green, typecheck clean.
- Git repo was initialized earlier but the environment reset removed `.git` — reinitialize when committing is next.

## Next steps

- Recreate git repo and make an initial commit (includes ad SDK integration).
- Optionally: differentiate placements per ad entry point (shop gold vs bazooka) if the platform console requires separate placements.
