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
    // 보이게 된 뒤로는 좌우로 쓸려 다니는 것처럼 빨랐다.
    baseMonkeySpeed: 0.35,
    monkeySpeedIncreasePerRound: 0.05,
    baseMonkeyScale: 1.0,
    baseMonkeyHp: 1,
    roundsPerMonkeyHpIncrease: 2,
  },
  scorePerGold: 10,
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
      id: 'bazooka', name: '바주카포', model: '/models/bazooka.glb', format: 'glb',
      scale: 0.22552, position: { x: 0.4, y: -0.3, z: -0.7 }, rotation: { x: 0, y: 0, z: 0 },
    },
  },
  weapons: [
    {
      id: 'basic', name: '기본 소총', model: '/models/rifle.glb', format: 'glb',
      damage: 1, price: 0, image: '/images/weapons/basic.png',
      scale: 0.08, position: { x: 0.4, y: -0.3, z: -0.7 }, rotation: { x: 0, y: 0, z: 0 },
    },
    {
      id: 'assault', name: '전기총', model: '/models/Lightning Gun.fbx', format: 'fbx',
      damage: 2, price: 500, image: '/images/weapons/assault.png',
      scale: 0.00148, position: { x: 0.4, y: -0.3, z: -0.7 }, rotation: { x: 0, y: 0, z: 0 },
    },
    {
      id: 'sniper', name: '저격소총', model: '/models/Sniper rifle.fbx', format: 'fbx',
      damage: 3, price: 2000, image: '/images/weapons/sniper.png',
      scale: 0.00061, position: { x: 0.4, y: -0.3, z: -0.7 }, rotation: { x: 0, y: 0, z: 0 },
    },
    // scale 은 띄워 보고 맞춘 값이 아니다. FBX 무기들의 배율이 모델 길이 때문에
    // 제각각이라(0.00061 ~ 0.00211) 길이가 비슷한 전기총 값에서 시작한다.
    // 상점 그림 heavy.png 는 아직 없다. shopPanel.js 가 로드 실패한 그림을 숨기므로
    // heavy.png 를 굽기 전까지는 그림 자리만 비고 상점은 정상으로 뜬다.
    {
      id: 'heavy', name: '중화기', model: '/models/Rifle.fbx', format: 'fbx',
      damage: 4, price: 4000, image: '/images/weapons/heavy.png',
      scale: 0.00148, position: { x: 0.4, y: -0.3, z: -0.7 }, rotation: { x: 0, y: 0, z: 0 },
    },
    {
      id: 'raygun', name: '레이건', model: '/models/Ray Gun.fbx', format: 'fbx',
      damage: 5, price: 6000, image: '/images/weapons/raygun.png',
      scale: 0.00211, position: { x: 0.4, y: -0.3, z: -0.7 }, rotation: { x: 0, y: 0, z: 0 },
    },
  ],
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
