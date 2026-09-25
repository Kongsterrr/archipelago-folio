# archipelago-folio

**A playable 3D portfolio by Jack Kong. Explore my work, island by island.**

Drive a speedboat between four large themed islands: About Jack Kong, Experience, Projects, and Education. Go ashore as Jack, walk through outdoor exhibits, sit for a moment, return to the boat, or cruise alongside the bay’s boats and marine life. Every portfolio entry is also available without playing the game.

**Current version: V11 — Four Isles** · [Live portfolio](https://kongsterrr.com) · [Résumé](static/resume.pdf) · [Validation notes](VALIDATION.md)

The portfolio is publicly available at **kongsterrr.com**, without sign-in. You can also run the complete project locally using the instructions below.

## What’s in the bay

- **Four connected exhibition islands:** About combines Harbor and Connect; Experience combines Amtrak, BeaconFire and VisionX; Projects combines Affirmation, Research and Catering; Education keeps BU and CMU together. Nine independent stories remain available through the directory.
- **Meet Jack:** the actual chibi model supplied by Jack, with its textured hair, face, black shorts and bare feet preserved. A locally fitted skeleton supports seven motions, steady hands at the helm, four walkable islands, 28 exhibit/action stops, nine benches and safe boarding transitions.
- **Arcade boat handling:** steering, inertia, reverse, braking, boost, collisions, a close follow camera, and touch controls.
- **Three challenges:** Buoy Run, Cargo Dock, and Lighthouse Link, with local records and replay support.
- **A living sea:** one imported cruise ship, two imported luxury yachts, dolphins, sharks, tropical fish, turtles, and seabirds.
- **Boat Studio:** three selectable finishes on one detailed runabout model.
- **Sculpted Bay:** refined Jack, main boat and Harbor geometry; original fabric, wood, upholstery, stone, sand and rope surfaces; shared surface detail, contact shading and shoreline-based shallow water.
- **Sunset Bay:** a fixed orange-and-violet evening, broken golden reflections, warm landmark lights and individual island palettes.
- **Exploration records:** 13 island/discovery/challenge stamps plus separate Sea Life and four-island Island Walks journals. Legacy physical visits merge into their new parent island; individual story-reading records remain intact.
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
| **V4.3 — A Softer Look** | Sculpted short hair, refined facial details, and gentler expressions | [9edf376](https://github.com/Kongsterrr/archipelago-folio/commit/9edf376eace0ff0e0eaebc420836c4e163de6832) |
| **V4.4 — The Concept Comes Aboard** | Reference-led proportions, layered fluffy hair, a refined face and open jacket | [41787b1](https://github.com/Kongsterrr/archipelago-folio/commit/41787b1acf361db16bb4b8eaff275034992cc6b0) |
| **V4.5 — A Little More Jack** | Shorter chibi proportions, relaxed arm clearance, refitted gait and seating | [9c35f4f](https://github.com/Kongsterrr/archipelago-folio/commit/9c35f4f5f49060de6d77d484315f738e34821027) |
| **V4.6 — Soft Shapes & Shorter Legs** | Sculpted oval face, shorter legs, continuous clothing surfaces and recalibrated seating | [c9dc7ee](https://github.com/Kongsterrr/archipelago-folio/commit/c9dc7ee9c88938ec822f6a9a6f806f0886565ccd) |
| **V5 — Sculpted Bay** | Refined character, runabout and Harbor assets, PBR surfaces, daylight/contact shading and shallow-water detail | [1d3b9e9](https://github.com/Kongsterrr/archipelago-folio/commit/1d3b9e9898ba9bd737290697005bd42b5292d418) |
| **V6 — Sunset Bay** | Fixed low sunset, violet shadows, golden water, nine-island material and landmark detail | [9abe9cd](https://github.com/Kongsterrr/archipelago-folio/commit/9abe9cd7efee08c088ee68d6fbd8667abae2307d) |
| **V7 — Textured Crop & Compact Silhouette** | Forward spiky crop, integrated shoulder and sleeve shaping, slimmer upper arms, smaller shoes and hands | [d3c82ed](https://github.com/Kongsterrr/archipelago-folio/commit/d3c82ed) |
| **V8 — Reference-Inspired Chibi Captain** | Layered chestnut fringe, brighter chibi eyes, and a graphite/sea-glass outfit while retaining the animated production rig | [eac2891](https://github.com/Kongsterrr/archipelago-folio/commit/eac2891e297dc655983c2125ebff1480058f851d) |
| **V9 — Imported Chibi Jack** | Replaces the procedural avatar with the actual supplied mesh and texture, optimized and locally rigged for all seven actions | [Current source](https://github.com/Kongsterrr/archipelago-folio/tree/main) |
| **V10 — Imported Fleet** | Three owner-supplied ship models replace the ambient NPC fleet; optimized LODs preserve the game's loading budget | [Current source](https://github.com/Kongsterrr/archipelago-folio/tree/main) |
| **V11 — Four Isles** | Four larger walkable category islands, grouped navigation, preserved district stories and migrated exploration records | [Current source](https://github.com/Kongsterrr/archipelago-folio/tree/main) |

### V11 — Four Isles

- Replaced nine separate landmasses with four larger, continuous islands around a central bay. Each has one main dock, two safe boat berths and connected walking routes; the original nine themes survive as named districts.
- Retained all **nine résumé-backed stories, 28 exhibit/action stops and nine benches**. Nested district controllers preserve train crossings, greenhouse watering, pipeline, garden, research, catering, lighthouse and signal animations.
- Reworked navigation, map pins, individual story cameras and the complete HTML reading fallback around **About / Experience / Projects / Education**. Contact stays one click away; old content IDs still travel to the correct parent dock.
- Migrated browser visits, discoveries and Island Walks into the four parent IDs without dropping granular reading records, settings, boat finish, Sea Life, secrets or valid challenge bests. Voyage progress is now **4 visits + 6 discoveries + 3 challenges = 13**.
- Repositioned the cargo bay, navigation lights, rock arch, reefs, toys, marine habitats and three imported NPC routes. The six-gate outer race is unchanged; Cargo Dock retains its relative challenge geometry, so both existing timed records remain valid.
- Generated matching high/low geometry and walk data. Character routes use surface-height-aware paths, including Research’s ramp; docking and fleet clearance use actual pier dimensions.

### V10 — Imported Fleet

- Replaced the five procedural NPC ship silhouettes with three supplied Tripo models: one cruise ship and two distinct luxury yachts. Jack's drivable runabout and its three saved finishes are unchanged.
- Fitted each model to a safe waterline and route-specific size/orientation; retained yielding, finite-mass collisions, horn-light replies, wakes, and high/low distance switching.
- Created textured high and low runtime variants. Meshes are simplified from roughly **0.96–1.95 million source triangles** to **21,192–23,392 high-detail** and **4,332–6,068 low-detail** triangles. Textures are capped at **1024 px / 512 px**; Meshopt-compressed fleet assets total **2,265,008 bytes**.
- The supplied originals are not copied into this repository. [`scripts/import-fleet-assets.mjs`](scripts/import-fleet-assets.mjs) rebuilds the runtime files when given the original GLBs.

### V9 — Imported Chibi Jack

The supplied Tripo export was a static, roughly 993,000-triangle model with no skeleton or animation. V9 uses that actual mesh and texture. It welds duplicated UV seam positions before reduction, removes six detached artifacts, fits a 19-joint skeleton, corrects skin weights, and authors idle, walk, run, helm, interact, sit and stand motions. The runtime asset is 44,756 triangles, one material and approximately 1.03 MB, with fixed palm contacts and recalibrated bench seating. The supplied face remains static; it does not acquire the old procedural avatar’s blink rig.

The prior procedural asset and generator are retained for historical comparison. The game and default model reviewer load `jack-imported.glb`; `?model=jack&legacy` reviews the old version. See [imported avatar source notes](assets/source/imported-jack/README.md) for provenance, reproduction and limits.

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
- Added 38 compressed fleet/fauna/detail GLBs totaling 705,992 bytes. The V3 main boat was 139,100 bytes, 11,129 triangles, and 16 material batches.

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

### V4.4 — The Concept Comes Aboard

Rebuilt Jack around the supplied character concept, rather than continuing the close-fitting V4.3 haircut:

- Sculpted overlapping, voluminous chestnut locks, three swept forelocks, a small crown curl, real flow grooves and a fine procedural strand surface. The hidden scalp is coverage beneath the hairstyle rather than its main visible shape.
- Returned to approximately **2.67 heads tall** at the same 1.30-unit standing height. A rounded face, simple highlighted black oval eyes, gentle brows, small nose and smile follow the reference’s facial language.
- Replaced the closed bomber silhouette with an open cream jacket, folded collar, navy tee, zipper teeth and orange pull. Reshaped trousers, cuffs and cream sneakers to match the reference’s outfit.
- Recalibrated the shared skeleton, gait contact, bench placement and fixed helm pose for the changed proportions. Added a regression against the existing boat-space wheel grips.
- Preserved blinking/expressions, one shared character, nine-island walking, all sea gameplay and browser records. The reference is translated into an original real-time model; a single concept sheet does not define an identical render from every angle.

### V4.5 — A Little More Jack

Refined the body to match the concept’s relaxed, cute stance:

- Shortened the torso and limbs while keeping the same **1.30-unit height**. The decoded model measures **2.40 heads tall**; the entire face, facial pivots and layered hairstyle scale together.
- Moved the shoulders slightly outward, corrected the inward arm-rotation direction, and shared a relaxed outward stance across idle, walk, run, interaction and standing. Neutral waist-side clearance is about **19 mm**, with **65 mm** between each hand and the trousers.
- Refitted the jacket, cuffs and rounded trouser seat to the shorter skeleton. Rebaked sole contact and bench placement; the original fixed boat-space wheel grips remain unchanged.
- Normalized compressed animation quaternions before expressions to keep articulated transforms stable through boat rotations. Steering still does not move the hands.
- Added checks against the actual deformed, compressed model for head/body ratio and arm clearance. Retained the same 22-joint skin, seven clips, six material batches, island interactions and saved records.

### V4.6 — Soft Shapes & Shorter Legs

Rebuilt the main character surfaces around the selected soft oval-face concept:

- Shortened the legs and torso to **1.20 units** while retaining the approximately **0.542-unit head**. The decoded model is **2.21 heads tall**; jacket hem to sole is **30.2%** of standing height, compared with V4.5's 36.2%.
- Sculpted separate temple, cheek, jaw and chin cross-sections, placed the facial features on the new surface, and refitted the hidden scalp beneath the layered side-parted locks.
- Replaced the separate box-like trouser waist and leg tubes with one continuous, skinned pelvis/crotch/leg surface. Added soft folds and cuff contours; reshaped the shoulder transition, oval sleeve cuffs, rounded collar and continuous sneaker uppers.
- Preserved the relaxed arm gap and original fixed boat-space wheel grips. Rebaked gait contact, refitted bench placement, lowered the character collision capsule and adjusted walking-camera aim for the shorter body.
- Added decoded-model measurements for visible leg length, face silhouette and connected trousers, closed-surface checks for the face and shoes, and a seated-cloth regression covering the full trouser surface. One 22-joint skin, seven clips, six material batches and the existing asset budget remain.

### V5 — Sculpted Bay

Refined the original real-time world around the supplied warm, detailed character-and-dock concept:

- Refined Jack’s cheeks, eyelids, layered hair, garment transitions and footwear while preserving the **1.20-unit / approximately 2.2-head** short silhouette, relaxed arms and fixed driving hands. The shared GLB retains **22 joints, seven clips and six material batches**, at **346,044 bytes / 37,212 triangles**.
- Added a real Blender high-to-runtime hair normal bake on a unique secondary UV atlas. Reusable original fabric and upholstery maps provide subtler surface detail. Editable character sources and the bake report live in [`assets/source/jack`](assets/source/jack/README.md).
- Refined the runabout’s continuous hull, padded seating and clean seams; retained three finishes and the existing helm/engine pivots. Refined Harbor’s pier boards, nails, curved ropes and knots, fenders, palms and coastal planting. Boat and Harbor source parts are available in [`art/v5`](art/v5/boat-harbor.md).
- Preserved UVs through export and compression. Added shared, versioned **high/low KTX2** surface packs for wood, canvas, upholstery, stone, sand and rope, plus the character hair bake. Assets load after the initial playable scene; failed surface requests retain usable base materials, and quality changes release replaced maps.
- Added a procedural daylight environment, warm directional sunlight, actor-following shadows, high-quality **half-resolution GTAO and FXAA**, and retained **1024-pixel shadows in low quality**. The rendering path falls back to daylight-only shading if post-processing is unavailable.
- Rebuilt water shading around a depth/shore-distance field derived from the actual island coastlines: shallow turquoise gradients, sand/stone patterns, slow caustics, foam and glints. The final water material stays opaque; it does not make the whole sea transparent.
- Kept the other **eight islands’ high/low GLBs byte-identical** and retained the walking layout, verified portfolio content, controls, challenges and local records. They share the new scene lighting; their geometry has not been fully resculpted in this version.
- Added a development-only actual-asset review page and documented reproducible model/surface builds. The concept guides the style; the real-time result is not claimed to be pixel-identical to the illustration.

The optional high texture pack is **2,885,401 bytes**, plus **584,862 bytes** for the shared Basis transcoder; the low pack is **887,306 bytes** plus the same decoder. These are file sizes, not measured cold-network timings. See [`VALIDATION.md`](VALIDATION.md) for the tested devices, browser paths and remaining performance limits.

### V6 — Sunset Bay

Recast the complete bay as a fixed, cinematic orange-and-violet evening:

- Unified the low sun, procedural HDR sky, environment reflections and ocean glitter around one world-space direction. Warm light, violet shade and a gentle camera-side sky fill preserve faces, clothing and hull detail. Shadows now follow the viewed island or exhibit during direct reading as well as the active player during exploration.
- Reworked the opaque sea with indigo depths, muted teal shallows, organic seabed variation, warm foam and broken orange-gold reflections. A bounded water specular response avoids washing the sea into a solid white sheet. Reduced motion freezes surface movement; low quality retains the sunset palette and shadows.
- Gave all nine islands individual material palettes and original small landmark details: lanterns and bell fittings, station clock trim and rail fasteners, pipe collars, greenhouse framing and plant markers, wind-chime rims, instrument scales, canopy seams and meal packaging, book spines, and postal/antenna details.
- Preserved UVs in all 18 high/low island GLBs so wood, stone and sand can share the existing KTX2 surface library. Warm lamps use modest emissive materials rather than many new point lights. Glass keeps its authored transparency after occlusion fading.
- Refined the three boat finishes and material roughness without changing the boat or Jack geometry. Jack keeps the same short proportions, vertex-colored expressions, seven clips and stationary driving hands. Walk layouts, collision routes, résumé content, challenge logic and record formats are unchanged.
- Updated the interface to warm ivory and deep violet, including a readable welcome card over bright sea reflections. There is no day/night cycle or additional theme setting.

The 18 compressed island GLBs total **6,776,208 bytes** (high: **4,060,164**, low: **2,716,044**); they load by distance and quality rather than all at startup. Existing surface packs are reused. **198 automated checks pass**; actual WebGPU/WebGL2 and four viewport checks are documented in [`VALIDATION.md`](VALIDATION.md).


### V7 — Textured Crop & Compact Silhouette

- Replaced the side-swept hair with a short tapered cap, three forward crown groups and three lifted front tufts. Real shallow grooves and the shared hair surfaces retain the original chestnut palette.
- Reshaped the upper jacket and tee without enlarging the waist, slimmed the sleeve profile, and moved each shoulder root inward by 5 mm. The shoulder cap still blends Chest and Arm weights so it follows the existing animations.
- Reduced shoe length and width by **17.5%**, including the soles, uppers, seams and laces; retained shoe height and the floor datum. Reduced palm/thumb geometry by **7%** around the existing hand pivots.
- Preserved the face, head scale, approximately **2.2-head / 1.20-unit** height, outfit design, materials, seven clips and fixed helm grip targets. Refitted the exported gait contact against the smaller soles.
- Added actual decoded-geometry regressions and front/three-quarter/side asset review with selectable poses. Validation measurements and remaining device limits are recorded in [`VALIDATION.md`](VALIDATION.md).

The shipped Jack is **330,144 bytes / 34,764 triangles / six material batches**. **220 automated checks pass**. [Actual model views](art/v7/jack-materials.png) show the runtime GLB, with [neutral clay](art/v7/jack-clay.png), [helm](art/v7/jack-helm.png), [walking](art/v7/jack-walk.png) and [seated](art/v7/jack-sit.png) captures. These are rendered assets, not concept images.

### V8 — Reference-Inspired Chibi Captain

- Reworked Jack's hair into fuller, unevenly layered forward locks with visible sculpted strand grooves, and enlarged the glossy eyes while retaining the existing facial rig and blink behavior.
- Changed the outfit to a graphite jacket and shoes, deep teal shirt, dark trousers, and small sea-glass piping inspired by the supplied chibi's sporty palette.
- Kept the existing 1.20-unit silhouette, 22-joint shared skeleton, seven clips, helm hand targets, six material batches, and island/boat interactions.
- Used the downloaded Sketchfab model only as an appearance reference. Its static geometry and textures are not included in the site.

The generated runtime model and decoded-geometry checks are recorded in [`VALIDATION.md`](VALIDATION.md).


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
| `npm test` | Run physics, camera, input, challenge, and current gameplay, migration and historical asset regression tests |

No API keys, backend, account setup, or environment variables are required to run the portfolio.

## Controls and interactions

| Action | Keyboard / mouse |
| --- | --- |
| Throttle | W / ↑ |
| Brake, then reverse | S / ↓ |
| Steer | A / D or ← / → |
| Boost / run | Hold Shift for 2× movement speed |
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

Touch devices have a camera-relative joystick and on-screen driving, horn, reading, and action buttons. Boat Studio is available from Jack’s Harbor and Settings. On land, the joystick moves Jack and Boost becomes Run; both Shift and the on-screen speed button double movement speed. Move to stand up from a bench; use Return to boat from anywhere on the current island.

Opening a menu or switching away pauses simulation; an active challenge resumes after a short countdown. Going ashore, resetting, and traveling cancel an unfinished challenge. On land, the parked boat stays locked while sea life and traffic continue. Reading pauses the whole simulation. Sound starts off, and visual cues remain available while muted.

## Technology and structure

Built with **vanilla JavaScript, Vite, Three.js / TSL, and Rapier**. HTML panels provide keyboard-accessible portfolio content over the 3D world. Original GLBs use Meshopt compression, preserved UVs, shared PBR materials, and high/low variants. KTX2 textures are transcoded to formats supported by the active renderer. Visual boat motion is separate from collision physics.

```text
sources/
  content.json           Shared résumé-backed portfolio content
  config.js              Islands, docks, safe points, and course configuration
  main.js                HTML interface and application coordination
  game.js                Renderer, world loading, and simulation loop
  review.html / review.js Development-only actual-model inspection
  core/                  Boat, camera, input, challenges, discovery, and docking
  world/                 Islands, props, fleet, marine life, water, and feedback
scripts/                 Model builders, original surface generator, compression tools
art/v5/                  Editable boat/Harbor Blender snapshots and notes
assets/source/jack/      Editable character source, hair bake and reports
static/
  models/                Compressed GLBs and asset manifests
  textures/v5/           High/low KTX2 surfaces, manifest and Basis transcoder
  resume.pdf             Original supplied résumé
  licenses/              Asset/font notices
tests/                   Automated regression checks
```

`PlayerController` separates locomotion from pause reasons; `BoardingController` commits one actor transition at the fade midpoint; `CharacterController` handles the kinematic capsule; `IslandWalkWorld` consumes `walk-layout.json` for shared high/low terrain and obstacles. `JackAvatar` reparents one skin between the boat and world. `CameraRig` manages framing; `ChallengeManager` owns challenge state and timing; `DiscoveryStore` persists local progress. `AmbientFleet`, `MarineLife`, `DockInteraction` and `BoatAppearance` provide the sea systems. `SurfaceLibrary` manages shared texture bindings and quality changes; `BayLighting` manages daylight and contact shading. V4 island details are integrated into the walkable models; legacy `IslandDetails` overlays are disabled to keep paths clear. Contact feedback uses a shared dispatch path.

## Customize the content

- Edit [`sources/content.json`](sources/content.json) to update the nine entries. The scene, panels, directory, and reading mode share this data.
- Edit [`sources/portfolio-groups.js`](sources/portfolio-groups.js) for parent-to-story grouping, and [`sources/config.js`](sources/config.js) for world positions, safe headings and courses. Generated manifests own actual shoreline and dock dimensions.
- Replace [`static/resume.pdf`](static/resume.pdf) when updating the résumé.
- Add verified external links to an entry’s `links` array. Unconfigured GitHub/project demo links remain hidden; placeholder destinations are not presented as real projects.

Career facts and project claims come from the supplied résumé. Island devices are concept illustrations, not actual application screenshots or live business data.

## Rebuild the original assets

Generated assets are checked in. Regenerate the current character and islands with:

```sh
node scripts/build-jack.mjs # legacy procedural model
node scripts/build-imported-jack.mjs # current playable imported character
node scripts/build-walk-islands.mjs
```

The island builder exports all four V11 parent islands in both quality variants plus `walk-layout.json`, preserving the existing boat and avatar. Use `node scripts/build-walk-islands.mjs` for the current islands. The earlier `build-assets`, compression and low-asset scripts remain historical tools and would overwrite current manifests; do not run them to rebuild V11. Old individual island GLBs remain historical fixtures and are not loaded by the current game.

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

To regenerate original V5 surface packs, install Python with NumPy and Pillow, and the free Khronos `toktx` tool (tested with KTX-Software 4.4.2):

```sh
python3 scripts/build-v5-surfaces.py --toktx /path/to/toktx
```

The checked-in Jack hair bake is used by default. Rebuilding that bake additionally requires Blender 4.5; follow [`assets/source/jack/README.md`](assets/source/jack/README.md). The other surface maps are procedural tiles, not photographs or high-to-low sculpt bakes. [`art/v5/boat-harbor.md`](art/v5/boat-harbor.md) describes optional unmerged GLB export and editable boat/Harbor source snapshots. Build-only tools are not needed to run the site.

Intermediate files live in ignored `.asset-build/`. Core compressed geometry sizes are recorded in the model manifests and `static/models/compression.json`; texture sizes, encodings and hashes are recorded in `static/textures/v5/manifest.json`. Visual detail remains separate from gameplay collisions.

### Inspect actual assets locally

With the development server running, open `/review.html?model=jack`, `/review.html?model=boat`, or `/review.html?model=about` (also `experience`, `projects`, `education`). `model=harbor` keeps the legacy Harbor comparison. Add `&clay` for neutral materials or `&webgl` for WebGL2. The viewer loads the same GLBs and surface library as the game and shows front, three-quarter and side views. It is not an image-generation mockup.

The review entry is excluded from Vite’s production build. Its **Save render** button expects an optional local screenshot receiver at `127.0.0.1:5174`; model inspection itself does not require that receiver.

## Accessibility, storage, and validation

- **Rendering fallback:** WebGPU normally falls back to WebGL2, then to HTML reading mode if 3D fails. Use `?webgl` to request WebGL2 or `?no3d` for reading mode.
- **Accessibility:** keyboard navigation, visible focus, panel focus restoration, reduced motion, optional sound, and direct access to all portfolio entries.
- **Local storage only:** preferences, boat finish, exploration records, Sea Life observations, Island Walks, separate camera zoom preferences, and versioned challenge bests. Transient world positions are never saved; every refresh starts Jack aboard at the harbor. Blocked storage falls back to an in-memory session. There are no accounts, remote leaderboards, or application database.
- **Recorded V5 verification:** 192 automated checks passed, and the production build passed. Browser samples cover desktop-hosted WebGL2 high/low with phone-sized viewports; these are not physical-phone results. See [`VALIDATION.md`](VALIDATION.md) for conditions, measurements, and remaining limits.

Physical iPhone/Android performance, sustained mobile 30 FPS, controlled 20 Mbps cold-start timing, and long-duration thermal behavior have not yet been measured. Desktop viewport emulation does not establish those results.

## Hosting

`npm run build` produces a static site in `dist/`. The public portfolio at **https://kongsterrr.com** is hosted with Sites; [`.openai/hosting.json`](.openai/hosting.json) identifies that deployment and its build directory. This repository contains no deployment credentials. The repository contains source history; the live deployment uses the saved, built version of that source. Domain and access settings are managed separately from source visibility.

## Inspiration and licensing

Inspired by [Bruno Simon’s portfolio](https://bruno-simon.com/) and the organization of [`folio-2025` at commit `41046b5`](https://github.com/brunosimon/folio-2025/tree/41046b57eeed8d156d9c3fd7fa259900baef7816). This project retains the small event dispatcher and its MIT attribution and adapts the input, update-loop, interaction-area, and camera-mode approach for an original ocean world.

The V9 character mesh and texture were supplied by Jack from Tripo; their provenance is listed separately in the asset notices. The boat, islands, fleet, animals, effects, progression and portfolio content are specific to Jack’s Archipelago. Bruno’s car, world assets, branding, personal content, music, and private services are not shipped.

See [`LICENSE`](LICENSE) for the preserved MIT license and [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) for dependency, font, résumé, and asset provenance.
