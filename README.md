# Lumen Drift — Keeper of the Last Lantern

An original 2D arena-survival game for make.fun `best-game-01`, built from
scratch in plain HTML5 Canvas + ES modules. No libraries, no network, no
build step — `game/index.html` opens in desktop Chrome and plays offline.

## The game

You are Luma, the last lantern wisp of a night garden overrun by the Gloom.
Survive **10 waves** of Motes, Emberbats, Spitters, Brutes and the boss
**Gloom Herald** (waves 5 and 10). Gather dew, chain kills into combos,
pick **1 of 3 upgrade blessings** between waves (Twin Spark, Piercing Light,
Thorn Halo, Nova Charge, …), and hold the light until dawn.

- **Controls:** WASD / arrows to move, mouse to aim, hold click / Space to
  fire, E for a Nova bomb, P to pause, M to mute, 1/2/3 to pick an upgrade,
  R to restart after the run ends.
- **Complete loop:** title screen → 10 waves with escalating recipes →
  upgrade choices → victory screen; losing all hearts shows the game-over
  screen with score, best score, waves, kills, dew and accuracy, and a
  restart. Best score persists in `localStorage`.
- **Feel:** WebAudio-synthesised shots, hits, pickups, horns and a victory
  arpeggio over an ambient pad; particles, screen shake, hit flashes,
  floating score text, a boss health bar and a combo multiplier in the HUD.

## Play it

```
node serve.ts        # http://localhost:8080
```

## Hand it in

```
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `game/` and `screenshots/` to the output directory and
writes `dossier.json` with the vendored `vendor/makefun-game.ts`.

## Screenshots

`shots.json` lists the four deterministic scenes, rendered from the game's
own code in a headless browser (`?shot=start|play|upgrade|end&seed=1`):

1. `1-start.jpg` — title screen over the live garden
2. `2-play.jpg` — mid-wave combat with full HUD
3. `3-upgrade.jpg` — the three upgrade cards between waves
4. `4-end.jpg` — game-over screen with score and restart prompt

## Layout

```
main.ts            hand-in program (Node 22, stdlib only)
serve.ts           tiny static server for local play-testing
game/index.html    canvas page, loads src/main.js
game/src/config.js tuning, enemy roster, wave recipes, upgrades
game/src/random.js seeded RNG (deterministic screenshots)
game/src/audio.js  WebAudio synth: SFX + ambient pad
game/src/input.js  keyboard + mouse
game/src/world.js  simulation: waves, combat, pickups, upgrades, score
game/src/render.js all drawing: garden, foes, HUD, screens
game/src/shots.js  deterministic screenshot scenes + autopilot
game/src/main.js   boot, fixed-step loop, ?shot= mode
vendor/            make.fun dossier library (kit copy, unchanged)
screenshots/       the four real renders
```
