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

### Phase 4: balancing, polish and release

| Level | Target | Coronation | Threats |
| --- | --- | --- | --- |
| L1 · The First Stone | 15 m | 8 s | 2 scout Gargoyles per 10 m, small crown swarm, no rams |
| L2 · Siege of Rams | 25 m | 10 s | Battering rams (max 2) + a 6-strong Gargoyle swarm |
| L3 · The Final Climax | 35 m | 12 s | Faster, tougher rams (max 3), 8-strong swarm, gusting wind on falling rooms |
| Endless | 45 m, +10 m each | 12 s | Unlocked after L3; HP, swarm size, ram rate and wind scale each siege |

All tuning lives in `src/config/levels.ts`. Rams now wait for the first room, cannons reload every 2.5 s, and the drop cooldown is 350 ms. Losing 10 rooms before the crown is placed ends the run as **Castle collapsed!**; losing the throne shows **The King has fallen!**

- The victory modal shows 1–3 stars (crowned · ≤2 rooms lost · under par time), score, high score, height, enemies, rooms, and time, with confetti. The defeat modal shows the cause, run height against the all-time best, and a large Try Again button. **Enter** retries or advances.
- Best height, high score, stars per level, and unlocked level persist in `localStorage` (`castledown-save-v1`). This fails safely in sandboxed iframes. The header shows the best height.
- Mobile: touch-move, context-menu, and double-tap defaults are blocked, and the page is pinned against pull-to-refresh. Web Audio resumes on every gesture and when the tab becomes visible again. The header speaker button (or **M**) toggles mute.

Automated touch coverage uses Chromium mobile emulation; real-device testing is still recommended before release. The referenced `castledown_master_prompt.md` was absent from this checkout, so Phase 2 follows the complete instructions supplied in the chat and Phase 3 follows the attached roadmap.

## Validate and build

```sh
npm test
npx tsc --noEmit
npm run build
npm run verify:build
npm run pack      # build + artifacts/castledown-itch-v<version>.zip
npm run preview
```

Tests cover stacking, touch input, stability, combat gating and reload, air targeting, projectile hits, area damage, siege forces, milestone spawning, crown locks, continuous Coronation timing, victory/defeat, pause, and next-level cleanup. Audio checks cover generated samples, first-gesture unlock, actual Web Audio output, mute persistence, and voice cleanup; effects checks cover particle limits, expiry, and reduced motion. They use installed Microsoft Edge by default. On another machine, install Playwright Chromium with `npx playwright install chromium` and set `PLAYWRIGHT_CHANNEL=chromium` (or change the channel in `playwright.config.ts`).

`dist/` is the complete HTML5 build. Vite uses `base: './'`; there are no remote assets or runtime CDN dependencies. `npm run pack` zips the **contents** of `dist/` (with `index.html` at the archive root) using a dependency-free Node script. On itch.io, choose **HTML**, tick "played in the browser", set the viewport to 720 × 1280, and enable **Mobile friendly** and the **Fullscreen button**. Nothing is uploaded automatically.

## Layout

`BootScene` generates textures; `GameScene` coordinates the fixed-step simulation and stage events; `UIScene` owns the overlay and panels. `CastleBlock` owns physics, HP, and reload; `DropperCrane` owns aiming. `Enemy` implements movement and siege impacts, `Projectile` handles flight and swept hits, `CombatSystem` selects targets and resolves explosions, `WaveManager` schedules threats, and `CoronationSystem` owns the victory clock. `EffectsSystem` batches cosmetic particles; `AudioSystem` owns sound voices generated by `audioSynth`. `StabilitySystem` remains independent of combat. Room dimensions and physical tuning live in `src/types/blockTypes.ts`.

API references: [Phaser Matter physics](https://docs.phaser.io/phaser/concepts/physics/matter), [cameras](https://docs.phaser.io/phaser/concepts/cameras), and [scale manager](https://docs.phaser.io/phaser/concepts/scale-manager).
