# Castledown

A portrait physics castle stacker and tower defense game for Slapjam. **Phases 1–3** use Phaser 4, its built-in Matter engine, Vite 8, and strict TypeScript.

## Run

```sh
npm install
npm run dev
```

Open the local Vite URL. Drag in the playfield to aim, choose one of four room cards, rotate if needed, and tap **DROP ROOM**. Release ends aiming; dropping always uses the button to avoid accidental placements.

Keyboard: **← / →** or **A / D** to aim, **R** to rotate, **Space** to drop, **1–4** to choose rooms, **H** for help, **M** to mute, **Esc** to close a panel. The speaker button also toggles sound; the top-right arrow starts a fresh castle after confirmation.

## Implemented

- 720 × 1280 portrait canvas with FIT scaling, touch/mouse controls, and dark letterboxing.
- All four room sizes, masses, and friction values from the spec. Cannon balconies have an offset, two-part physical shape.
- 480-pixel bedrock foundation, abyss cleanup, dotted trajectory, approximate landing ghost, and a crane that rises with the castle.
- Fixed 60 Hz physics independent of rendering refresh rate; small chamfers and disabled sleeping. Air drag stays at 0.01 during falls and rises to 0.035 during contact to dissipate residual siege oscillation; the STABLE thresholds are unchanged.
- Falling, settling, stable, unstable, and collapsed states. Stability requires 600 ms of continuous contact, speed below 0.4, angular velocity below 0.015, and tilt below 15°. Amber starts at 15°, red at 35°, collapse at 65° or a fall beyond the world limit.
- Stability is measured relative to the chosen quarter-turn orientation, folded at 180°. Deliberately sideways rooms can become stable; negative tilt is handled symmetrically.
- Camera tracking, markers every 10 metres, height and room counters, procedural masonry, night landscape, landing dust, help, and restart.
- One throne per level, locked until the stable castle reaches the gold finish line. Level 1 targets 15m; each next level adds 5m. Unlocking persists if the structure later loses height.
- Height milestones at 10m, 20m, etc. spawn 30-HP Gargoyles from alternating upper sides. They approach, wind up, swoop at vulnerable upper rooms, and retreat for another attack. A hit deals 10 damage plus a Matter force at the impact side.
- 120-HP Rams arrive after 14 seconds, then periodically from alternating ground edges. They approach the lowest room and strike every 3 seconds for 18 damage plus a physical jolt. Static bedrock remains indestructible.
- Archers prioritize air, firing 18-damage arrows every 1.2 seconds. Cannons target ground, firing ballistic shells every 3 seconds for 70 area damage in a 120px blast radius. **Only STABLE, living rooms can fire; reload pauses while unstable.** Already-fired projectiles continue flying. Fast arrows use swept collision checks.
- Room HP: stone 300, archer/cannon 160, throne 180. Damage immediately interrupts stability; zero HP removes the room and may collapse its supports. Enemy and projectile movement are kinematic; siege impulses act on the real Matter castle bodies.
- The throne's first STABLE landing begins a 10-second Coronation and a single final Gargoyle swarm. **Ten consecutive stable seconds are required:** wobbling resets the timer without spawning another swarm. Help/reset panels pause simulation, waves, reloads, and the countdown.
- Crown survival completes the stage, showing final height and enemies defeated. Next Level increases the target and pressure; Play Again retries the same level. Bedrock contact, overturning, abyss falls, or zero throne HP cause defeat. Restart clears enemies, projectiles, bodies, timers, and counters.
- Detailed procedural masonry, stone grain and cracks, carved battlements, warm windows, drifting mist, and fireflies.
- Landing dust, stone debris, muzzle flashes, cannon smoke, explosions, and crown sparks. One graphics batch caps particles at 240; effects expire and reset between stages. Heavy landings and siege hits shake the world camera, leaving the HUD steady. Reduced-motion preference suppresses shake and ambient movement and reduces particle counts.
- Original synthesized thuds, stone grinding, arrows, cannon blasts, shattering, crown chimes, countdown ticks, victory fanfare, and defeat tones. Phaser SoundManager unlocks Web Audio after the first gesture. Mute persists locally when storage is available. Help/reset panels stop effects audio; scene shutdown releases voices. Browsers without Web Audio play silently.

The world foundation stays at y = 1120. The camera starts at scrollY = 160 and tracks rooms that have become stable at a 640-pixel screen offset, leaving space for both the crane and the fixed card dock. Tracking continues through temporary wobbling, and the crane stays above landed rooms. The translucent ghost is a bounds-based aiming guide, not a physics forecast.

**Remaining Phase 4 work:** broader balancing across later levels, touch testing on real mobile hardware, and itch.io upload. Automated touch coverage uses Chromium mobile emulation. The referenced `castledown_master_prompt.md` was absent from this checkout, so Phase 2 follows the complete instructions supplied in the chat and Phase 3 follows the attached roadmap.

## Validate and build

```sh
npm test
npx tsc --noEmit
npm run build
npm run verify:build
npm run preview
```

Tests cover stacking, touch input, stability, combat gating and reload, air targeting, projectile hits, area damage, siege forces, milestone spawning, crown locks, continuous Coronation timing, victory/defeat, pause, and next-level cleanup. Audio checks cover generated samples, first-gesture unlock, actual Web Audio output, mute persistence, and voice cleanup; effects checks cover particle limits, expiry, and reduced motion. They use installed Microsoft Edge by default. On another machine, install Playwright Chromium with `npx playwright install chromium` and set `PLAYWRIGHT_CHANNEL=chromium` (or change the channel in `playwright.config.ts`).

`dist/` is the complete HTML5 build. Vite uses `base: './'`; there are no remote assets or runtime CDN dependencies. For itch.io, zip the **contents** of `dist/` so `index.html` is at the archive root, choose HTML, enable the mobile-friendly option, and use a 720 × 1280 viewport. Nothing is uploaded automatically.

## Layout

`BootScene` generates textures; `GameScene` coordinates the fixed-step simulation and stage events; `UIScene` owns the overlay and panels. `CastleBlock` owns physics, HP, and reload; `DropperCrane` owns aiming. `Enemy` implements movement and siege impacts, `Projectile` handles flight and swept hits, `CombatSystem` selects targets and resolves explosions, `WaveManager` schedules threats, and `CoronationSystem` owns the victory clock. `EffectsSystem` batches cosmetic particles; `AudioSystem` owns sound voices generated by `audioSynth`. `StabilitySystem` remains independent of combat. Room dimensions and physical tuning live in `src/types/blockTypes.ts`.

API references: [Phaser Matter physics](https://docs.phaser.io/phaser/concepts/physics/matter), [cameras](https://docs.phaser.io/phaser/concepts/cameras), and [scale manager](https://docs.phaser.io/phaser/concepts/scale-manager).
