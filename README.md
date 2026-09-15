# Jack’s Archipelago V2

A playable, English-language portfolio: steer an orange and white speedboat around nine original toy islands. The same résumé-backed content is available from the directory, dock panels, map, and the 2D reading mode.

## Run locally

Use Node.js 22.12+ (24 LTS is also supported):

```sh
npm ci
npm run dev
```

Open the localhost URL printed by Vite. `npm run build` creates the static deployment in `dist`. `npm test` runs the physics, race, input and state regression tests.

## Controls

- W / ↑ throttle; S / ↓ brake then reverse; A / D or ← / → steer.
- Hold Shift to boost, Space to brake. E or Enter reads a nearby island. F operates the nearest visible device.
- M opens the map; R returns to the nearest safe harbor; Escape closes a panel.
- Phones use the joystick, Reverse, Brake and Boost. Reset is the curved arrow.
- Six numbered gates form Buoy Run. Choose the flag button and Start run. Opening a panel or losing focus pauses the run; a short countdown precedes resuming. Docking, traveling and resetting cancel it.
- Cargo Dock: push three shape-matched crates into their berths. Lighthouse Link: activate the three symbol lights in the displayed order.
- The Logbook tracks 9 island visits, 6 discoveries and 3 challenge stamps. Quick reading marks Viewed only.
- Mouse wheel and the +/− controls select Close, Standard, or Wide. Acceleration widens the camera for safe visibility.

Sound starts off. Settings contain quality, reduced motion, and a complete reading mode. `?webgl` forces WebGL2 for compatibility checks; `?no3d` opens the same content without a renderer. WebGPU normally falls back to WebGL2 automatically. A failure at initialization or in the render loop returns to the reading view.

## Modules

CameraRig handles stable framing and speed-dependent visibility. IslandController caches animated GLB nodes. Interactable provides one nearest visible action. ChallengeManager owns countdowns, monotonic clocks and challenge progress. DiscoveryStore versions local records. FeedbackSystem pools contact-driven splashes. Boat and PropManager retain independent planar Rapier bodies.

## Content and world configuration

`sources/content.json` is the shared source for all nine entries. `sources/config.js` holds island locations, safe harbor headings, interaction zones and the course. Only verified résumé links are enabled. GitHub and project demos intentionally have no invented URL; add their real `{ "label": "GitHub", "url": "https://..." }` objects to the relevant entry's `links` array. Replace `static/resume.pdf` when updating the résumé.

No backend, accounts, remote database, private Bruno services or network leaderboard are used. Browser storage contains only settings, exploration stamps and versioned local challenge bests, with an in-memory fallback when storage is blocked.

## Original assets

The boat and each island are separate, original GLBs. They use texture-free materials, so no external texture downloads or KTX2 textures are needed. The premium boat uses sculpted geometry, satin hardware and translucent glazing. Geometry uses Meshopt compression. To reproduce all models:

```sh
npm run models
npm run compress
```

The boat source is `scripts/premium-boat.mjs`. Run `node scripts/rebuild-boat.mjs` to regenerate and compress only the shared boat and update its high/low manifest statistics without rebuilding the islands.

See `static/models/compression.json` for the before/after sizes. The ten high-quality GLBs total 3.21 MB. The low-quality set totals 2.37 MB including the shared boat; it reduces scene triangles by 22.0%, keeping full dock and animation geometry.

Generate the low variant after the high-quality models with `node scripts/build-low-assets.mjs` and `node scripts/finalize-low-assets.mjs`. Intermediate output lives in ignored `.asset-build/`. Flat-color materials require no KTX2 texture payload. Collisions are intentionally independent of the visual mesh in `sources/core/collisions.js`. Boats use fixed 60 Hz Rapier simulation, planar constraints, CCD and interpolated render positions.

## Reference and licensing

The technical starting point is Bruno Simon’s `folio-2025` at commit `41046b57eeed8d156d9c3fd7fa259900baef7816`. This project keeps vanilla JavaScript, Vite, Three.js / TSL, and Rapier. It reuses the small event dispatcher with its original MIT notice, adapts the input actions / game loop / interaction-area / camera-mode organization, and replaces the car, world, effects, progression and content. See `THIRD_PARTY_NOTICES.md` and `LICENSE`.

The original lockfile was used as the dependency baseline. The boat uses Rapier's same-version compatibility package for explicit WASM initialization. Security fixes were applied within compatible ranges; obsolete Node polyfills, image CLI/Sharp and WASM/top-level-await plugins were removed because the new static geometry and explicit Rapier initialization do not use them. V2 preserves the V1 dependency manifest and lockfile.

## Validation and deployment

See `VALIDATION.md` for verified behavior and remaining device-specific checks. The selected private Site is identified in `.openai/hosting.json`; no source credential is stored in this repository. Built static assets are deployed to owner-only Sites hosting. Do not make access public without the owner's request.
