# archipelago-folio

**A playable 3D portfolio by Jack Kong. Explore my work, island by island.**

Drive a speedboat through nine toy-like islands representing my experience, projects, education, and contact information. Go ashore as Jack, walk through outdoor exhibits, sit for a moment, return to the boat, or cruise alongside the bay’s boats and marine life. Every portfolio entry is also available without playing the game.

**Current version: V4.3 — A Softer Look** · [Private preview](https://jack-archipelago.jackkong125413.chatgpt.site/) · [Résumé](static/resume.pdf) · [Validation notes](VALIDATION.md)

The hosted preview currently requires owner access. You can run the complete project locally using the instructions below.

## What’s in the bay

- **Nine content islands:** Jack’s Harbor; Amtrak, BeaconFire, and VisionX for experience; Affirmation, Research, and Catering for projects; Learning for education; and Connect for contact details.
- **Meet Jack:** a round, approximately 2.2-head-tall cartoon captain with blinking eyes, gentle expressions, a steady helm pose, and smooth walking animations, nine walkable islands, 28 exhibit/action stops, nine benches, and safe boarding transitions.
- **Arcade boat handling:** steering, inertia, reverse, braking, boost, collisions, a close follow camera, and touch controls.
- **Three challenges:** Buoy Run, Cargo Dock, and Lighthouse Link, with local records and replay support.
- **A living sea:** six ambient vessels, dolphins, sharks, tropical fish, turtles, and seabirds.
- **Boat Studio:** three selectable finishes on one detailed runabout model.
- **Exploration records:** 18 island/discovery/challenge stamps plus separate Sea Life and nine-island Island Walks journals.
- **Direct access:** navigation, map shortcuts, dock panels, résumé download, and complete 2D reading mode.

## Version history

These milestones describe the actual source history. “V2.1” names the boat refinement between V2 and V3; these are source milestones, with no GitHub release tags. Package versions track releases from V4 onward.

| Version | Focus | Source snapshot |
| --- | --- | --- |
| **V1 — First Voyage** | A complete boat-driven portfolio across nine islands | [b955e1b](https://github.com/Kongsterrr/archipelago-folio/commit/b955e1baef1a26522f3a3df5d50054b0213f0fb2) |
| **V2 — Exploration Playground** | Closer sailing, richer waterways, physical toys, and three challenges | [891195f](https://github.com/Kongsterrr/archipelago-folio/commit/891195f3a941d53c889a3d2fd2d32294ffb310c8) |
| **V2.1 — Premium Boat** | A sculpted runabout and more distinct materials | [ece35a5](https://github.com/Kongsterrr/archipelago-folio/commit/ece35a51b2edac19f3c3596ccc8d31bbe7aa6eeb) |
| **V3 — Living Bay** | Ambient traffic, marine life, finishes, full-pier docking, and island details | [07904dd](https://github.com/Kongsterrr/archipelago-folio/commit/07904ddebaf799780b56adeb3f86d7f30103784d) |
| **V4 — Meet Jack** | A visible captain, nine walkable exhibitions, boarding, benches, and independent walking records | [6dc6b91](https://github.com/Kongsterrr/archipelago-folio/commit/6dc6b914dfc4132f20810198a9795300c409c209) |
| **V4.1 — Little Captain Jack** | Cute cartoon proportions, recalibrated poses, and stable hands at the helm | [6600e26](https://github.com/Kongsterrr/archipelago-folio/commit/6600e26e523221c67f163ea210e9e0cbc0dd27f2) |
| **V4.2 — A Livelier Jack** | A fuller chibi silhouette, facial expressions, and continuous motion transitions | [5b6d732](https://github.com/Kongsterrr/archipelago-folio/commit/5b6d732b76fd603f527d164228bb9e301182e6a6) |
| **V4.3 — A Softer Look** | Sculpted short hair, refined facial details, and gentler expressions | [Current V4.3 source](https://github.com/Kongsterrr/archipelago-folio/tree/main) |

### V1 — First Voyage

Established the portfolio experience and its technical foundation:

- Built nine original island dioramas, an orange-and-white speedboat, an animated ocean, docks, landmarks, and wakes.
- Added planar Rapier physics with a fixed 60 Hz simulation, continuous collision detection, safe resets, and an interpolated follow camera.
- Connected résumé-backed content to dock panels, a quick directory, and a map with **Read now** and **Travel here**.
- Added the original six-gate **Buoy Run**, a rubber duck, and a message-in-a-bottle discovery.
- Supported keyboard and touch controls, sound and quality settings, reduced motion, and local race records.
- Established WebGPU → WebGL2 → HTML fallback so the portfolio and résumé remain accessible when 3D is unavailable.

### V2 — Exploration Playground

Turned the wide overview into a closer, more detailed sailing experience:

- Introduced close framing, speed-aware forward visibility, **Close / Standard / Wide** zoom, and landmark occlusion handling.
- Reworked island shorelines, harbors, waterways, rock formations, an arch passage, and a hidden cove.
- Added distinct island actions, individual content camera compositions, and a compact driving interface.
- Added **24 physical toys:** 8 buoys, 8 crates, 6 floating balls, and 2 rubber ducks, with contact-driven splash feedback.
- Upgraded **Buoy Run** and added **Cargo Dock** (match three crates to berths) and **Lighthouse Link** (activate a symbol sequence).
- Added a **Logbook** with 9 island visits, 6 discoveries, and 3 challenge stamps; distinguished Discovered, Visited, and Viewed.
- Strengthened challenge pause/resume, teleport/reset cleanup, camera-relative touch steering, and high/low asset variants.
- Separated camera, island animation, interaction, challenge, discovery, and feedback responsibilities into dedicated modules.

### V2.1 — Premium Boat

Focused on the player’s boat while retaining the existing world and handling:

- Replaced the simple boat with a sculpted hull, open cockpit, teak decking, upholstered seats, and geometric stitching.
- Added a framed translucent windscreen, dual helm displays, satin fittings, grab handles, swim platforms, and a compact engine.
- Preserved controls and collision behavior; adjusted visual scale to maintain desktop and portrait framing.
- Added a dedicated boat generator/rebuild workflow. This revision’s compressed boat was 126,648 bytes with 10,433 triangles.

### V3 — Living Bay

Added activity on the water and a new layer of island detail:

- Added **five vessel classes / six boats:** one cargo ship, one ferry, two fishing boats, one yacht, and one sailboat. They follow safe routes, yield to nearby traffic, and use finite-mass collisions.
- Added **H · Horn**, NPC sound/light replies, response cooldowns, and different wake widths.
- Added **3 dolphins**, **2 sharks**, **3 shoals of 12 fish**, **2 turtles**, and seabirds. Dolphins briefly accompany the player; sharks move away; fish scatter and regroup.
- Added **Boat Studio** with persistent **Marina Blue** (default), **Sunset Sport**, and **Graphite Club** finishes, plus animated steering, engine, and instrument parts.
- Expanded **E-to-read** detection around the complete pier, including accessible sides, tip, and root; added shoreline checks and an exit buffer to stabilize prompts.
- Added an independent **Sea Life** journal while preserving V2 stamps, preferences, and valid challenge records.
- Added themed overlays for all nine islands: harbor tools, station equipment, workshop machinery, greenhouse props, garden details, research instruments, food service props, campus objects, and a seaside post office.
- Coordinated simulation pausing so traffic and animals freeze with menus and challenges; travel clears temporary companion and horn-reply state.
- Added 38 compressed fleet/fauna/detail GLBs totaling 705,992 bytes. The current main boat is 139,100 bytes, 11,129 triangles, and 16 material batches.

### V4 — Meet Jack

Made the islands places to visit on foot while preserving the sea and all existing portfolio content:

- Added **one original animated Jack**: short dark hair, cream jacket, navy layers, a wristwatch, and light sneakers. The same skeleton sits at the helm, walks, runs, operates devices, sits, and stands up.
- Changed the full-pier **E** action to **Go ashore**. A short fade safely parks the boat at one of two berths, switches to a capsule character controller, and brings the camera closer. **Read island** remains a separate shortcut.
- Added walking ground, ramps, dock surfaces, building obstacles, and water-edge protection independently of the boat collision layer. Character movement uses 60 Hz Rapier updates, actual-speed animations, and screen-relative keyboard/touch input.
- Rebuilt all **nine high/low island models** with continuous paths, **28 themed exhibit/action stops**, **nine benches**, detailed plaques and props, an open workshop and greenhouse, and a connected research platform.
- Added pedestrian-aware train stopping, local roof/canopy/plaque fading, exhibit reading cameras, a parked-boat minimap icon, and **Return to boat**. Boat Studio returns to the same walking position.
- Added **Island Walks (9)** without changing the original **18 stamps**. V3 finishes, settings, Sea Life sightings, and challenge bests migrate automatically. Walking and boat zoom preferences are independent.
- Kept all three sea challenges: starting one from land first returns Jack to the boat. Epoch-guarded transitions prevent old callbacks from restoring a previous actor after travel, reset, or an interrupted boarding sequence.
- Expanded the public WebMCP bridge with bounded `walk_jack`, boarding, and player/parked-boat state; sailing commands explain when Jack must board first.
- Preserved direct HTML reading, verified résumé facts, the original boat physics, fleet, marine life, and private preview access. Added the confirmed public repository link to Connect Island.

### V4.1 — Little Captain Jack

Refined Jack’s appearance and made driving visually stable:

- Rebuilt the original character with approximately **2.7-head-tall proportions**: a larger rounded face, swept dark hair, expressive eyes, a compact cream jacket, short navy trousers, and rounded sneakers. Standing height remains 1.30 units.
- Re-authored the seven shared animations for the new skeleton proportions and recalibrated the helm seat, hand contacts, bench sitting, and standing recovery. Placement metadata travels with the GLB so runtime anchors match the asset.
- Kept **both hands and the steering wheel in a fixed authored driving pose**. Steering still controls the boat and outboard, and instruments still respond to speed. Independent forearm offsets no longer make hands slip or snap during left/right input.
- Cleared all animation blends and temporary interaction/seat state when switching between the boat and land, preventing a previous walking gesture from leaking into the helm pose.
- Preserved nine-island walking, all sea challenges, boat finishes, verified content, and existing browser records. One shared skeleton and six material batches serve every mode.
- Moved phone arrival messages clear of the character. The rebuilt GLB is 131,676 bytes with 11,972 triangles; 157 regression checks pass.

### V4.2 — A Livelier Jack

Reworked Jack’s silhouette and animation to make the character feel more expressive:

- Increased the head proportion to approximately **2.2 heads tall**, with a broad round face, low-set highlighted eyes, small button nose, soft smile and cheeks, fuller swept hair, a compact bomber jacket, shorter limbs, and rounded sneakers. Standing height remains 1.30 units.
- Added five facial joints for blinking eyes, brows, and a responsive smile. Subtle idle glances and nearby-exhibit attention use the paused simulation clock; reduced motion restores the calm authored face.
- Replaced interrupted animation fades with normalized blends that retain current contributions. Walk/run transitions preserve stride phase and use speed hysteresis; collision stops pause the feet.
- Made bench exit heading and position ease out of the seated pose. Menus and background pauses now freeze the complete rendered character rather than silently resetting a walk or advancing a stand transition.
- Preserved the fixed helm hand contacts and neutral steering wheel, one shared avatar, all nine walking islands, existing controls, verified portfolio content, and browser records.

### V4.3 — A Softer Look

Focused on Jack’s head while preserving V4.2’s proportions and body animation:

- Replaced separate raised hair locks with a connected short haircut: a soft side-swept fringe, shallow sculpted flow, a clean hairline, and a rounded crown/back. Matte chestnut shading keeps the silhouette readable at normal game distance.
- Refined warm irises, pupils and smaller eye highlights, softened the brows and cheek color, and brought the button nose closer to the face.
- Smiling now gently softens the eyes and lifts the brows as the mouth changes. Eye layers share their blink pivots; pause and reduced-motion behavior remain consistent.
- Preserved the single shared character, fixed hands while driving, walking/boarding mechanics, island content, and existing local records.

## Run locally

Use **Node.js 22.12 or newer** and npm. Generated models and the résumé are checked in; rebuilding assets is optional.

```sh
git clone https://github.com/Kongsterrr/archipelago-folio.git
cd archipelago-folio
npm ci
npm run dev
```

Open the local URL printed by Vite, normally `http://127.0.0.1:5173`.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local development server |
| `npm run build` | Build the static site into `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm test` | Run physics, camera, input, challenge, and V1–V4.3 regression tests |

No API keys, backend, account setup, or environment variables are required to run the portfolio.

## Controls and interactions

| Action | Keyboard / mouse |
| --- | --- |
| Throttle | W / ↑ |
| Brake, then reverse | S / ↓ |
| Steer | A / D or ← / → |
| Boost | Hold Shift |
| Quick brake | Space |
| Go ashore / read a nearby exhibit / board | E / Enter |
| Walk on land | WASD / arrows, relative to the screen |
| Run on land | Hold Shift |
| Operate the nearest available device | F |
| Horn | H |
| Map | M |
| Reset to safe harbor / current island dock | R |
| Close a panel | Escape |
| Camera zoom | Mouse wheel or + / − controls |

Touch devices have a camera-relative joystick and on-screen driving, horn, reading, and action buttons. Boat Studio is available from Jack’s Harbor and Settings. On land, the joystick moves Jack and Boost becomes Run. Move to stand up from a bench; use Return to boat from anywhere on the current island.

Opening a menu or switching away pauses simulation; an active challenge resumes after a short countdown. Going ashore, resetting, and traveling cancel an unfinished challenge. On land, the parked boat stays locked while sea life and traffic continue. Reading pauses the whole simulation. Sound starts off, and visual cues remain available while muted.

## Technology and structure

Built with **vanilla JavaScript, Vite, Three.js / TSL, and Rapier**. HTML panels provide keyboard-accessible portfolio content over the 3D world. Original procedural GLBs use Meshopt compression, shared materials, and high/low variants. Visual boat motion is separate from collision physics.

```text
sources/
  content.json           Shared résumé-backed portfolio content
  config.js              Islands, docks, safe points, and course configuration
  main.js                HTML interface and application coordination
  game.js                Renderer, world loading, and simulation loop
  core/                  Boat, camera, input, challenges, discovery, and docking
  world/                 Islands, props, fleet, marine life, water, and feedback
scripts/                 Model builders and compression tools
static/
  models/                Compressed GLBs and asset manifests
  resume.pdf             Original supplied résumé
  licenses/              Asset/font notices
tests/                   Automated regression checks
```

`PlayerController` separates locomotion from pause reasons; `BoardingController` commits one actor transition at the fade midpoint; `CharacterController` handles the kinematic capsule; `IslandWalkWorld` consumes `walk-layout.json` for shared high/low terrain and obstacles. `JackAvatar` reparents one skin between the boat and world. `CameraRig` manages framing; `ChallengeManager` owns challenge state and timing; `DiscoveryStore` persists local progress. `AmbientFleet`, `MarineLife`, `DockInteraction`, `BoatAppearance`, provide the sea systems. V4 island details are integrated into the walkable models; legacy `IslandDetails` overlays are disabled to keep paths clear. Contact feedback uses a shared dispatch path.

## Customize the content

- Edit [`sources/content.json`](sources/content.json) to update the nine entries. The scene, panels, directory, and reading mode share this data.
- Edit [`sources/config.js`](sources/config.js) for world positions, safe harbor headings, dock definitions, and course configuration.
- Replace [`static/resume.pdf`](static/resume.pdf) when updating the résumé.
- Add verified external links to an entry’s `links` array. Unconfigured GitHub/project demo links remain hidden; placeholder destinations are not presented as real projects.

Career facts and project claims come from the supplied résumé. Island devices are concept illustrations, not actual application screenshots or live business data.

## Rebuild the original assets

Generated assets are checked in. Regenerate the current V4 character and islands with:

```sh
node scripts/build-jack.mjs
node scripts/build-walk-islands.mjs
```

The island builder exports both quality variants plus `walk-layout.json`, preserving the existing boat. The earlier `build-assets`, compression, and low-asset scripts are retained for the V1/V2 source history; running them would replace the V4 island design. Use the V4 builder for current islands.

To rebuild only the main boat:

```sh
node scripts/rebuild-boat.mjs
```

To regenerate the V3 additions, including their high/low variants and manifests:

```sh
node scripts/build-fleet.mjs
node scripts/export-fauna.mjs
node scripts/export-details.mjs
```

Intermediate files live in ignored `.asset-build/`. Models use geometry and flat-color materials without external texture downloads. Core compressed byte measurements are in `static/models/compression.json`; the core generator’s manifest also contains pre-compression statistics. Collider definitions remain separate from visual meshes.

## Accessibility, storage, and validation

- **Rendering fallback:** WebGPU normally falls back to WebGL2, then to HTML reading mode if 3D fails. Use `?webgl` to request WebGL2 or `?no3d` for reading mode.
- **Accessibility:** keyboard navigation, visible focus, panel focus restoration, reduced motion, optional sound, and direct access to all portfolio entries.
- **Local storage only:** preferences, boat finish, exploration records, Sea Life observations, Island Walks, separate camera zoom preferences, and versioned challenge bests. Transient world positions are never saved; every refresh starts Jack aboard at the harbor. Blocked storage falls back to an in-memory session. There are no accounts, remote leaderboards, or application database.
- **Recorded V4 verification:** 148 automated checks passed, with desktop WebGPU/WebGL2 and portrait/landscape viewport checks. See [`VALIDATION.md`](VALIDATION.md) for conditions, measurements, and remaining limits.

Physical iPhone/Android performance, sustained mobile 30 FPS, controlled 20 Mbps cold-start timing, and long-duration thermal behavior have not yet been measured. Desktop viewport emulation does not establish those results.

## Hosting

`npm run build` produces a static site in `dist/`. The existing private preview is hosted with Sites; [`.openai/hosting.json`](.openai/hosting.json) identifies that deployment and its build directory. This repository contains no deployment credentials. GitHub source visibility and the private preview’s access settings are independent.

## Inspiration and licensing

Inspired by [Bruno Simon’s portfolio](https://bruno-simon.com/) and the organization of [`folio-2025` at commit `41046b5`](https://github.com/brunosimon/folio-2025/tree/41046b57eeed8d156d9c3fd7fa259900baef7816). This project retains the small event dispatcher and its MIT attribution and adapts the input, update-loop, interaction-area, and camera-mode approach for an original ocean world.

Jack’s character, boat, islands, fleet, animals, effects, progression, and portfolio content are specific to Jack’s Archipelago. Bruno’s car, world assets, branding, personal content, music, and private services are not shipped.

See [`LICENSE`](LICENSE) for the preserved MIT license and [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) for dependency, font, résumé, and asset provenance.
