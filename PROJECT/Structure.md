# Project Structure

- `package.json` / `vite.config.ts` — project root (Vite root = `game/`, build output `../dist`)
- `game/` — game source
  - `index.html` — entry HTML (`#app` container)
  - `public/` — static assets: `models/*.glb|*.fbx`, `images/weapons/*.png`, Kenney UI icons
  - `src/main.ts` — bootstrap: `createGame(container).start()`
  - `src/config.ts` — **CONFIG**: scores, rounds, weapons, rewards, storage keys, ad placement
  - `src/core/` — `engine.ts` (renderer/scene/camera loop), `input.ts` (pointer/keyboard controller)
  - `src/gameplay/` — game logic:
    - `game.ts` — main coordinator (state machine, shots, menus, ad handlers, HUD wiring)
    - `adSdk.ts` — **rewarded ad adapter**: `showRewardedAd(): Promise<boolean>` wrapping `Verse8Ads.showRewarded`
    - `shooting.ts` / `scoring.ts` — shot resolution, damage, scoring
    - `monkey.ts` / `monkeyModel.ts` / `targetManager.ts` / `roundComposition.ts` / `patrolMotion.ts` — enemies & spawn
    - `weaponViewmodel.ts` / `weaponStore.ts` / `bazookaStore.ts` / `bazookaProjectile.ts` — weapons & bazooka
    - `currencyStore.ts` / `upgradeStore.ts` / `offlineReward.ts` / `progressStore.ts` / `settingsStore.ts` / `tutorialStore.ts` — persistence stores (localStorage)
    - `world.ts` / `scenery.ts` / `obstacles.ts` / `skyDecor.ts` / `skyMotion.ts` / `effects.ts` / `debris.ts` — scene building & FX
  - `src/ui/` — DOM UI (`theme.css`, `kit.ts`, `screens.ts`, `hud.ts`, `shopPanel.ts`, `settingsPanel.ts`, `scopeOverlay.ts`, etc.)
  - `src/audio/sfx.ts` — WebAudio sound effects
- `test/` — Vitest unit tests (pure-logic modules, stores, adSdk)
- `docs/superpowers/` — design docs & implementation plans (user's spec workflow)
- `PROJECT/` — this doc set

## Architecture notes

- Ad boundary is the `showRewardedAd()` boolean interface in `adSdk.ts`; all four call sites in `game.ts` only consume `boolean` (true = grant, false = no grant), so the SDK swap left call sites untouched.
- Stores follow a uniform `createXStore(storage, key)` integer/localStorage pattern.
