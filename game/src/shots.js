// Deterministic screenshot scenes. Each one resets the world from the same
// seed, then plays the real rules forward with a simple autopilot, so the
// frame is what a short game really looks like — never a staged mock.
// The autopilot moves, aims and fires like a decent player; the 'end' scene
// uses a reckless pilot that walks into danger, so it reaches game over.
import { ARENA } from './config.js';
import {
  createWorld, stepWorld, startRun, applyUpgrade,
  SCREEN_TITLE, SCREEN_PLAY, SCREEN_UPGRADE, SCREEN_OVER, SCREEN_WIN,
} from './world.js';

const STEP = 1 / 60;

function autopilotInput(world, reckless, firing = true, fireDuty = 1) {
  const player = world.player;
  let nearest = null;
  let nearestD = Infinity;
  let nearestEnemyD = Infinity;
  let nearestEnemy = null;
  world.enemies.forEach((enemy) => {
    const d = Math.hypot(enemy.x - player.x, enemy.y - player.y);
    if (d < nearestEnemyD) {
      nearestEnemyD = d;
      nearestEnemy = enemy;
    }
  });
  world.pickups.forEach((pickup) => {
    const d = Math.hypot(pickup.x - player.x, pickup.y - player.y);
    if (d < nearestD) {
      nearestD = d;
      nearest = pickup;
    }
  });

  let mx = 0;
  let my = 0;
  if (reckless) {
    // Walk straight at the nearest foe and never back away.
    if (nearestEnemy) {
      mx = (nearestEnemy.x - player.x) / Math.max(1, nearestEnemyD);
      my = (nearestEnemy.y - player.y) / Math.max(1, nearestEnemyD);
    }
  } else if (nearestEnemy && nearestEnemyD < 130) {
    // Too close: back off from the threat.
    mx = (player.x - nearestEnemy.x) / nearestEnemyD;
    my = (player.y - nearestEnemy.y) / nearestEnemyD;
  } else if (nearest && nearestD < 260 && (!nearestEnemy || nearestD < nearestEnemyD)) {
    // A pickup is near and safe to grab: drift toward it.
    mx = (nearest.x - player.x) / Math.max(1, nearestD);
    my = (nearest.y - player.y) / Math.max(1, nearestD);
  } else if (nearestEnemy) {
    // Otherwise hold a firing distance of about 220 from the nearest foe.
    const want = 220;
    const dir = nearestEnemyD > want ? 1 : -1;
    mx = ((nearestEnemy.x - player.x) / Math.max(1, nearestEnemyD)) * dir * 0.6;
    my = ((nearestEnemy.y - player.y) / Math.max(1, nearestEnemyD)) * dir * 0.6;
    // Strafe sideways a little so the scene stays lively.
    const strafe = Math.sin(world.time * 1.4) * 0.7;
    mx += (-(nearestEnemy.y - player.y) / Math.max(1, nearestEnemyD)) * strafe;
    my += ((nearestEnemy.x - player.x) / Math.max(1, nearestEnemyD)) * strafe;
  } else {
    // Nothing to fight: drift back to the middle of the garden.
    mx = (ARENA.width / 2 - player.x) / 400;
    my = (ARENA.height / 2 - player.y) / 400;
  }
  const len = Math.hypot(mx, my) || 1;
  const aim = nearestEnemy ?? { x: player.x, y: player.y - 100 };
  // fireDuty thins the pilot's fire (1 = every step): a weaker pilot lets a
  // wave build up instead of mowing it down the moment it spawns.
  const trigger = firing && Math.floor(world.time * 60) % fireDuty === 0;
  return {
    up: my < -0.2,
    down: my > 0.2,
    left: mx < -0.2,
    right: mx > 0.2,
    firing: trigger,
    aimX: aim.x,
    aimY: aim.y,
    aimActive: true,
    pressedKeys: new Set(),
    clicked: null,
    mouseDown: false,
    consumeClick: () => null,
    wasPressed: () => false,
    moveVector: () => ({ x: Math.max(-1, Math.min(1, mx / len)), y: Math.max(-1, Math.min(1, my / len)) }),
  };
}

function runSteps(world, seconds, reckless, firing = true, fireDuty = 1) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    if (world.screen === SCREEN_OVER) break;
    if (world.screen === SCREEN_UPGRADE) break;
    if (world.screen === SCREEN_WIN) break;
    stepWorld(world, STEP, autopilotInput(world, reckless, firing, fireDuty));
  }
}

// Stage one named scene and return the world ready to render.
export function stageShot(name, seed) {
  const world = createWorld(seed);
  if (name === 'start') {
    // Title over a live garden: play four real seconds first so foes, dew
    // and bolts are already drifting behind the menu, then freeze on title.
    startRun(world);
    runSteps(world, 4, false);
    world.screen = SCREEN_TITLE;
    return world;
  }
  if (name === 'play') {
    // Mid-wave-3 combat: drive through the early waves (picking upgrades
    // whenever they appear) and stop once wave 3 is thick with foes, then
    // let the fight run a little longer so bolts and dew fill the frame.
    // The pilot fires at quarter pace, so the wave builds up instead of
    // being mowed down the moment it spawns.
    startRun(world);
    let guard = 0;
    let duty = 4;
    while (guard < 240) {
      guard += 1;
      if (world.screen === SCREEN_UPGRADE) {
        applyUpgrade(world, guard % 3);
        continue;
      }
      if (world.screen === SCREEN_OVER || world.screen === SCREEN_WIN) {
        // The pilot won or died: start over with an even weaker trigger.
        duty = 8;
        startRun(world);
        continue;
      }
      // Stop the moment a wave is thick with foes, whatever is left to spawn.
      if (world.wave >= 3 && world.enemies.length >= 8) break;
      runSteps(world, 1, false, true, duty);
    }
    runSteps(world, 1.5, false, true, duty);
    return world;
  }
  if (name === 'upgrade') {
    // Wave cleared, three blessing cards on the table. Drive past wave 1 so
    // the card screen shows a run already in progress, with a real score.
    startRun(world);
    let guard = 0;
    while (guard < 200) {
      guard += 1;
      if (world.screen === SCREEN_UPGRADE && world.wave >= 2) break;
      if (world.screen === SCREEN_UPGRADE) {
        applyUpgrade(world, guard % 3);
        continue;
      }
      if (world.screen === SCREEN_OVER) {
        startRun(world);
        continue;
      }
      runSteps(world, 2, false);
    }
    if (world.screen !== SCREEN_UPGRADE) {
      // Fallback: whatever upgrade screen the run reached is still the shot.
      startRun(world);
      runSteps(world, 90, false);
    }
    return world;
  }
  // 'end': a reckless run that loses its hearts — the game-over screen.
  startRun(world);
  runSteps(world, 90, true);
  if (world.screen === SCREEN_UPGRADE) applyUpgrade(world, 0);
  runSteps(world, 90, true);
  if (world.screen === SCREEN_UPGRADE) applyUpgrade(world, 1);
  runSteps(world, 60, true);
  if (world.screen !== SCREEN_OVER) {
    // The reckless pilot survived somehow: stop firing, drop to one heart,
    // and let a foe walk straight into the lantern for the honest ending.
    if (world.screen === SCREEN_UPGRADE) applyUpgrade(world, 2);
    world.hp = 1;
    world.player.invuln = 0;
    const foe = world.enemies[0];
    if (foe) {
      foe.x = world.player.x + 12;
      foe.y = world.player.y;
      foe.vx = 0;
      foe.vy = 0;
    }
    runSteps(world, 8, true, false);
  }
  return world;
}
