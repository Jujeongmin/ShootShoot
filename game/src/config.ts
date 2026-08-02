export interface WeaponModel {
  id: string;
  name: string;
  model: string;
  format: 'glb' | 'fbx';
  scale: number;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
}

// 바주카는 무기 목록(weapons)에 안 들어가고 damage·price·image 도 없다 —
// 상점에서 사고파는 대상이 아니라 항상 갖고 있는 별도 무기라서다.
export interface Weapon extends WeaponModel {
  damage: number;
  price: number;
  image: string;
}

export const CONFIG = {
  score: {
    baseHit: 100,
    headshotBonus: 150,
    comboMultiplierPerPenetration: 0.5,
    streakMultiplierStep: 0.1,
    streakMultiplierCap: 2.0,
  },
  round: {
    baseMonkeyCount: 3,
    monkeyCountIncreasePerRound: 1,
    maxMonkeyCount: 10,
    // 원숭이가 오가는 폭(laneLayout의 진폭)은 그대로 두고 속도만 늦춘다. 순찰이
    // 보이게 된 뒤로는 좌우로 쓸려 다니는 것처럼 빨랐다. 0.5에서 두 번 내린 값이다.
    //
    // 이 값이 도발 빈도까지 정한다는 점을 알고 있어야 한다. steady/pause/bob은
    // 순찰 양 끝에서만 도발하고 그 주기가 2π/(1.8 × 속도)라, 0.25면 약 14초
    // 주기에 끝이 7초마다다 -- 다만 dash는 가운데서도 한 번 멈춰 도는 behavior라
    // (patrolMotion.ts) 그 배로 자주 도발한다. 순찰 폭(진폭)은 6라운드부터
    // 개체마다 달라지지만(roundComposition.ts의 VARIANTS) 주기에는 안 실리므로
    // 이 계산 자체는 안 흔들린다. 더 내리면 도발이 눈에 띄게 드물어진다.
    baseMonkeySpeed: 0.25,
    monkeySpeedIncreasePerRound: 0.035,
    baseMonkeyScale: 1.0,
    baseMonkeyHp: 1,
    roundsPerMonkeyHpIncrease: 2,
  },
  scorePerGold: 10,
  // 라운드가 올라가도 한 판 골드가 그대로였다. 원숭이 수가 10에서 멈춰서
  // 8라운드나 100라운드나 같은 점수가 나오는데 체력은 무한히 올라 시간만 길어진다.
  // 시간당 골드가 평평하려면 배율이 라운드/8 이어야 하고(50라운드에 6.25), 0.15는
  // 그보다 위라 높은 라운드가 이득이 되되 극단적이지 않다.
  goldRoundMultiplierPerRound: 0.15,
  reload: {
    // 일반 총과 바주카포가 같은 값을 쓴다.
    seconds: 0.8,
  },
  offlineReward: {
    goldPerHour: 10,
    maxHours: 8,
  },
  adReward: {
    // 상점에서 골드가 모자랄 때 광고 한 번으로 주는 금액. 예전에는 메뉴의
    // 광고 보상 팝업이 30을 줬는데, 그 팝업이 사라지면서 이 값만 남았다.
    goldAmount: 500,
    // Verse8 Ads SDK(@verse8/ads)의 rewarded 광고 placement. 상점 골드·강화·바주카
    // 네 호출부가 모두 같은 placement를 쓴다. 골드 지급량은 CONFIG.adReward.goldAmount로
    // 정하고 SDK 결과의 reward.amount는 UX 힌트로만 본다(문서의 server-side verification
    // 규칙 — 이 게임 골드는 클라이언트 로컬 저장소라 서버 검증은 하지 않는다).
    placementId: 'shootshoot-rewarded',
  },
  aim: {
    normalFov: 60,
    aimFov: 9,
    lookLimitX: 0.3,
    lookLimitY: 0.2,
  },
  weaponDamage: {
    headshotMultiplier: 2,
  },
  damageUpgrade: {
    baseCost: 50,
    costMultiplier: 1.15,
    bonusPerLevel: 1,
  },
  offlineUpgrade: {
    baseCost: 80,
    costMultiplier: 1.2,
    bonusPerLevel: 2,
  },
  bazooka: {
    maxRounds: 5,
    blastScreenRatio: 0.25,
    maxRange: 85,
    flightSeconds: 0.3,
    weapon: {
      id: 'bazooka', name: 'Bazooka', model: '/models/bazooka.glb', format: 'glb',
      scale: 0.22552, position: { x: 0.4, y: -0.3, z: -0.7 }, rotation: { x: 0, y: 0, z: 0 },
    } satisfies WeaponModel,
  },
  weapons: [
    {
      id: 'basic', name: 'Rifle', model: '/models/rifle.glb', format: 'glb',
      damage: 1, price: 0, image: '/images/weapons/basic.png',
      scale: 0.08, position: { x: 0.4, y: -0.3, z: -0.7 }, rotation: { x: 0, y: 0, z: 0 },
    },
    {
      id: 'assault', name: 'Lightning Gun', model: '/models/Lightning Gun.fbx', format: 'fbx',
      damage: 2, price: 500, image: '/images/weapons/assault.png',
      scale: 0.00148, position: { x: 0.4, y: -0.3, z: -0.7 }, rotation: { x: 0, y: 0, z: 0 },
    },
    {
      id: 'sniper', name: 'Sniper Rifle', model: '/models/Sniper rifle.fbx', format: 'fbx',
      damage: 3, price: 2000, image: '/images/weapons/sniper.png',
      scale: 0.00061, position: { x: 0.4, y: -0.3, z: -0.7 }, rotation: { x: 0, y: 0, z: 0 },
    },
    // scale 은 띄워 보고 맞춘 값이 아니다. FBX 무기들의 배율이 모델 길이 때문에
    // 제각각이라(0.00061 ~ 0.00211) 길이가 비슷한 전기총 값에서 시작한다.
    {
      id: 'heavy', name: 'Heavy Gun', model: '/models/Rifle.fbx', format: 'fbx',
      damage: 4, price: 4000, image: '/images/weapons/heavy.png',
      scale: 0.00148, position: { x: 0.4, y: -0.3, z: -0.7 }, rotation: { x: 0, y: 0, z: 0 },
    },
    {
      id: 'raygun', name: 'Ray Gun', model: '/models/Ray Gun.fbx', format: 'fbx',
      damage: 5, price: 6000, image: '/images/weapons/raygun.png',
      scale: 0.00211, position: { x: 0.4, y: -0.3, z: -0.7 }, rotation: { x: 0, y: 0, z: 0 },
    },
  ] satisfies Weapon[],
  highScoreStorageKey: 'shootshoot.highscore',
  settingsStorageKey: 'shootshoot.settings',
  currencyStorageKey: 'shootshoot.gold',
  lastSeenStorageKey: 'shootshoot.lastseen',
  weaponStorageKey: 'shootshoot.weapons',
  upgradeStorageKey: 'shootshoot.upgrades',
  bazookaStorageKey: 'shootshoot.bazooka',
  tutorialStorageKey: 'shootshoot.tutorial',
  progressStorageKey: 'shootshoot.progress',
};
