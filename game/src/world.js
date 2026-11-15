// Lumen Drift — the whole simulation: the lantern wisp, its foes, waves,
// upgrades, score and combo. Rendering never touches this state except to
// read it, and the screenshot autopilot drives it through the same step.
//
// Screens: 'title' | 'playing' | 'upgrade' | 'paused' | 'over' | 'win'.
// The player survives 10 waves to win; losing every heart ends the run.
import {
  ARENA, PLAYER, NOVA, ENEMIES, TOTAL_WAVES,
  waveRecipe, spawnGap, UPGRADES, COMBO_WINDOW, COMBO_CAP,
} from './config.js';
import { makeRng, rngRange, rngPick, rngShuffle } from './random.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'playing';
export const SCREEN_UPGRADE = 'upgrade';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const BEST_KEY = 'lumendrift.best';

function loadBest() {
  try {
    return Number(window.localStorage.getItem(BEST_KEY)) || 0;
  } catch (err) {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch (err) {
    // Best score is a nicety; a blocked store must never stop the game.
  }
}

function freshUpgrades() {
  return {
    shots: 1,
    fireRate: 1,
    pierce: 0,
    bulletSpeed: PLAYER.bulletSpeed,
    bulletLife: PLAYER.bulletLife,
    magnet: PLAYER.pickupRadius,
    moveSpeed: PLAYER.speed,
    maxHearts: PLAYER.maxHearts,
    thorns: 0,
    crit: 0,
    novaCharges: NOVA.startCharges,
    taken: {},
  };
}

export function createWorld(seed) {
  const rng = makeRng(seed);
  const world = {
    rng,
    seed,
    time: 0,
    screen: SCREEN_TITLE,
    screenBeforePause: SCREEN_PLAY,
    score: 0,
    best: loadBest(),
    dew: 0,
    combo: 0,
    comboTimer: 0,
    kills: 0,
    wave: 0,
    waveState: 'idle',
    hp: PLAYER.maxHearts,
    player: {
      x: ARENA.width / 2,
      y: ARENA.height / 2,
      vx: 0,
      vy: 0,
      radius: PLAYER.radius,
      aimAngle: -Math.PI / 2,
      fireTimer: 0,
      invuln: 0,
      trail: [],
    },
    bullets: [],
    enemies: [],
    ebullets: [],
    pickups: [],
    particles: [],
    texts: [],
    spawnQueue: [],
    spawnTimer: 0,
    bossAnnounced: false,
    banner: null,
    shake: 0,
    flash: 0,
    novaCharges: NOVA.startCharges,
    upgrades: freshUpgrades(),
    offered: [],
    stats: { shotsFired: 0, shotsHit: 0, wavesCleared: 0, timePlayed: 0 },
    sound: null,
  };
  return world;
}

export function resetWorld(world) {
  const fresh = createWorld(world.seed);
  Object.keys(world).forEach((key) => delete world[key]);
  Object.assign(world, fresh);
}

// ---- small helpers -------------------------------------------------------

function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

function addText(world, x, y, text, colour, size = 18) {
  world.texts.push({ x, y, life: 1.1, maxLife: 1.1, text, colour, size });
}

function burst(world, x, y, colour, count, speed = 180, size = 4) {
  for (let i = 0; i < count; i += 1) {
    const angle = world.rng() * Math.PI * 2;
    const v = speed * (0.4 + world.rng() * 0.8);
    world.particles.push({
      x, y,
      vx: Math.cos(angle) * v,
      vy: Math.sin(angle) * v,
      life: 0.45 + world.rng() * 0.35,
      maxLife: 0.8,
      size: size * (0.6 + world.rng() * 0.8),
      colour,
    });
  }
}

function ring(world, x, y, colour, maxRadius) {
  world.particles.push({
    x, y, vx: 0, vy: 0, life: 0.5, maxLife: 0.5,
    size: 6, colour, ring: true, ringMax: maxRadius,
  });
}

function announce(world, text, sub = '') {
  world.banner = { text, sub, timer: 2.4, maxTimer: 2.4 };
}

export function comboMultiplier(world) {
  return 1 + 0.25 * (world.combo - 1 > 0 ? world.combo - 1 : 0);
}

function addScore(world, base) {
  const gained = Math.round(base * comboMultiplier(world));
  world.score += gained;
  return gained;
}

// ---- waves and spawning --------------------------------------------------

function buildSpawnQueue(world) {
  const recipe = waveRecipe(world.wave);
  const queue = [];
  Object.entries(recipe).forEach(([kind, count]) => {
    for (let i = 0; i < count; i += 1) queue.push(kind);
  });
  // The Herald always arrives last, once the field has thinned out.
  const heraldAt = queue.indexOf('herald');
  if (heraldAt >= 0) {
    queue.splice(heraldAt, 1);
    queue.push('herald');
  }
  return rngShuffle(world.rng, queue.filter((k) => k !== 'herald'))
    .concat(queue.filter((k) => k === 'herald'));
}

export function startWave(world, wave) {
  world.wave = wave;
  world.spawnQueue = buildSpawnQueue(world);
  world.spawnTimer = 0.8;
  world.bossAnnounced = false;
  world.waveState = 'spawning';
  announce(world, `WAVE ${wave}`, wave === TOTAL_WAVES ? 'The last night — hold the light!' : `${TOTAL_WAVES - wave} nights remain`);
  if (world.sound) world.sound.waveHorn();
}

function edgePoint(world) {
  const m = ARENA.margin;
  const side = Math.floor(world.rng() * 4);
  if (side === 0) return { x: rngRange(world.rng, m, ARENA.width - m), y: m - 20 };
  if (side === 1) return { x: rngRange(world.rng, m, ARENA.width - m), y: ARENA.height - m + 20 };
  if (side === 2) return { x: m - 20, y: rngRange(world.rng, m, ARENA.height - m) };
  return { x: ARENA.width - m + 20, y: rngRange(world.rng, m, ARENA.height - m) };
}

function spawnEnemy(world, kind) {
  const def = ENEMIES[kind];
  const at = kind === 'herald'
    ? { x: ARENA.width / 2, y: ARENA.margin + 60 }
    : edgePoint(world);
  const enemy = {
    kind,
    x: at.x,
    y: at.y,
    vx: 0,
    vy: 0,
    radius: def.radius,
    hp: def.hp,
    maxHp: def.hp,
    speed: def.speed * rngRange(world.rng, 0.9, 1.15),
    angle: world.rng() * Math.PI * 2,
    zig: world.rng() * Math.PI * 2,
    shootTimer: rngRange(world.rng, 1.2, 2.2),
    burstTimer: 2.5,
    spawnTimer: 5,
    flash: 0,
    wobble: world.rng() * Math.PI * 2,
  };
  world.enemies.push(enemy);
  if (kind === 'herald') {
    announce(world, 'THE GLOOM HERALD', 'It drinks the lantern light — burn it down!');
    if (world.sound) world.sound.bossRoar();
    world.shake = Math.max(world.shake, 10);
  }
  return enemy;
}

// ---- pickups, damage, death ----------------------------------------------

function dropPickup(world, x, y, kind) {
  world.pickups.push({
    kind,
    x, y,
    vx: rngRange(world.rng, -30, 30),
    vy: rngRange(world.rng, -30, 30),
    life: 9,
    bob: world.rng() * Math.PI * 2,
  });
}

function dropDew(world, x, y, count) {
  for (let i = 0; i < count; i += 1) {
    dropPickup(world, x + rngRange(world.rng, -14, 14), y + rngRange(world.rng, -14, 14), 'dew');
  }
}

function killEnemy(world, enemy, index) {
  const def = ENEMIES[enemy.kind];
  world.enemies.splice(index, 1);
  world.kills += 1;
  world.combo = Math.min(world.combo + 1, COMBO_CAP);
  world.comboTimer = COMBO_WINDOW;
  const gained = addScore(world, def.score);
  addText(world, enemy.x, enemy.y - enemy.radius - 6, `+${gained}`, '#ffe98a', 18);
  burst(world, enemy.x, enemy.y, def.colour, enemy.kind === 'brute' ? 26 : 14, 220, 5);
  ring(world, enemy.x, enemy.y, def.colour, enemy.radius * 3);
  dropDew(world, enemy.x, enemy.y, def.dew);
  if (world.rng() < 0.05) dropPickup(world, enemy.x, enemy.y, 'heart');
  if (world.rng() < 0.03) dropPickup(world, enemy.x, enemy.y, 'star');
  if (enemy.kind === 'brute') {
    for (let i = 0; i < def.splitInto; i += 1) {
      const mote = spawnEnemy(world, 'mote');
      mote.x = enemy.x + rngRange(world.rng, -24, 24);
      mote.y = enemy.y + rngRange(world.rng, -24, 24);
    }
  }
  if (enemy.kind === 'herald') {
    world.novaCharges += 1;
    addText(world, enemy.x, enemy.y - 60, '+1 NOVA', '#c9a7ff', 22);
    burst(world, enemy.x, enemy.y, '#c9a7ff', 60, 320, 6);
    world.shake = Math.max(world.shake, 14);
    world.flash = 0.35;
  }
  if (world.sound) world.sound.enemyDie();
}

function hurtPlayer(world, damage, fromX, fromY) {
  const player = world.player;
  if (player.invuln > 0 || world.screen !== SCREEN_PLAY) return;
  world.hp -= damage;
  player.invuln = PLAYER.invulnSeconds;
  world.combo = 0;
  world.comboTimer = 0;
  world.shake = Math.max(world.shake, 12);
  world.flash = 0.3;
  burst(world, player.x, player.y, '#ff5d7e', 22, 260, 5);
  const dx = player.x - fromX;
  const dy = player.y - fromY;
  const d = Math.hypot(dx, dy) || 1;
  player.vx += (dx / d) * 320;
  player.vy += (dy / d) * 320;
  if (world.sound) world.sound.hurt();
  if (world.hp <= 0) {
    world.hp = 0;
    endRun(world, false);
  }
}

function endRun(world, won) {
  world.screen = won ? SCREEN_WIN : SCREEN_OVER;
  world.waveState = 'done';
  if (world.score > world.best) {
    world.best = world.score;
    saveBest(world.best);
  }
  burst(world, world.player.x, world.player.y, '#ffcf4d', 50, 300, 6);
  if (world.sound) {
    if (won) world.sound.victory();
    else world.sound.gameOver();
  }
}

// ---- upgrades ------------------------------------------------------------

function offerUpgrades(world) {
  const available = UPGRADES.filter((u) => (world.upgrades.taken[u.id] ?? 0) < u.max);
  const pool = available.length >= 3 ? available : UPGRADES;
  world.offered = rngShuffle(world.rng, pool).slice(0, 3);
  world.screen = SCREEN_UPGRADE;
}

export function applyUpgrade(world, index) {
  const choice = world.offered[index];
  if (!choice) return;
  choice.apply(world.upgrades);
  world.upgrades.taken[choice.id] = (world.upgrades.taken[choice.id] ?? 0) + 1;
  if (choice.id === 'vessel') {
    world.hp = Math.min(world.upgrades.maxHearts, world.hp + 1);
  }
  if (world.sound) world.sound.upgradePick();
  burst(world, world.player.x, world.player.y, '#ffd166', 24, 240, 5);
  addText(world, world.player.x, world.player.y - 34, choice.title, '#ffd166', 22);
  startWave(world, world.wave + 1);
  world.screen = SCREEN_PLAY;
}

function fireNova(world) {
  if (world.novaCharges <= 0 || world.screen !== SCREEN_PLAY) return;
  world.novaCharges -= 1;
  world.flash = 0.4;
  world.shake = Math.max(world.shake, 16);
  ring(world, world.player.x, world.player.y, '#c9a7ff', NOVA.radius);
  burst(world, world.player.x, world.player.y, '#c9a7ff', 50, 420, 6);
  for (let i = world.enemies.length - 1; i >= 0; i -= 1) {
    const enemy = world.enemies[i];
    if (dist2(enemy.x, enemy.y, world.player.x, world.player.y) <= NOVA.radius * NOVA.radius) {
      enemy.hp -= NOVA.damage;
      enemy.flash = 0.15;
      if (enemy.hp <= 0) killEnemy(world, enemy, i);
    }
  }
  if (world.sound) world.sound.nova();
}

// ---- per-frame update ------------------------------------------------------

function updatePlayer(world, dt, input) {
  const player = world.player;
  const move = input.moveVector();
  player.vx += move.x * 2400 * dt;
  player.vy += move.y * 2400 * dt;
  // Soft drag so the wisp glides instead of stopping dead.
  player.vx *= Math.pow(0.0001, dt);
  player.vy *= Math.pow(0.0001, dt);
  const maxSpeed = world.upgrades.moveSpeed;
  const speed = Math.hypot(player.vx, player.vy);
  if (speed > maxSpeed) {
    player.vx = (player.vx / speed) * maxSpeed;
    player.vy = (player.vy / speed) * maxSpeed;
  }
  player.x = Math.min(ARENA.width - ARENA.margin - player.radius, Math.max(ARENA.margin + player.radius, player.x + player.vx * dt));
  player.y = Math.min(ARENA.height - ARENA.margin - player.radius, Math.max(ARENA.margin + player.radius, player.y + player.vy * dt));

  // Aim at the mouse when it has moved; otherwise track the nearest foe.
  let aimX = input.aimX;
  let aimY = input.aimY;
  if (!input.aimActive) {
    let nearest = null;
    let nearestD = Infinity;
    world.enemies.forEach((enemy) => {
      const d = dist2(enemy.x, enemy.y, player.x, player.y);
      if (d < nearestD) {
        nearestD = d;
        nearest = enemy;
      }
    });
    if (nearest) {
      aimX = nearest.x;
      aimY = nearest.y;
    } else if (move.x !== 0 || move.y !== 0) {
      aimX = player.x + move.x * 100;
      aimY = player.y + move.y * 100;
    }
  }
  player.aimAngle = Math.atan2(aimY - player.y, aimX - player.x);

  player.invuln = Math.max(0, player.invuln - dt);
  player.trail.unshift({ x: player.x, y: player.y, life: 0.35 });
  if (player.trail.length > 14) player.trail.pop();
  player.trail.forEach((t) => { t.life -= dt; });

  // Firing: a spread of lantern bolts, with crits and piercing from upgrades.
  player.fireTimer -= dt;
  if (input.firing && player.fireTimer <= 0) {
    player.fireTimer = PLAYER.fireInterval * world.upgrades.fireRate;
    const shots = world.upgrades.shots;
    const spreadStep = 0.14;
    for (let i = 0; i < shots; i += 1) {
      const offset = (i - (shots - 1) / 2) * spreadStep;
      const angle = player.aimAngle + offset;
      const crit = world.rng() < world.upgrades.crit;
      world.bullets.push({
        x: player.x + Math.cos(angle) * (player.radius + 8),
        y: player.y + Math.sin(angle) * (player.radius + 8),
        vx: Math.cos(angle) * world.upgrades.bulletSpeed,
        vy: Math.sin(angle) * world.upgrades.bulletSpeed,
        life: world.upgrades.bulletLife,
        damage: crit ? 2 : 1,
        pierce: world.upgrades.pierce,
        crit,
        radius: PLAYER.bulletRadius,
      });
    }
    world.stats.shotsFired += shots;
    if (world.sound) world.sound.shoot();
  }

  // Thorn halo: a burning ring that nibbles anything hugging the player.
  if (world.upgrades.thorns > 0) {
    world.thornTimer = (world.thornTimer ?? 0) - dt;
    if (world.thornTimer <= 0) {
      world.thornTimer = 0.5;
      world.enemies.forEach((enemy) => {
        if (dist2(enemy.x, enemy.y, player.x, player.y) < 78 * 78) {
          enemy.hp -= world.upgrades.thorns;
          enemy.flash = 0.12;
        }
      });
    }
  }
}

function updateEnemies(world, dt) {
  const player = world.player;
  for (let i = world.enemies.length - 1; i >= 0; i -= 1) {
    const enemy = world.enemies[i];
    const def = ENEMIES[enemy.kind];
    enemy.flash = Math.max(0, enemy.flash - dt);
    enemy.wobble += dt * 3;
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const d = Math.hypot(dx, dy) || 1;
    const ux = dx / d;
    const uy = dy / d;

    if (enemy.kind === 'mote') {
      enemy.vx = ux * enemy.speed;
      enemy.vy = uy * enemy.speed;
    } else if (enemy.kind === 'emberbat') {
      const zig = Math.sin(enemy.wobble * 2.2) * 0.9;
      enemy.vx = (ux + -uy * zig) * enemy.speed;
      enemy.vy = (uy + ux * zig) * enemy.speed;
    } else if (enemy.kind === 'spitter') {
      if (d > 300) {
        enemy.vx = ux * enemy.speed;
        enemy.vy = uy * enemy.speed;
      } else if (d < 210) {
        enemy.vx = -ux * enemy.speed;
        enemy.vy = -uy * enemy.speed;
      } else {
        enemy.vx *= 0.9;
        enemy.vy *= 0.9;
      }
      enemy.shootTimer -= dt;
      if (enemy.shootTimer <= 0 && d < 540) {
        enemy.shootTimer = def.shootEvery * rngRange(world.rng, 0.85, 1.2);
        world.ebullets.push({
          x: enemy.x, y: enemy.y,
          vx: ux * def.bulletSpeed, vy: uy * def.bulletSpeed,
          radius: 7, life: 4,
        });
        burst(world, enemy.x, enemy.y, def.colour, 4, 90, 3);
      }
    } else if (enemy.kind === 'brute') {
      enemy.vx = ux * enemy.speed;
      enemy.vy = uy * enemy.speed;
    } else if (enemy.kind === 'herald') {
      enemy.vx = ux * enemy.speed;
      enemy.vy = uy * enemy.speed;
      enemy.burstTimer -= dt;
      if (enemy.burstTimer <= 0) {
        enemy.burstTimer = def.burstEvery;
        const count = 12;
        for (let k = 0; k < count; k += 1) {
          const angle = (k / count) * Math.PI * 2 + world.time;
          world.ebullets.push({
            x: enemy.x, y: enemy.y,
            vx: Math.cos(angle) * 130, vy: Math.sin(angle) * 130,
            radius: 8, life: 5,
          });
        }
        ring(world, enemy.x, enemy.y, def.colour, 120);
      }
      enemy.spawnTimer -= dt;
      if (enemy.spawnTimer <= 0 && world.enemies.length < 34) {
        enemy.spawnTimer = def.spawnEvery;
        const mote = spawnEnemy(world, 'mote');
        mote.x = enemy.x + rngRange(world.rng, -50, 50);
        mote.y = enemy.y + rngRange(world.rng, -50, 50);
      }
    }

    enemy.x += enemy.vx * dt;
    enemy.y += enemy.vy * dt;
    enemy.x = Math.min(ARENA.width - ARENA.margin, Math.max(ARENA.margin, enemy.x));
    enemy.y = Math.min(ARENA.height - ARENA.margin, Math.max(ARENA.margin, enemy.y));

    // Dead from thorns or a nova: remove now, before contact is checked.
    if (enemy.hp <= 0) {
      killEnemy(world, enemy, i);
      continue;
    }

    // Contact with the player hurts, once per invulnerability window.
    const touchR = enemy.radius + player.radius - 4;
    if (dist2(enemy.x, enemy.y, player.x, player.y) < touchR * touchR) {
      hurtPlayer(world, def.touch, enemy.x, enemy.y);
      // Shove the foe back so it cannot chain-hit during the same window.
      enemy.x -= ux * 26;
      enemy.y -= uy * 26;
    }
  }

  // Gentle separation so foes do not pile into one stack.
  for (let a = 0; a < world.enemies.length; a += 1) {
    for (let b = a + 1; b < world.enemies.length; b += 1) {
      const ea = world.enemies[a];
      const eb = world.enemies[b];
      const minD = ea.radius + eb.radius;
      const d2 = dist2(ea.x, ea.y, eb.x, eb.y);
      if (d2 > 0.01 && d2 < minD * minD) {
        const d = Math.sqrt(d2);
        const push = (minD - d) / 2;
        const nx = (eb.x - ea.x) / d;
        const ny = (eb.y - ea.y) / d;
        ea.x -= nx * push;
        ea.y -= ny * push;
        eb.x += nx * push;
        eb.y += ny * push;
      }
    }
  }
}

function updateBullets(world, dt) {
  for (let i = world.bullets.length - 1; i >= 0; i -= 1) {
    const bullet = world.bullets[i];
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;
    let dead = bullet.life <= 0
      || bullet.x < 0 || bullet.x > ARENA.width
      || bullet.y < 0 || bullet.y > ARENA.height;
    if (!dead) {
      for (let j = world.enemies.length - 1; j >= 0; j -= 1) {
        const enemy = world.enemies[j];
        const rr = enemy.radius + bullet.radius;
        if (dist2(bullet.x, bullet.y, enemy.x, enemy.y) < rr * rr) {
          enemy.hp -= bullet.damage;
          enemy.flash = 0.12;
          world.stats.shotsHit += 1;
          burst(world, bullet.x, bullet.y, '#ffe98a', bullet.crit ? 8 : 4, 150, 3);
          if (world.sound) world.sound.hit();
          if (enemy.hp <= 0) killEnemy(world, enemy, j);
          if (bullet.pierce > 0) {
            bullet.pierce -= 1;
          } else {
            dead = true;
          }
          break;
        }
      }
    }
    if (dead) world.bullets.splice(i, 1);
  }

  for (let i = world.ebullets.length - 1; i >= 0; i -= 1) {
    const bullet = world.ebullets[i];
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;
    const player = world.player;
    const rr = bullet.radius + player.radius - 4;
    let dead = bullet.life <= 0
      || bullet.x < 0 || bullet.x > ARENA.width
      || bullet.y < 0 || bullet.y > ARENA.height;
    if (!dead && dist2(bullet.x, bullet.y, player.x, player.y) < rr * rr) {
      hurtPlayer(world, 1, bullet.x - bullet.vx * 0.1, bullet.y - bullet.vy * 0.1);
      dead = true;
    }
    if (dead) world.ebullets.splice(i, 1);
  }
}

function updatePickups(world, dt) {
  const player = world.player;
  for (let i = world.pickups.length - 1; i >= 0; i -= 1) {
    const pickup = world.pickups[i];
    pickup.life -= dt;
    pickup.bob += dt * 4;
    pickup.x += pickup.vx * dt;
    pickup.y += pickup.vy * dt;
    pickup.vx *= Math.pow(0.01, dt);
    pickup.vy *= Math.pow(0.01, dt);
    const d = Math.hypot(player.x - pickup.x, player.y - pickup.y) || 1;
    // Magnet: close pickups drift toward the lantern.
    if (d < world.upgrades.magnet) {
      const pull = 420 * (1 - d / world.upgrades.magnet) + 120;
      pickup.x += ((player.x - pickup.x) / d) * pull * dt;
      pickup.y += ((player.y - pickup.y) / d) * pull * dt;
    }
    if (d < player.radius + 18) {
      if (pickup.kind === 'dew') {
        world.dew += 1;
        const gained = addScore(world, 5);
        addText(world, pickup.x, pickup.y - 10, `+${gained}`, '#8ef7ff', 14);
        if (world.sound) world.sound.pickup();
      } else if (pickup.kind === 'heart') {
        world.hp = Math.min(world.upgrades.maxHearts, world.hp + 1);
        addText(world, pickup.x, pickup.y - 10, '+1 ♥', '#ff5d7e', 18);
        if (world.sound) world.sound.heart();
      } else if (pickup.kind === 'star') {
        world.novaCharges += 1;
        addText(world, pickup.x, pickup.y - 10, '+1 NOVA ★', '#c9a7ff', 18);
        if (world.sound) world.sound.heart();
      }
      burst(world, pickup.x, pickup.y, pickup.kind === 'dew' ? '#8ef7ff' : pickup.kind === 'heart' ? '#ff5d7e' : '#c9a7ff', 6, 120, 3);
      world.pickups.splice(i, 1);
    } else if (pickup.life <= 0) {
      world.pickups.splice(i, 1);
    }
  }
}

function updateFx(world, dt) {
  for (let i = world.particles.length - 1; i >= 0; i -= 1) {
    const p = world.particles[i];
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= Math.pow(0.02, dt);
    p.vy *= Math.pow(0.02, dt);
    if (p.life <= 0) world.particles.splice(i, 1);
  }
  for (let i = world.texts.length - 1; i >= 0; i -= 1) {
    const t = world.texts[i];
    t.life -= dt;
    t.y -= 34 * dt;
    if (t.life <= 0) world.texts.splice(i, 1);
  }
  if (world.banner) {
    world.banner.timer -= dt;
    if (world.banner.timer <= 0) world.banner = null;
  }
  world.shake = Math.max(0, world.shake - dt * 34);
  world.flash = Math.max(0, world.flash - dt * 1.4);
  if (world.comboTimer > 0) {
    world.comboTimer -= dt;
    if (world.comboTimer <= 0) world.combo = 0;
  }
}

// ---- the one step every frame and every screenshot runs --------------------

export function stepWorld(world, dt, input) {
  world.time += dt;

  if (world.screen === SCREEN_TITLE) {
    // A quiet demo drifts behind the title so the menu feels alive.
    updateFx(world, dt);
    return;
  }

  if (world.screen === SCREEN_PAUSED) {
    if (input.wasPressed('KeyP') || input.wasPressed('Escape')) {
      world.screen = world.screenBeforePause;
    }
    return;
  }

  if (world.screen === SCREEN_UPGRADE) {
    updateFx(world, dt);
    const click = input.consumeClick();
    if (click) {
      const picked = pickCardAt(world, click.x, click.y);
      if (picked >= 0) applyUpgrade(world, picked);
    }
    if (input.wasPressed('Digit1')) applyUpgrade(world, 0);
    if (input.wasPressed('Digit2')) applyUpgrade(world, 1);
    if (input.wasPressed('Digit3')) applyUpgrade(world, 2);
    return;
  }

  if (world.screen === SCREEN_OVER || world.screen === SCREEN_WIN) {
    updateFx(world, dt);
    if (input.wasPressed('KeyR') || input.wasPressed('Enter') || input.wasPressed('Space')) {
      restartRun(world);
    }
    const click = input.consumeClick();
    if (click && click.y > ARENA.height - 150) restartRun(world);
    return;
  }

  // SCREEN_PLAY
  world.stats.timePlayed += dt;
  if (input.wasPressed('KeyP') || input.wasPressed('Escape')) {
    world.screenBeforePause = SCREEN_PLAY;
    world.screen = SCREEN_PAUSED;
    return;
  }
  if (input.wasPressed('KeyE')) fireNova(world);
  if (input.wasPressed('KeyM') && world.sound) {
    world.sound.setMuted(!world.sound.muted);
  }

  updatePlayer(world, dt, input);

  // Spawn the wave's queue on its timer until it runs dry.
  if (world.spawnQueue.length > 0) {
    world.spawnTimer -= dt;
    if (world.spawnTimer <= 0) {
      world.spawnTimer = spawnGap(world.wave);
      spawnEnemy(world, world.spawnQueue.shift());
    }
  } else if (world.enemies.length === 0 && world.waveState === 'spawning') {
    // Wave cleared: bank the bonus, then offer upgrades or the win screen.
    world.waveState = 'cleared';
    world.stats.wavesCleared += 1;
    const bonus = 100 * world.wave;
    world.score += bonus;
    addText(world, ARENA.width / 2, 262, `WAVE ${world.wave} CLEAR  +${bonus}`, '#ffd166', 30);
    burst(world, world.player.x, world.player.y, '#ffd166', 40, 300, 5);
    if (world.wave >= TOTAL_WAVES) {
      endRun(world, true);
    } else {
      offerUpgrades(world);
    }
  }

  updateEnemies(world, dt);
  updateBullets(world, dt);
  updatePickups(world, dt);
  updateFx(world, dt);
}

export function restartRun(world) {
  const seed = world.seed;
  const best = world.best;
  const fresh = createWorld(seed + 7919);
  Object.keys(world).forEach((key) => delete world[key]);
  Object.assign(world, fresh);
  world.best = Math.max(best, world.best);
  world.seed = seed;
  startWave(world, 1);
  world.screen = SCREEN_PLAY;
}

// Card hit-boxes live in render.js too; keep the geometry in one function.
export function cardRect(index) {
  const w = 300;
  const h = 220;
  const gap = 36;
  const total = w * 3 + gap * 2;
  const x0 = (ARENA.width - total) / 2;
  return {
    x: x0 + index * (w + gap),
    y: 300,
    width: w,
    height: h,
  };
}

export function pickCardAt(world, x, y) {
  for (let i = 0; i < world.offered.length; i += 1) {
    const r = cardRect(i);
    if (x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height) return i;
  }
  return -1;
}

export function startRun(world) {
  resetWorld(world);
  startWave(world, 1);
  world.screen = SCREEN_PLAY;
}
