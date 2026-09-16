# archipelago-folio

**A playable 3D portfolio by Jack Kong. Explore my work, island by island.**

Drive a speedboat through nine toy-like islands representing my experience, projects, education, and contact information. Dock to read, try a challenge, or cruise alongside the bay’s boats and marine life. Every portfolio entry is also available without playing the game.

**Current version: V3 — Living Bay** · [Private preview](https://jack-archipelago.jackkong125413.chatgpt.site/) · [Résumé](static/resume.pdf) · [Validation notes](VALIDATION.md)

The hosted preview currently requires owner access. You can run the complete project locally using the instructions below.

## What’s in the bay

- **Nine content islands:** Jack’s Harbor; Amtrak, BeaconFire, and VisionX for experience; Affirmation, Research, and Catering for projects; Learning for education; and Connect for contact details.
- **Arcade boat handling:** steering, inertia, reverse, braking, boost, collisions, a close follow camera, and touch controls.
- **Three challenges:** Buoy Run, Cargo Dock, and Lighthouse Link, with local records and replay support.
- **A living sea:** six ambient vessels, dolphins, sharks, tropical fish, turtles, and seabirds.
- **Boat Studio:** three selectable finishes on one detailed runabout model.
- **Exploration records:** 18 island/discovery/challenge stamps plus a separate Sea Life journal.
- **Direct access:** navigation, map shortcuts, dock panels, résumé download, and complete 2D reading mode.

## Version history

These milestones describe the actual source history. “V2.1” names the boat refinement between V2 and V3; these are documentation milestones, not npm versions or GitHub release tags.

| Version | Focus | Source snapshot |
| --- | --- | --- |
| **V1 — First Voyage** | A complete boat-driven portfolio across nine islands | [b955e1b](https://github.com/Kongsterrr/archipelago-folio/commit/b955e1baef1a26522f3a3df5d50054b0213f0fb2) |
| **V2 — Exploration Playground** | Closer sailing, richer waterways, physical toys, and three challenges | [891195f](https://github.com/Kongsterrr/archipelago-folio/commit/891195f3a941d53c889a3d2fd2d32294ffb310c8) |
| **V2.1 — Premium Boat** | A sculpted runabout and more distinct materials | [ece35a5](https://github.com/Kongsterrr/archipelago-folio/commit/ece35a51b2edac19f3c3596ccc8d31bbe7aa6eeb) |
| **V3 — Living Bay** | Ambient traffic, marine life, finishes, full-pier docking, and island details | [07904dd](https://github.com/Kongsterrr/archipelago-folio/commit/07904ddebaf799780b56adeb3f86d7f30103784d) |

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
| `npm test` | Run physics, camera, input, challenge, and V3 regression tests |

No API keys, backend, account setup, or environment variables are required to run the portfolio.

## Controls and interactions

| Action | Keyboard / mouse |
| --- | --- |
| Throttle | W / ↑ |
| Brake, then reverse | S / ↓ |
| Steer | A / D or ← / → |
| Boost | Hold Shift |
| Quick brake | Space |
| Read a nearby island | E / Enter |
| Operate the nearest available device | F |
| Horn | H |
| Map | M |
| Return to a safe harbor | R |
| Close a panel | Escape |
| Camera zoom | Mouse wheel or + / − controls |

Touch devices have a camera-relative joystick and on-screen driving, horn, reading, and action buttons. Boat Studio is available from Jack’s Harbor and Settings.

Opening a menu or switching away pauses simulation; an active challenge resumes after a short countdown. Docking, resetting, and traveling cancel an unfinished challenge. Sound starts off, and visual cues remain available while muted.

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

`CameraRig` manages framing; `ChallengeManager` owns challenge state and timing; `DiscoveryStore` persists local progress. `AmbientFleet`, `MarineLife`, `DockInteraction`, `BoatAppearance`, and `IslandDetails` provide the V3 systems. Contact feedback uses a shared dispatch path.

## Customize the content

- Edit [`sources/content.json`](sources/content.json) to update the nine entries. The scene, panels, directory, and reading mode share this data.
- Edit [`sources/config.js`](sources/config.js) for world positions, safe harbor headings, dock definitions, and course configuration.
- Replace [`static/resume.pdf`](static/resume.pdf) when updating the résumé.
- Add verified external links to an entry’s `links` array. Unconfigured GitHub/project demo links remain hidden; placeholder destinations are not presented as real projects.

Career facts and project claims come from the supplied résumé. Island devices are concept illustrations, not actual application screenshots or live business data.

## Rebuild the original assets

Generated assets are checked in. When modifying source geometry, rebuild the core high/low models in this order:

```sh
npm run models
npm run compress
node scripts/build-low-assets.mjs
node scripts/finalize-low-assets.mjs
```

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
- **Local storage only:** preferences, boat finish, exploration records, Sea Life observations, and versioned challenge bests. Blocked storage falls back to an in-memory session. There are no accounts, remote leaderboards, or application database.
- **Recorded V3 verification:** 121 automated checks passed, with desktop WebGPU/WebGL2 and portrait/landscape viewport checks. See [`VALIDATION.md`](VALIDATION.md) for conditions, measurements, and remaining limits.

Physical iPhone/Android performance, sustained mobile 30 FPS, controlled 20 Mbps cold-start timing, and long-duration thermal behavior have not yet been measured. Desktop viewport emulation does not establish those results.

## Hosting

`npm run build` produces a static site in `dist/`. The existing private preview is hosted with Sites; [`.openai/hosting.json`](.openai/hosting.json) identifies that deployment and its build directory. This repository contains no deployment credentials. GitHub source visibility and the private preview’s access settings are independent.

## Inspiration and licensing

Inspired by [Bruno Simon’s portfolio](https://bruno-simon.com/) and the organization of [`folio-2025` at commit `41046b5`](https://github.com/brunosimon/folio-2025/tree/41046b57eeed8d156d9c3fd7fa259900baef7816). This project retains the small event dispatcher and its MIT attribution and adapts the input, update-loop, interaction-area, and camera-mode approach for an original ocean world.

The boat, islands, fleet, animals, effects, progression, and portfolio content are specific to Jack’s Archipelago. Bruno’s car, world assets, branding, personal content, music, and private services are not shipped.

See [`LICENSE`](LICENSE) for the preserved MIT license and [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) for dependency, font, résumé, and asset provenance.
