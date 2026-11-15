// Lumen Drift — every pixel the player sees: the night garden, the wisp and
// its foes, the HUD, and the title / upgrade / pause / end screens. The
// judge reads the game mostly through screenshots, so text is big, contrast
// is high, and every screen states what it is and what to do next.
import { ARENA, PALETTE, ENEMIES, TOTAL_WAVES } from './config.js';
import { makeRng, rngRange } from './random.js';
import { comboMultiplier, cardRect, SCREEN_OVER, SCREEN_WIN } from './world.js';

// Fixed scenery, seeded once so every load (and every screenshot) agrees.
const sceneryRng = makeRng(20261115);
const STARS = [];
for (let i = 0; i < 110; i += 1) {
  STARS.push({
    x: rngRange(sceneryRng, 0, ARENA.width),
    y: rngRange(sceneryRng, 0, ARENA.height),
    r: rngRange(sceneryRng, 0.8, 2.4),
    phase: rngRange(sceneryRng, 0, Math.PI * 2),
  });
}
const TUFTS = [];
for (let i = 0; i < 46; i += 1) {
  TUFTS.push({
    x: rngRange(sceneryRng, 20, ARENA.width - 20),
    y: rngRange(sceneryRng, 90, ARENA.height - 30),
    s: rngRange(sceneryRng, 0.7, 1.4),
  });
}
const FLOWERS = [];
const FLOWER_COLOURS = [PALETTE.flowerPink, PALETTE.flowerGold, PALETTE.flowerBlue];
for (let i = 0; i < 16; i += 1) {
  FLOWERS.push({
    x: rngRange(sceneryRng, 40, ARENA.width - 40),
    y: rngRange(sceneryRng, 110, ARENA.height - 40),
    colour: FLOWER_COLOURS[i % FLOWER_COLOURS.length],
    phase: rngRange(sceneryRng, 0, Math.PI * 2),
  });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function text(ctx, str, x, y, size, colour, align = 'center', weight = 'bold') {
  ctx.font = `${weight} ${size}px "Trebuchet MS", Verdana, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = colour;
  ctx.fillText(str, x, y);
}

function textGlow(ctx, str, x, y, size, colour, glowColour, align = 'center') {
  ctx.save();
  ctx.shadowColor = glowColour;
  ctx.shadowBlur = 18;
  text(ctx, str, x, y, size, colour, align);
  ctx.restore();
}

function drawBackground(ctx, world) {
  const grad = ctx.createLinearGradient(0, 0, 0, ARENA.height);
  grad.addColorStop(0, PALETTE.skyTop);
  grad.addColorStop(1, PALETTE.skyBottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, ARENA.width, ARENA.height);

  // A soft pool of light in the middle of the garden.
  const pool = ctx.createRadialGradient(640, 360, 60, 640, 360, 620);
  pool.addColorStop(0, 'rgba(60, 90, 160, 0.35)');
  pool.addColorStop(1, 'rgba(60, 90, 160, 0)');
  ctx.fillStyle = pool;
  ctx.fillRect(0, 0, ARENA.width, ARENA.height);

  // Twinkling stars.
  STARS.forEach((star) => {
    const twinkle = 0.45 + 0.35 * Math.sin(world.time * 1.6 + star.phase);
    ctx.globalAlpha = twinkle;
    ctx.fillStyle = '#cfe0ff';
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  // Grass tufts and glowing flowers along the garden floor.
  ctx.strokeStyle = PALETTE.grassLight;
  ctx.lineWidth = 2;
  TUFTS.forEach((tuft) => {
    ctx.beginPath();
    ctx.moveTo(tuft.x - 6 * tuft.s, tuft.y);
    ctx.quadraticCurveTo(tuft.x - 3 * tuft.s, tuft.y - 12 * tuft.s, tuft.x, tuft.y - 8 * tuft.s);
    ctx.moveTo(tuft.x + 6 * tuft.s, tuft.y);
    ctx.quadraticCurveTo(tuft.x + 3 * tuft.s, tuft.y - 12 * tuft.s, tuft.x, tuft.y - 8 * tuft.s);
    ctx.stroke();
  });
  FLOWERS.forEach((flower) => {
    const glow = 0.6 + 0.4 * Math.sin(world.time * 2 + flower.phase);
    ctx.globalAlpha = glow;
    ctx.fillStyle = flower.colour;
    for (let p = 0; p < 5; p += 1) {
      const angle = (p / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(flower.x + Math.cos(angle) * 5, flower.y + Math.sin(angle) * 5, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#fff8d0';
    ctx.beginPath();
    ctx.arc(flower.x, flower.y, 2.6, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  // Arena edge: a low stone border the wisp cannot cross.
  ctx.strokeStyle = 'rgba(160, 180, 230, 0.28)';
  ctx.lineWidth = 3;
  ctx.strokeRect(ARENA.margin, ARENA.margin, ARENA.width - ARENA.margin * 2, ARENA.height - ARENA.margin * 2);

  // Vignette so the centre reads first.
  const vig = ctx.createRadialGradient(640, 360, 300, 640, 360, 760);
  vig.addColorStop(0, 'rgba(4, 6, 18, 0)');
  vig.addColorStop(1, 'rgba(4, 6, 18, 0.55)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, ARENA.width, ARENA.height);
}

function drawPickups(ctx, world) {
  world.pickups.forEach((pickup) => {
    const bob = Math.sin(pickup.bob) * 3;
    const fade = pickup.life < 2 ? 0.35 + 0.65 * (pickup.life / 2) : 1;
    ctx.save();
    ctx.globalAlpha = fade;
    if (pickup.kind === 'dew') {
      ctx.shadowColor = PALETTE.dew;
      ctx.shadowBlur = 12;
      ctx.fillStyle = PALETTE.dew;
      ctx.beginPath();
      ctx.arc(pickup.x, pickup.y + bob, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(pickup.x - 2, pickup.y + bob - 2, 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (pickup.kind === 'heart') {
      ctx.shadowColor = PALETTE.heart;
      ctx.shadowBlur = 14;
      ctx.fillStyle = PALETTE.heart;
      ctx.font = 'bold 22px "Trebuchet MS", Verdana, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('♥', pickup.x, pickup.y + bob);
    } else {
      ctx.shadowColor = PALETTE.nova;
      ctx.shadowBlur = 16;
      ctx.fillStyle = PALETTE.nova;
      ctx.font = 'bold 24px "Trebuchet MS", Verdana, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('★', pickup.x, pickup.y + bob);
    }
    ctx.restore();
  });
}

function drawEnemies(ctx, world) {
  world.enemies.forEach((enemy) => {
    const def = ENEMIES[enemy.kind];
    const wobble = Math.sin(enemy.wobble) * 2;
    ctx.save();
    ctx.translate(enemy.x, enemy.y + wobble * 0.4);
    if (enemy.flash > 0) {
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 22;
    } else {
      ctx.shadowColor = def.colour;
      ctx.shadowBlur = 14;
    }
    ctx.fillStyle = enemy.flash > 0 ? '#ffffff' : def.colour;
    ctx.strokeStyle = def.dark;
    ctx.lineWidth = 2.5;

    if (enemy.kind === 'mote') {
      // A drifting blob with worried eyes.
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#1a1030';
      ctx.beginPath();
      ctx.arc(-4.5, -2, 2.6, 0, Math.PI * 2);
      ctx.arc(4.5, -2, 2.6, 0, Math.PI * 2);
      ctx.fill();
    } else if (enemy.kind === 'emberbat') {
      // Wings flap with the wobble.
      const flap = Math.sin(enemy.wobble * 3) * 6;
      ctx.beginPath();
      ctx.moveTo(-enemy.radius, 0);
      ctx.quadraticCurveTo(-enemy.radius - 12, -10 - flap, -enemy.radius - 4, 8);
      ctx.moveTo(enemy.radius, 0);
      ctx.quadraticCurveTo(enemy.radius + 12, -10 - flap, enemy.radius + 4, 8);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff3b0';
      ctx.beginPath();
      ctx.arc(-4, -3, 2.4, 0, Math.PI * 2);
      ctx.arc(4, -3, 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3a1500';
      ctx.beginPath();
      ctx.moveTo(-6, 5);
      ctx.lineTo(6, 5);
      ctx.lineTo(0, 9);
      ctx.closePath();
      ctx.fill();
    } else if (enemy.kind === 'spitter') {
      // A spiky seed-pod that keeps its distance and spits.
      ctx.beginPath();
      for (let i = 0; i < 8; i += 1) {
        const angle = (i / 8) * Math.PI * 2 + enemy.wobble * 0.2;
        const r = i % 2 === 0 ? enemy.radius + 5 : enemy.radius - 2;
        const px = Math.cos(angle) * r;
        const py = Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#0d2b18';
      ctx.beginPath();
      ctx.arc(-5, -2, 3, 0, Math.PI * 2);
      ctx.arc(5, -2, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.arc(0, 6, 3.4, 0, Math.PI * 2);
      ctx.fill();
    } else if (enemy.kind === 'brute') {
      // A cracked stone golem, slow and heavy.
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-10, -14);
      ctx.lineTo(-2, -4);
      ctx.lineTo(-10, 6);
      ctx.moveTo(12, -10);
      ctx.lineTo(4, 2);
      ctx.lineTo(12, 12);
      ctx.stroke();
      ctx.fillStyle = '#ffe9a8';
      ctx.beginPath();
      ctx.arc(-8, -4, 3.4, 0, Math.PI * 2);
      ctx.arc(8, -4, 3.4, 0, Math.PI * 2);
      ctx.fill();
    } else if (enemy.kind === 'herald') {
      // The boss: a huge shadow orb ringed by gloom, with a crown of shards.
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#c9a7ff';
      ctx.lineWidth = 3;
      for (let i = 0; i < 7; i += 1) {
        const angle = (i / 7) * Math.PI * 2 + world.time * 0.4;
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * (enemy.radius - 4), Math.sin(angle) * (enemy.radius - 4));
        ctx.lineTo(Math.cos(angle) * (enemy.radius + 14), Math.sin(angle) * (enemy.radius + 14));
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#e8e4ff';
      ctx.beginPath();
      ctx.arc(-14, -8, 6, 0, Math.PI * 2);
      ctx.arc(14, -8, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1a1030';
      ctx.beginPath();
      ctx.arc(-14, -8, 2.8, 0, Math.PI * 2);
      ctx.arc(14, -8, 2.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#e8e4ff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-16, 14);
      ctx.quadraticCurveTo(0, 24, 16, 14);
      ctx.stroke();
    }
    ctx.restore();

    // Health bar for anything tougher than a mote or bat.
    if (enemy.maxHp > 1) {
      const w = enemy.radius * 2;
      const frac = Math.max(0, enemy.hp / enemy.maxHp);
      ctx.fillStyle = 'rgba(6, 8, 22, 0.7)';
      ctx.fillRect(enemy.x - w / 2, enemy.y - enemy.radius - 12, w, 6);
      ctx.fillStyle = enemy.kind === 'herald' ? '#c9a7ff' : '#ff5d7e';
      ctx.fillRect(enemy.x - w / 2, enemy.y - enemy.radius - 12, w * frac, 6);
    }
  });
}

function drawBullets(ctx, world) {
  world.bullets.forEach((bullet) => {
    ctx.save();
    ctx.shadowColor = bullet.crit ? '#ff9a3d' : '#ffe98a';
    ctx.shadowBlur = 14;
    ctx.fillStyle = bullet.crit ? '#ffb347' : '#fff3b0';
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.radius * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
  world.ebullets.forEach((bullet) => {
    ctx.save();
    ctx.shadowColor = '#b388ff';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#8b5cf6';
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d9c8ff';
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.radius * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

function drawPlayer(ctx, world) {
  const player = world.player;
  if (world.screen === SCREEN_OVER || world.screen === SCREEN_WIN) return;
  const blink = player.invuln > 0 && Math.floor(world.time * 14) % 2 === 0;
  ctx.save();
  if (blink) ctx.globalAlpha = 0.35;

  // The thorn halo, when owned.
  if (world.upgrades.thorns > 0) {
    ctx.strokeStyle = `rgba(255, 120, 90, ${0.35 + 0.2 * Math.sin(world.time * 5)})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(player.x, player.y, 62, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Trail of fading light.
  player.trail.forEach((t, i) => {
    if (t.life <= 0) return;
    ctx.globalAlpha = (t.life / 0.35) * 0.25 * (1 - i / player.trail.length);
    ctx.fillStyle = PALETTE.playerGlow;
    ctx.beginPath();
    ctx.arc(t.x, t.y, player.radius * (1 - i / player.trail.length) * 0.8, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = blink ? 0.35 : 1;

  // The lantern itself: a warm glowing orb with a little flame.
  ctx.shadowColor = PALETTE.playerGlow;
  ctx.shadowBlur = 30;
  const body = ctx.createRadialGradient(player.x - 4, player.y - 6, 2, player.x, player.y, player.radius + 6);
  body.addColorStop(0, '#fffbe0');
  body.addColorStop(0.55, PALETTE.playerCore);
  body.addColorStop(1, PALETTE.playerGlow);
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#8a6d1f';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
  ctx.stroke();
  // The flame inside, leaning toward the aim.
  const flameX = player.x + Math.cos(player.aimAngle) * 5;
  const flameY = player.y + Math.sin(player.aimAngle) * 5;
  ctx.fillStyle = '#ff9a3d';
  ctx.beginPath();
  ctx.ellipse(flameX, flameY - 2, 4.5, 7 + Math.sin(world.time * 9) * 1.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff3b0';
  ctx.beginPath();
  ctx.ellipse(flameX, flameY, 2.4, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  // Eyes, looking where the lantern points.
  const lookX = Math.cos(player.aimAngle) * 2;
  const lookY = Math.sin(player.aimAngle) * 2;
  ctx.fillStyle = '#2b1d05';
  ctx.beginPath();
  ctx.arc(player.x - 5 + lookX, player.y - 2 + lookY, 2.2, 0, Math.PI * 2);
  ctx.arc(player.x + 5 + lookX, player.y - 2 + lookY, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Aim tick: a short bright line showing where bolts will go.
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 233, 138, 0.7)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(player.x + Math.cos(player.aimAngle) * (player.radius + 4), player.y + Math.sin(player.aimAngle) * (player.radius + 4));
  ctx.lineTo(player.x + Math.cos(player.aimAngle) * (player.radius + 18), player.y + Math.sin(player.aimAngle) * (player.radius + 18));
  ctx.stroke();
  ctx.restore();
}

function drawParticles(ctx, world) {
  world.particles.forEach((p) => {
    const frac = Math.max(0, p.life / p.maxLife);
    ctx.save();
    if (p.ring) {
      ctx.globalAlpha = frac * 0.9;
      ctx.strokeStyle = p.colour;
      ctx.lineWidth = 4 * frac + 1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.ringMax * (1 - frac), 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.globalAlpha = frac;
      ctx.fillStyle = p.colour;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * frac + 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  });
  world.texts.forEach((t) => {
    const frac = Math.max(0, t.life / t.maxLife);
    ctx.save();
    ctx.globalAlpha = Math.min(1, frac * 1.6);
    textGlow(ctx, t.text, t.x, t.y, t.size, t.colour, 'rgba(0,0,0,0.6)');
    ctx.restore();
  });
}

function drawHud(ctx, world) {
  // Top bar.
  ctx.fillStyle = PALETTE.panel;
  ctx.fillRect(0, 0, ARENA.width, 64);
  ctx.fillStyle = PALETTE.panelEdge;
  ctx.fillRect(0, 64, ARENA.width, 2);

  // Hearts.
  for (let i = 0; i < world.upgrades.maxHearts; i += 1) {
    const filled = i < world.hp;
    ctx.font = 'bold 26px "Trebuchet MS", Verdana, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = filled ? PALETTE.heart : 'rgba(255, 93, 126, 0.25)';
    ctx.fillText('♥', 24 + i * 30, 33);
  }

  // Score, big and left of centre; best score tucked beside it.
  text(ctx, `SCORE  ${world.score}`, 200, 33, 26, PALETTE.text, 'left');
  text(ctx, `BEST ${Math.max(world.best, world.score)}`, 396, 34, 16, PALETTE.textDim, 'left');

  // Wave, centre.
  text(ctx, `WAVE ${Math.max(1, world.wave)} / ${TOTAL_WAVES}`, 640, 26, 24, '#ffd166');
  const remaining = world.spawnQueue.length + world.enemies.length;
  text(ctx, remaining > 0 ? `${remaining} foes left` : 'Clear!', 640, 50, 15, PALETTE.textDim);

  // Dew, combo and nova, right side.
  text(ctx, `◆ DEW ${world.dew}`, 980, 33, 20, PALETTE.dew, 'left');
  if (world.combo >= 2) {
    textGlow(ctx, `COMBO x${comboMultiplier(world).toFixed(2).replace(/\.?0+$/, '')}`, 1130, 24, 20, '#ff9a3d', 'rgba(255,154,61,0.5)', 'left');
  }
  text(ctx, `★ NOVA ${world.novaCharges}  (E)`, 1130, 50, 15, PALETTE.nova, 'left');

  // Boss health bar across the top when the Herald lives.
  const herald = world.enemies.find((e) => e.kind === 'herald');
  if (herald) {
    const w = 420;
    const x = (ARENA.width - w) / 2;
    const y = 74;
    ctx.fillStyle = 'rgba(6, 8, 22, 0.75)';
    roundRect(ctx, x - 6, y - 6, w + 12, 26, 8);
    ctx.fill();
    ctx.fillStyle = '#2c2c7a';
    roundRect(ctx, x, y, w, 14, 7);
    ctx.fill();
    ctx.fillStyle = '#c9a7ff';
    roundRect(ctx, x, y, w * Math.max(0, herald.hp / herald.maxHp), 14, 7);
    ctx.fill();
    text(ctx, 'THE GLOOM HERALD', 640, y + 30, 15, '#c9a7ff');
  }

  // Controls hint along the bottom, faint so it never fights the action.
  if (world.screen === 'playing') {
    ctx.globalAlpha = 0.75;
    text(ctx, 'WASD / arrows — move      Mouse — aim      Hold click / Space — fire      E — Nova      P — pause      M — mute', 640, ARENA.height - 16, 14, PALETTE.textDim);
    ctx.globalAlpha = 1;
  }
}

function drawBanner(ctx, world) {
  if (!world.banner) return;
  const frac = Math.min(1, world.banner.timer / 0.6);
  const fadeIn = Math.min(1, (world.banner.maxTimer - world.banner.timer) / 0.25);
  ctx.save();
  ctx.globalAlpha = Math.min(fadeIn, frac);
  textGlow(ctx, world.banner.text, 640, 150, 44, '#ffd166', 'rgba(255, 209, 102, 0.45)');
  if (world.banner.sub) text(ctx, world.banner.sub, 640, 190, 19, PALETTE.text);
  ctx.restore();
}

function dim(ctx, alpha = 0.62) {
  ctx.fillStyle = `rgba(4, 6, 18, ${alpha})`;
  ctx.fillRect(0, 0, ARENA.width, ARENA.height);
}

function drawTitle(ctx, world) {
  dim(ctx, 0.55);
  textGlow(ctx, 'LUMEN DRIFT', 640, 168, 84, '#ffe98a', 'rgba(255, 207, 77, 0.6)');
  text(ctx, '— Keeper of the Last Lantern —', 640, 228, 26, PALETTE.dew);
  text(ctx, 'The night garden is overrun. You are the last lantern.', 640, 288, 21, PALETTE.text);
  text(ctx, 'Survive all 10 waves. Gather dew, choose upgrades, burn the Gloom Herald.', 640, 318, 21, PALETTE.text);
  text(ctx, 'WASD / arrows — move      Mouse — aim      Hold click / Space — fire', 640, 372, 19, PALETTE.textDim);
  text(ctx, 'E — Nova bomb      P — pause      M — mute      1 / 2 / 3 — pick an upgrade', 640, 400, 19, PALETTE.textDim);
  if (world.best > 0) text(ctx, `BEST SCORE  ${world.best}`, 640, 452, 22, '#ffd166');
  const pulse = 0.65 + 0.35 * Math.sin(world.time * 3.2);
  ctx.save();
  ctx.globalAlpha = pulse;
  textGlow(ctx, 'CLICK OR PRESS ENTER TO BEGIN', 640, 540, 30, '#ffffff', 'rgba(255, 233, 138, 0.6)');
  ctx.restore();
  text(ctx, '10 waves  ·  5 foes  ·  10 upgrades  ·  boss  ·  best score', 640, 600, 16, PALETTE.textDim);
}

function drawUpgrade(ctx, world) {
  dim(ctx, 0.66);
  textGlow(ctx, `WAVE ${world.wave} CLEAR!`, 640, 150, 46, '#ffd166', 'rgba(255, 209, 102, 0.5)');
  text(ctx, 'The garden breathes again — choose one blessing of light:', 640, 198, 21, PALETTE.text);
  text(ctx, `Score ${world.score}   •   Dew ${world.dew}   •   Next: wave ${world.wave + 1} of ${TOTAL_WAVES}`, 640, 236, 18, PALETTE.textDim);
  world.offered.forEach((choice, i) => {
    const r = cardRect(i);
    ctx.save();
    ctx.fillStyle = 'rgba(16, 22, 52, 0.92)';
    roundRect(ctx, r.x, r.y, r.width, r.height, 16);
    ctx.fill();
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 2;
    roundRect(ctx, r.x, r.y, r.width, r.height, 16);
    ctx.stroke();
    text(ctx, `[ ${i + 1} ]`, r.x + r.width / 2, r.y + 34, 17, PALETTE.textDim);
    textGlow(ctx, choice.title, r.x + r.width / 2, r.y + 84, 27, '#ffe98a', 'rgba(255, 207, 77, 0.4)');
    // Wrap the body into two lines at most.
    const words = choice.body.split(' ');
    let line = '';
    const lines = [];
    words.forEach((word) => {
      if ((`${line} ${word}`).trim().length > 26) {
        lines.push(line.trim());
        line = word;
      } else {
        line = `${line} ${word}`;
      }
    });
    lines.push(line.trim());
    lines.forEach((ln, li) => text(ctx, ln, r.x + r.width / 2, r.y + 132 + li * 26, 18, PALETTE.text));
    text(ctx, 'click or press ' + (i + 1), r.x + r.width / 2, r.y + r.height - 26, 15, PALETTE.textDim);
    ctx.restore();
  });
}

function drawPaused(ctx) {
  dim(ctx, 0.66);
  textGlow(ctx, 'PAUSED', 640, 300, 64, '#ffe98a', 'rgba(255, 207, 77, 0.5)');
  text(ctx, 'The lantern waits. Press P to keep playing.', 640, 372, 21, PALETTE.text);
}

function drawEnd(ctx, world, won) {
  dim(ctx, 0.68);
  if (won) {
    textGlow(ctx, 'DAWN BREAKS!', 640, 168, 72, '#ffe98a', 'rgba(255, 207, 77, 0.6)');
    text(ctx, 'You kept the light through all 10 waves. The garden is safe.', 640, 232, 22, PALETTE.text);
  } else {
    textGlow(ctx, 'THE LIGHT FADES', 640, 168, 68, '#ff8fa8', 'rgba(255, 93, 126, 0.5)');
    text(ctx, `The dark took the lantern on wave ${world.wave}.`, 640, 232, 22, PALETTE.text);
  }
  const isBest = world.score >= world.best && world.score > 0;
  text(ctx, `SCORE  ${world.score}`, 640, 306, 40, '#ffffff');
  text(ctx, isBest ? '★ NEW BEST SCORE ★' : `BEST  ${world.best}`, 640, 352, 22, '#ffd166');
  const minutes = Math.floor(world.stats.timePlayed / 60);
  const seconds = Math.floor(world.stats.timePlayed % 60).toString().padStart(2, '0');
  text(ctx, `Waves cleared ${world.stats.wavesCleared}   •   Foes burned ${world.kills}   •   Dew gathered ${world.dew}   •   Time ${minutes}:${seconds}`, 640, 404, 19, PALETTE.textDim);
  const acc = world.stats.shotsFired > 0
    ? Math.round((100 * world.stats.shotsHit) / world.stats.shotsFired)
    : 0;
  text(ctx, `Bolts fired ${world.stats.shotsFired}   •   Accuracy ${acc}%`, 640, 434, 19, PALETTE.textDim);
  const pulse = 0.65 + 0.35 * Math.sin(world.time * 3.2);
  ctx.save();
  ctx.globalAlpha = pulse;
  textGlow(ctx, 'PRESS R OR CLICK TO PLAY AGAIN', 640, 520, 30, '#ffffff', 'rgba(255, 233, 138, 0.6)');
  ctx.restore();
}

// ---- the one entry point ---------------------------------------------------

export function drawWorld(ctx, world) {
  ctx.save();
  if (world.shake > 0.2) {
    const s = world.shake;
    ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
  }
  drawBackground(ctx, world);
  drawPickups(ctx, world);
  drawEnemies(ctx, world);
  drawBullets(ctx, world);
  drawPlayer(ctx, world);
  drawParticles(ctx, world);
  ctx.restore();

  if (world.flash > 0) {
    ctx.fillStyle = `rgba(255, 240, 200, ${world.flash * 0.55})`;
    ctx.fillRect(0, 0, ARENA.width, ARENA.height);
  }

  if (world.screen === 'title') drawTitle(ctx, world);
  if (world.screen === 'playing' || world.screen === 'paused' || world.screen === 'upgrade') drawHud(ctx, world);
  if (world.screen === 'playing') drawBanner(ctx, world);
  if (world.screen === 'upgrade') drawUpgrade(ctx, world);
  if (world.screen === 'paused') drawPaused(ctx);
  if (world.screen === 'over') drawEnd(ctx, world, false);
  if (world.screen === 'win') drawEnd(ctx, world, true);
}
