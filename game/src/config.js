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
    baseMonkeySpeed: 0.5,
    monkeySpeedIncreasePerRound: 0.08,
    baseMonkeyScale: 1.0,
    baseMonkeyHp: 1,
    roundsPerMonkeyHpIncrease: 2,
  },
  missLimit: 5,
  scorePerGold: 10,
  offlineReward: {
    goldPerHour: 10,
    maxHours: 8,
  },
  adReward: {
    goldAmount: 30,
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
};
