# Project Context

## Overview

**ShootShoot** — a first-person shooter where the player shoots monkeys, earning gold to buy/upgrade weapons, with endless round progression, offline rewards, and a bazooka earned by watching rewarded ads.

## Tech Stack

- **Language/Runtime**: TypeScript (strict), Vite, Bun
- **Rendering**: Three.js (WebGL, no React — plain TS modules)
- **Tests**: Vitest (30 files, 262 tests)
- **3D assets**: GLB/FBX models under `game/public/models/`, loaded via GLTFLoader/FBXLoader
- **Ads**: `@verse8/ads` (Verse8 Ads SDK) — rewarded video

## Platform / Accounts

- Agent8 verse: `0x7b47aa40357441418909f83728da906b7c85d261-1785656792566` (see `.agent8.lock`)
- Verse8 Ads placement ID: `shootshoot-rewarded`
- Gold/currency is **client-side** (localStorage), no game server in use.

## Critical Memory

- `.agent8.lock` is platform-managed — never modify/delete.
- Ad reward gold comes from `CONFIG.adReward.goldAmount` (500). The SDK's `reward.amount` is only a UX hint; no server-side verification (gold is local).
- All four rewarded-ad entry points share one placement (`shootshoot-rewarded`): shop gold, damage upgrade, offline upgrade, bazooka refill.
