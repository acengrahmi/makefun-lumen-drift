// Lumen Drift — every tunable number lives here so the loop can be balanced
// from one place: arena size, player feel, enemy roster, wave recipes and
// the upgrade pool the player chooses from between waves.
export const ARENA = {
  width: 1280,
  height: 720,
  margin: 26,
};

export const PALETTE = {
  skyTop: '#0b1030',
  skyBottom: '#131c3f',
  groundGlow: '#1c2a55',
  grassDark: '#16233f',
  grassLight: '#1e3050',
  flowerPink: '#ff7fb0',
  flowerGold: '#ffd166',
  flowerBlue: '#7fd4ff',
  playerCore: '#fff3b0',
  playerGlow: '#ffcf4d',
  playerRing: '#ffe98a',
  dew: '#8ef7ff',
  heart: '#ff5d7e',
  nova: '#c9a7ff',
  text: '#f4f1de',
  textDim: '#aab4d4',
  panel: 'rgba(8, 12, 32, 0.78)',
  panelEdge: 'rgba(255, 207, 77, 0.55)',
};

export const PLAYER = {
  radius: 16,
  speed: 265,
  fireInterval: 0.21,
  bulletSpeed: 620,
  bulletRadius: 6,
  bulletDamage: 1,
  bulletLife: 0.85,
  invulnSeconds: 1.3,
  pickupRadius: 64,
  maxHearts: 3,
};

export const NOVA = {
  startCharges: 1,
  damage: 6,
  radius: 560,
};

// One entry per enemy kind: movement, toughness, score and what it drops.
export const ENEMIES = {
  mote: {
    name: 'Mote',
    radius: 13,
    speed: 95,
    hp: 1,
    score: 10,
    dew: 1,
    touch: 1,
    colour: '#b388ff',
    dark: '#7b4fd0',
  },
  emberbat: {
    name: 'Emberbat',
    radius: 12,
    speed: 175,
    hp: 1,
    score: 15,
    dew: 1,
    touch: 1,
    colour: '#ff9a3d',
    dark: '#c85a17',
  },
  spitter: {
    name: 'Spitter',
    radius: 17,
    speed: 70,
    hp: 3,
    score: 30,
    dew: 2,
    touch: 1,
    colour: '#7be495',
    dark: '#2f9e5f',
    shootEvery: 2.4,
    bulletSpeed: 150,
  },
  brute: {
    name: 'Brute',
    radius: 26,
    speed: 52,
    hp: 8,
    score: 50,
    dew: 4,
    touch: 1,
    colour: '#e05d5d',
    dark: '#8f2f3a',
    splitInto: 3,
  },
  herald: {
    name: 'Gloom Herald',
    radius: 46,
    speed: 42,
    hp: 70,
    score: 500,
    dew: 12,
    touch: 2,
    colour: '#5d5df0',
    dark: '#2c2c7a',
    burstEvery: 3.1,
    spawnEvery: 6.5,
  },
};

// How many of each kind a wave throws at the player, in spawn order.
// Wave 5 and 10 are boss waves: the Herald arrives once the field thins out.
export function waveRecipe(wave) {
  const table = {
    1: { mote: 7 },
    2: { mote: 9, emberbat: 4 },
    3: { mote: 10, emberbat: 6, spitter: 2 },
    4: { mote: 12, emberbat: 7, spitter: 3, brute: 1 },
    5: { mote: 10, emberbat: 6, spitter: 3, brute: 2, herald: 1 },
    6: { mote: 14, emberbat: 9, spitter: 4, brute: 2 },
    7: { mote: 16, emberbat: 11, spitter: 5, brute: 3 },
    8: { mote: 18, emberbat: 12, spitter: 6, brute: 4 },
    9: { mote: 20, emberbat: 14, spitter: 7, brute: 5 },
    10: { mote: 16, emberbat: 12, spitter: 6, brute: 4, herald: 1 },
  };
  return table[wave] ?? table[10];
}

export const TOTAL_WAVES = 10;

// Seconds between spawns shrink as waves get harder, so later waves flood in.
export function spawnGap(wave) {
  return Math.max(0.35, 1.15 - wave * 0.07);
}

// The upgrade cards offered between waves. `max` caps how often one can stack.
export const UPGRADES = [
  {
    id: 'twin',
    title: 'Twin Spark',
    body: '+1 lantern bolt per shot',
    max: 2,
    apply: (u) => { u.shots += 1; },
  },
  {
    id: 'swift',
    title: 'Swift Shots',
    body: 'Fire 25% faster',
    max: 3,
    apply: (u) => { u.fireRate *= 0.8; },
  },
  {
    id: 'pierce',
    title: 'Piercing Light',
    body: 'Bolts pass through +1 foe',
    max: 2,
    apply: (u) => { u.pierce += 1; },
  },
  {
    id: 'longshot',
    title: 'Long Lantern',
    body: 'Bolts fly farther and faster',
    max: 2,
    apply: (u) => { u.bulletSpeed *= 1.25; u.bulletLife *= 1.2; },
  },
  {
    id: 'magnet',
    title: 'Magnet Bloom',
    body: 'Dew and hearts fly to you',
    max: 2,
    apply: (u) => { u.magnet *= 1.7; },
  },
  {
    id: 'fleet',
    title: 'Fleet Wisp',
    body: 'Move 18% faster',
    max: 2,
    apply: (u) => { u.moveSpeed *= 1.18; },
  },
  {
    id: 'vessel',
    title: 'Heart Vessel',
    body: '+1 max heart, heal 1 now',
    max: 2,
    apply: (u) => { u.maxHearts += 1; },
  },
  {
    id: 'thorns',
    title: 'Thorn Halo',
    body: 'A burning ring hurts nearby foes',
    max: 2,
    apply: (u) => { u.thorns += 1; },
  },
  {
    id: 'crit',
    title: 'Crit Spark',
    body: '+15% chance a bolt hits double',
    max: 3,
    apply: (u) => { u.crit += 0.15; },
  },
  {
    id: 'nova',
    title: 'Nova Charge',
    body: '+1 Nova bomb (press E)',
    max: 2,
    apply: (u) => { u.novaCharges += 1; },
  },
];

export const COMBO_WINDOW = 2.5;
export const COMBO_CAP = 8;
