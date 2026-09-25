# V12.1 — Harbor Quad repair · 2026-09-25

The initial V12 did not meet the intended placement or rider fit. Its runtime triangle slicing lost source transforms and only extracted parts of the tires; a failed footprint check teleported the bike to spawn. This patch replaces those mechanisms.

## Real assets and contact fit

The owner-supplied original GLB is reprocessed into a chassis and four complete named wheel assemblies **before** Meshopt compression. All 1,882,496 source triangles are assigned once before simplification. Actual decoded high/low GLBs retain full wheel width, diameter, and all 36 angular tread sectors. High: **80,413 triangles / 1,031,536 bytes**, 2048 texture. Low: **26,328 triangles / 411,464 bytes**, 1024 texture. The two variants total 1,443,000 bytes; only the selected quality loads. These higher detail budgets intentionally replace the earlier aggressive 630 KB pair.

The bike uses scale 1.65 and Jack keeps his natural scale 1.0. A dedicated straddling pose fits the saddle and grips, with compact raised foot supports. Actual pelvic skin clears the saddle, feet match supports within 2 mm, and live skinned-hand centroids are approximately **7.1 / 7.3 mm** from their grip contacts. Contact anchors are within 0.0001 units; arm bones are not stretched. Tests include a first mount at nonzero world position/yaw after boat and walking poses, plus repeated transitions using the same avatar.

## Collision and state checks

Parking is at Projects local **(2.5, 27)**, immediately inland of the harbor pier. The bike is visible as Projects loads. Both pedestrian arrival routes and the route into the island remain clear. Rotated footprint intersection catches thin obstacles between the old sample points. Swept translation and turning stop or slide locally; reverse escapes contact. Explicit R Reset remains the way to return to parking. The parked collider participates in Jack's walking collisions.

Actual-game browser check: sustained boosted contact stopped at world **(76.3022, 10.5)** instead of returning to harbor **(49, 10.5)**. Additional held throttle left position and wheel angle unchanged. Reverse moved away to **(72.7412, 10.5)** and reversed wheel rotation. Separate Rapier tests cover frontal/oblique impacts, steering beside a wall, thin posts, safe dismount, parking, and matching travel under 30/60/120 render schedules.

## Browser and build verification

Local macOS workstation, Codex in-app browser: WebGPU/high, high→low quality switching, reduced motion, and WebGL2/low completed mount and driving. E mount/dismount, reading→resume at zero speed, and reading→Travel→close returned to the correct actor without stale motion. No browser error was reported in the final WebGL2 session. Wheel meshes were inspected from front, side and three-quarter views at zero and 90° rotation plus steering; no missing tire sections were visible.

Viewport checks covered 1440×900, 1920×1080, 390×844 and 844×390, with riding, dismount and mobile driving controls accessible. These are desktop viewport checks, not physical mobile hardware measurements. No new sustained FPS, cold-network or thermal benchmark is claimed. Production Vite build passes; the existing Rapier initialization warning remains.

The final full suite passes **262/262 tests**, including actual-asset, rider and collision regressions. The review page is development-only and renders the same runtime GLBs and rider pose; it is not a generated concept image.

# V11 — Four Isles validation · 2026-09-25

## Runtime and content

Nine separate islands have become four continuous physical islands: About, Experience, Projects and Education. The original nine records in `sources/content.json`, the imported Jack GLB and the drivable boat GLB are unchanged. There are 28 exhibit/action stations and nine benches across the grouped districts. Each parent has two validated boat berths and one accessible main dock.

The complete automated suite passes **242/242 tests**. Coverage includes actual Rapier walking loops on all four generated islands (no rescue teleports), both boat berths, station clearance, dock approach/hysteresis, grouped content routing, historical storage migration, all 24 toy spawns, imported fleet swept-hull clearance, two-minute fleet simulations and 30/60/120 render schedules. Existing tests that still expected the pre-V9 Shift speeds were corrected to the already-shipped 24-unit/second boat boost and 4.8-unit/second run.

New actual-GLB tests verify high/low district action isolation, transformed Amtrak pedestrian stopping, one animation transform per semantic node, independent emissive materials, per-district sunset palettes, quality rebind cleanup and story-specific reading highlights. Integration found and fixed a Research route that approached an elevated platform without its ramp, a Catering station next to a table collider, duplicate group/mesh animations and shared district glow materials.

## Browser checks

Local Apple M3 Max workstation, Codex in-app browser. WebGPU/high and WebGPU/low loaded; WebGL2/low loaded and completed Education landing, and switching back to high quality succeeded. All four islands completed travel → go ashore → board at zero boat speed. Projects was run on foot using the same camera-relative input as keyboard/touch. Starting all three sea challenges from shore/sailing restored the sailing actor; reading then traveling cancelled the challenge and left no pause reason or old velocity.

The map shows four named category destinations and three separate game destinations. Experience overview and Research story panels were visually checked. Responsive checks covered **1440×900, 1920×1080, 390×844 and 844×390**: no document horizontal overflow, accessible close buttons, scrollable reading panels and responsive controls. The explicit `?no3d` page displayed four groups and all nine stories, with the résumé link available.

Warm local samples reported **330 ms WebGPU/high** and **275 ms WebGL2/low** readiness, with a short idle sample at 144 FPS. These are cached desktop observations, not cold-network or physical-phone benchmarks. The existing Rapier initialization deprecation warning remains. No new runtime error was observed in the V11 browser checks; older device-loss logs from the earlier model-review session are not attributed to this version.

## Asset and compatibility notes

Four compressed high-detail island GLBs total **3,189,292 bytes**; their low-detail counterparts total **2,727,496 bytes**. High-detail islands range from 26,860 to 63,210 triangles; high/low variants share identical shoreline, dock, collision and walk-layout data. These figures cover islands only, not the full initial download. The three imported NPC ships and avatar keep their V10/V9 assets.

V11 storage merges legacy physical visit/discovery/landing IDs into the four parents, preserves individual story read status, preferences, liveries, Sea Life, secrets and timed challenge records, and remains usable when storage is denied. Progress is now 13 voyage stamps and four Island Walks. The outer race geometry is unchanged. Cargo Dock was translated as a whole without changing its relative puzzle layout, so its old course key remains valid.

Physical mobile performance, cold 20 Mbps transfer timing, sustained thermal behavior and long-duration memory profiling were **not measured**. Full scenic walking loops are now approximately 97–163 seconds at walking speed because islands are intentionally larger; direct reading and map travel remain available for quick visits.

# V10 — Imported Fleet validation · 2026-09-24

## V10 imported fleet

- Imported the three supplied cruise/yacht GLBs as six optimized high/low runtime assets. The build manifest records **2,265,008 bytes total**, high variants at **21,192–23,392 triangles** and low variants at **4,332–6,068 triangles**.
- The development-only `/fleet-review.html` loaded and decoded each optimized high-detail GLB in the local browser. Fleet runtime loading requests both quality variants for each of the three routes.
- Production Vite build passed after the asset and fleet-route changes. Physical-device frame-rate and cold-network timings have not been measured for V10.

# V9 — Imported Chibi Jack validation · 2026-09-24

This release uses Jack’s supplied Tripo mesh and embedded base-color texture as the playable avatar. The original file had 992,744 triangles and no skin or animation. Local authoring welded UV seam positions before decimation, removed six disconnected artifacts, fitted 19 joints, normalized skin weights and authored seven movement clips. The prior procedural mesh remains as a legacy source/review fixture; it is no longer the runtime avatar.

## Asset and regression checks

- Runtime `jack-imported.glb?v=9`: **1,034,460 bytes, 44,756 triangles, one material, one skin, 19 joints, seven clips**. The original embedded JPEG is unchanged; the tests compare its hash against the source skin. The larger imported asset intentionally exceeds the earlier 350 KB procedural-character target, while retaining a small single-material draw footprint.
- Blender renders checked the actual imported model from front, side and three-quarter views and under 90-degree shoulder/hip stress. Welding before simplification eliminated the first experiment’s seam tears. The final source has no unweighted vertices and no more than four normalized influences per vertex.
- **225/225 tests pass**, and the Vite production build succeeds. Five new tests load the imported asset and verify source texture/skin integrity, decoded foot contact between baked frames, fixed palm contact across 30/60/120 Hz updates and boarding, bench-shin clearance, and clean rejection of a static export. Existing geometry-specific V4–V8 tests remain historical procedural-asset checks; the new tests cover the actual runtime replacement.
- Bake measurements: walk lowest foot about 0.0015 units, run 0.0015–0.0135; supporting seated surface about 0.001 above the bench, shin clearance about 0.110, no sampled body/seat-slat intersections. The shipped compressed asset also passes the runtime contact checks.

## Browser observations

Host: the existing Apple M3 Max workstation, Codex in-app browser, localhost. The actual GLB was reviewed in Three.js/WebGPU in front, side and three-quarter views. The game loaded the imported captain aboard the boat and after landing. Boat Studio’s close view was checked for seat/wheel placement. Nine islands each completed travel → go ashore → brief run → board, returning to sailing at zero speed with the avatar ready.

WebGL2 was checked with high/low quality and reduced motion. Desktop and phone **viewport emulation** covered 1440×900, 1920×1080, 390×844 and 844×390; the avatar remained present and boarding/walking controls stayed available. A warm WebGPU ready sample was 355 ms and a short Harbor sample reported 144 FPS; a WebGL2/low sample reported 123 FPS. These short desktop observations are not sustained benchmarks or physical-phone results. The existing Rapier initialization deprecation warning remains; no new browser error was observed during these checks.

The supplied face has no separate facial rig, so blinking and independent expressions are not claimed. A small source eyebrow mark is preserved. Fingers are not independently animated. Static HTML access, storage schemas, island content, movement speeds and world collisions are unchanged. Physical mobile performance, cold 20 Mbps loading and long-duration thermal/memory behavior remain unmeasured.

# V8 — Reference-Inspired Chibi Captain validation · 2026-09-24

V8 uses the downloaded chibi as a visual reference for fuller layered hair, a more expressive face, and a darker sporty palette. The supplied GLB was not bundled or used as the runtime character: it is a static, high-density mesh without the shared rig and seven authored animations required for driving and walking. Jack remains the site’s original optimized procedural character.

## Shipped character

The production asset is **332,828 bytes / 35,180 triangles / six material batches and six draw calls**, with one **22-joint** skin and the existing seven clips (`idle`, `walk`, `run`, `helm`, `interact`, `sit`, `stand`). Standing height remains **1.20 units**, the head remains **0.542 units** (2.214 heads tall), and the boat-space helm hand target error stays below **0.054 mm** with zero authored position or angle drift. Walk/run ground contact, fixed helm hands, sitting, and bench clearance continue to be measured from the generated production geometry.

Hair now has three overlapping crown locks and three forward fringe locks with shallow strand grooves and a tapered cap. The larger glossy eyes retain independent blink pivots; the authored white catchlights and their vertical placement were adjusted so the blink closes around the visual eye center without shifting the face. The outfit uses a graphite jacket and shoes, deep teal shirt, dark trousers, and restrained sea-glass piping. It keeps the existing six material batches, model size budget, surface binding, and all island/boat interactions.

## Verification and limits

The real V8 GLB was regenerated and inspected in the local model reviewer from front, three-quarter, and side views, then loaded in the actual sunset game preview aboard the runabout. Automated coverage checks the layered asymmetrical hair, open forehead, scalp embed, finite/non-degenerate geometry, retained joints/clips, camera framing, and existing gameplay. The full suite passes **220/220 automated checks**, and the Vite production build passes. Browser review was on the local preview; no new physical-phone or sustained performance test was run for V8.

The model cache key is `jack.glb?v=8`. No site routes, content facts, local records, or browser storage schema changed.

# V7 — Textured Crop & Compact Silhouette validation · 2026-09-24

V7 edits the existing shared-skeleton Jack. Face geometry, head scale, clothing design/colors, legs, collision configuration, gameplay and portfolio content are retained. The short crop uses a fitted cap, three forward crown groups and three short lifted fringe groups. It retains six material batches and the existing UV1 atlas; its material selects the reusable UV0 strand-flow normal instead of projecting the old V5 side-swept-hair bake onto different geometry. High/low swaps preserve this normal and the original material color.

## Actual geometry and visual review

The shipped GLB is **330,144 bytes / 34,764 triangles / six materials / six draw calls**, versus V6's 346,044 bytes / 37,212 triangles. It retains one 22-joint rig and all seven clips. Asset revision: `v7-spiky-crop-and-body`; runtime cache key: `jack.glb?v=7`.

Measurements below come from decoded, posed production geometry, in local character units. They do not use declared mesh dimensions as substitutes for geometry.

| Measurement | V6 | V7 | Change |
| --- | ---: | ---: | --- |
| Shoe width | 0.153740 | 0.126859 | −17.5% |
| Shoe length | 0.223469 | 0.184429 | −17.5% |
| Shoe height | 0.147002 | 0.147002 | retained |
| Upper coat width | 0.307927 | 0.325641 | +5.75% at sampled chest band |
| Waist width | 0.295358 | 0.295256 | retained within compression tolerance |
| Upper sleeve width | 0.141099 | 0.130332 | −7.6% |
| Upper sleeve depth | 0.148160 | 0.136807 | −7.7% |

Palm/thumb dimensions are approximately 7% smaller. Facial width, depth and seven cross-sections stay within 0.3 mm of the V6 decoded model. Full height remains 1.20 with the existing approximately 2.2-head silhouette. The neutral sleeve/waist gap is now approximately **14 mm**, deliberately closer than V4.5's 15 mm minimum; the updated neutral lower bound is 10 mm, and moving-sleeve penetration tolerance remains 1 mm. Shoulder checks include Chest/Arm blended triangles, sample 25 frames in each of seven clips and measure projected overlap at three shoulder bands from front, side and three-quarter views. These checks detect detached roots; they do not replace artistic review of surface shading.

Actual runtime renders: [materials](art/v7/jack-materials.png), [neutral clay](art/v7/jack-clay.png), [helm](art/v7/jack-helm.png), [walk](art/v7/jack-walk.png), [sit](art/v7/jack-sit.png). All show the final exported GLB, not generated concepts. Hair refinement corrected floating roots and excessive vertical spikes before these captures. The development reviewer also accepts a valid `pose` and finite `time`; invalid values fall back safely.

## Automated and browser verification

**220 automated checks pass.** New coverage verifies actual shoe/hand reductions, preserved face/body height, shoulder connection across all clips, short forward hair flow/root coverage, and retention of the new normal map across high/low texture swaps. The character exporter samples **481 frames each** for walk/run floor contact and **121 helm frames** for fixed hands. Maximum decoded helm target error is **0.054 mm**, with zero position/orientation drift. Walking sole height stays 1.16–1.77 mm above ground; running stays 0.58–19.43 mm, including its authored flight phase. The seated asset passes bench clearance with no trouser/slat intersections.

Browser host: **Apple M3 Max / macOS / headless Chrome 154.0.8037.57**, using the real local Vite game and renderer, with the existing WebMCP action handlers exposed to the test harness. WebGL2/high was visually checked at **1440×900, 1920×1080, 390×844 and 844×390**. Additional sessions checked WebGPU/high at desktop size, WebGL2/low at portrait size, and WebGPU/low at landscape size. Low sessions enabled reduced motion. Every session completed Travel → Go ashore → walk/run → read/close → Board → steer, ending in sailing mode without retained pause reasons. No page/console errors or surface failures occurred.

| Final short frame sample | p50 | p95 |
| --- | ---: | ---: |
| WebGL2 / high | 16.8 ms | 17.3 ms |
| WebGPU / high | 16.7 ms | 17.6 ms |
| WebGL2 / low / reduced motion | 16.8 ms | 17.3 ms |
| WebGPU / low / reduced motion | 16.7 ms | 17.5 ms |

These are short desktop headless-browser frame intervals, not GPU timings, sustained performance guarantees or physical phone benchmarks. Physical iOS/Android/Safari and controlled network tests remain unmeasured. V7 introduces no new asset downloads beyond the smaller replacement GLB, and no storage migration. Public access at **kongsterrr.com** and existing domain settings are preserved.

---

# V6 — Sunset Bay validation · 2026-09-23

V6 is a fixed orange-and-violet sunset treatment. This section records the actual shipped implementation; earlier sections describe their own historical versions.

## Lighting, materials and geometry

The procedural HDR sky, directional light and ocean glitter use one normalized world-space sun direction, approximately **22° above the horizon**. Golden light and a modest cool sky fill keep backlit faces and hulls readable. High quality retains the existing half-resolution GTAO/FXAA graph; low retains 1024-pixel shadows. Shadow coverage follows the current island/exhibit during reading, the boat in Boat Studio, and the controlled actor while exploring. No day/night clock or new theme toggle was introduced.

The opaque water uses organic noise for the seabed, indigo/teal depth color, warm foam and broken orange-gold reflections. Water's physical specular intensity is bounded so reflected light does not cover the whole sea. Reduced motion freezes the water time. This is an authored real-time reflection treatment, not a claim of fully simulated optical water or global illumination.

All nine landmarks gained small original geometry details and separate color treatment. High and low island GLBs retain UV0 and share the existing wood, stone, sand and rope maps. Warm lantern/window materials are emissive without adding a field of point lights. Transparent greenhouse/lighthouse surfaces preserve their original alpha when the occlusion system fades and restores them. Puzzle signal colors and animated device materials retain their semantic identity.

| Actual compressed asset set | Bytes | Triangles | Material primitives |
| --- | ---: | ---: | ---: |
| Nine high-quality islands | 4,060,164 | 231,386 | 428 |
| Nine low-quality islands | 2,716,044 | 151,550 | 404 |
| Both island variants | **6,776,208** | — | — |

All 18 island GLBs decode successfully with finite UV coordinates and triangle counts matching their manifests. Catering canopy seams and Research instrument collars were aligned to their underlying surfaces. The island generator remains the geometry authority; V5 Blender snapshots describe their historical V5 assets.

Compared with V5 commit `1d3b9e9898ba9bd737290697005bd42b5292d418`, Jack and boat GLBs, walking layout, shoreline and dock configurations, résumé/content data, character proportions, movement/collision logic, challenges and record schema remain unchanged. Jack remains **346,044 B / 37,212 triangles / six material batches**, and the boat **259,708 B / 18,031 triangles / 16 batches**. Runtime material changes preserve Jack's authored vertex colors and all three boat finishes.

## Automated and browser checks

**198 automated checks pass** and the Vite production build passes. New checks exercise actual Jack/boat material binding, livery rebinds, per-model isolation, preserved vertex colors, source material release, transparent occluders and alignment of the HDR sun with the world light. Existing movement at 30/60/120 FPS, character framing, fixed driving hands, nine-island routes and challenge-state checks remain in the suite.

Host: **Apple M3 Max / macOS / Codex in-app browser**. Checked desktop **1440×900 / 1920×1080** and emulated phone **390×844 / 844×390**. Actual visual checks covered the sunset sea, Harbor/Connect piers and Jack, Amtrak and VisionX reading views, boat finishes and mobile HUD/panels. All nine islands completed Travel → Go ashore with the expected island and no retained pause reason.

| Local short sample | Viewport | p50 frame interval | p95 frame interval |
| --- | --- | ---: | ---: |
| WebGPU / high, Harbor walking | 1440×900 | 6.9 ms | 8.4 ms |
| WebGPU / low, reduced motion | 390×844 | 6.9 ms | 8.6 ms |
| WebGL2 / high, Harbor walking | 390×844 | 6.9 ms | 8.3 ms |
| WebGL2 / low, nine islands loaded | 844×390 | 6.9 ms | 8.4 ms |

These are recent frame-interval samples on the desktop host, not GPU timings or sustained phone benchmarks. Loading and shader compilation produced transient lower frame samples. The material library reported 19 shared maps and no surface failures. No render errors appeared in the checked WebGPU/WebGL2 sessions; the existing Rapier initialization deprecation warning remains.

Browser regression also covered three livery choices, high/low/high switching, reduced motion, all three challenge starts, and boost → reading → travel → close (zero speed, no active challenge or stale pause). The explicit `?no3d` page retained all nine portfolio entries; the résumé download remains the unchanged PDF. Local records were retained through renderer/quality reloads. No new storage format was needed.

## Resources and limits

The exact production HTML/CSS/JS plus first boat, Jack, Harbor, Connect and walking-layout assets totals **5,367,437 B raw / 1,898,703 B estimated gzip**. This excludes external fonts and optional post-ready content. It is a file budget calculation, not a 20 Mbps cold-network test. All tested model copies match production output.

The original V5 optional high/low KTX2 packs are reused without extra texture downloads: high **2,885,401 B**, low **887,306 B**, plus one shared **584,862 B** Basis transcoder. The full island set is distance/quality loaded, not part of the first playable download. The expanded UV coordinates account for much of the island byte increase.

Physical iPhone/Android and mobile Safari, controlled 20 Mbps cold starts, sustained thermal performance and device-level VRAM usage remain unmeasured. The 60 FPS desktop / 30 FPS phone and 5-second cold-start values remain targets where not measured. No new production access permissions are introduced; the source stays public and the existing hosted preview stays owner-private.

---

# V5 — Sculpted Bay validation · 2026-09-22

This section records V5. Earlier sections retain the measurements and limitations of their own historical builds.

## Scope and actual assets

The supplied dock/character illustration guided shape, color, material response and lighting. Validation uses decoded GLBs and actual rendered scenes; it does not establish pixel-identical agreement with the generated concept.

Jack retains the approximately 1.20-unit, 2.2-head short silhouette and stable helm contacts. The shared model is **346,044 bytes**, **37,212 triangles**, **six material primitives**, one **22-joint** skin and **seven animation clips**. Refined surfaces include the face, layered hairstyle, garment transitions and footwear. The real Cycles high-to-runtime hair normal bake uses a unique secondary UV atlas; the remaining material tiles are original procedural height/color/roughness fields. Editable source, cage/sculpt collections and bake metadata live in `assets/source/jack/`.

The runabout is **259,708 bytes / 18,031 triangles / 16 batches**. Harbor is **618,176 bytes / 48,104 triangles / 52 batches** in high quality, and **314,936 bytes / 22,064 triangles / 47 batches** in low quality. Both retain decoded UV attributes. Hull and cushion curves, pier bevels and fasteners, ropes and knots, fenders, palms and shore planting were refined. Single-surface Harbor paths remove coplanar dark joins; palm backface construction no longer cancels normals. Editable boat/Harbor snapshots are in `art/v5/`; the reproducible geometry authority remains the JavaScript generators.

All **16 non-Harbor island GLBs** (eight islands × two quality levels), and `walk-layout.json`, were compared with V4.6 and remain byte-identical. Existing shorelines, walking routes, obstacles, berths, exhibit IDs, résumé content and gameplay records are preserved.

## Rendering, resources and automated checks

The new lighting path adds a procedural daytime environment, warm sunlight and actor-following shadow coverage. High quality uses half-resolution Three.js GTAO with restrained contact strength, followed by FXAA. Low quality omits the post-processing chain and retains a **1024 × 1024** shadow map. Post-processing failures fall back to daylight rendering. Ocean shading uses an actual-shoreline depth/distance field, shallow/deep color transitions, procedural sand/stone patterns, caustics, foam and glints; the final water surface remains opaque.

The post-processing graph is created only when high quality is first used and then retained for the scene lifetime. Switching to low bypasses it; returning to high reuses it. This avoids stale Three.js r183 GPU bindings on graph recreation. A low-only session does not allocate those targets. After high has been used, a low session retains one fixed set of targets; repeated toggles do not keep allocating graphs. The regression checks final release of the scene target, FXAA intermediate target/material and GTAO noise texture.

Optional surface packs load after the initial playable scene. A single library shares KTX2 maps, preserves livery colors, invalidates stale quality requests and releases replaced maps. Partial or failed texture requests retain usable base materials.

| Optional resource | High quality | Low quality |
| --- | ---: | ---: |
| Texture pack | 2,885,401 B | 887,306 B |
| Shared Basis JS/WASM transcoder | 584,862 B | 584,862 B |
| Combined one-quality total | **3,470,263 B** | **1,472,168 B** |

The initial HTML/CSS/JavaScript bundle plus boat, Jack, Harbor, Connect and walk-layout assets totals **5,208,246 B raw** or **1,851,583 B estimated with gzip**, excluding external fonts and optional post-ready assets. This file-based budget check is not an observed cold-network transfer or load-time measurement. The tested Jack GLB matches the production copy byte for byte.

These are shipped file bytes, excluding the small manifest/license files and transport compression. The decoder is shared rather than fetched independently per material. Texture dimensions, mip counts, encodings, hashes and worst-case RGBA memory estimates are recorded in `static/textures/v5/manifest.json`; they do not represent a device-level VRAM measurement.

**192 automated checks pass**, and the production Vite build passes. Existing character proportions, fixed helm contacts, gait/bench behavior, four-view camera framing, walking routes and sea-gameplay tests remain covered. V5 checks cover shipped KTX2 structure/budgets, material bindings, quality replacement and release, failed texture fallback, and shoreline/light behavior. A separate decoded-asset audit confirmed finite UV coordinates and nonzero normals for all boat and high/low Harbor primitives. The scoped livery/fleet/island traversal run passed **29 checks**.

The local `/review.html` page loads actual runtime GLBs and the shared materials, with front, three-quarter and side views plus optional clay mode. It is excluded from the production build. Blender model-review images are offline asset inspections, distinct from game captures.

## Browser measurements and remaining limits

Host: **Apple M3 Max / macOS / Codex in-app browser**. The following measurements use desktop viewport emulation, not physical phones:

| Renderer / quality | Viewport | Observed frame sample |
| --- | --- | --- |
| WebGL2 / high | 390 × 844 | Approximately 144 FPS; p50 **6.9 ms**, p95 **7.7 ms** |
| WebGL2 / low | 844 × 390 | p50 **6.9 ms**, p95 **8.2 ms** |

These short local samples include the V5 surface/lighting path and do not certify sustained mobile performance or thermal behavior. WebGPU high was also checked at 1440 × 900 and 1920 × 1080. A warm local 1440-wide sample reported 144 FPS with p50 6.9 ms and p95 7.7 ms. No new rendering errors remained after the final shader fixes.

Browser regression covered all nine Travel → Go ashore transitions, walking, boarding, steering, reading → travel → close with zero restored velocity, and starting all three challenges. After the quality-switch fix, repeated low/high transitions retained the scene and the renderer texture count stayed at 40 in the same four-island warm scene, with 19 shared material maps. Maps and content stayed available at all four target viewport sizes. The explicit `?no3d` path displayed all nine readable entries and the résumé link.

No physical iPhone/Android, mobile Safari, controlled **20 Mbps cold-start** measurement or prolonged thermal/VRAM soak has been completed for V5. The **5-second initial-drive**, **60 FPS desktop** and **30 FPS mobile** goals remain performance targets where not directly measured. Desktop viewport checks do not substitute for physical-device results. Repository visibility and preview access are not changed by these rendering updates.

---

# V4.6 — Soft Shapes & Shorter Legs validation · 2026-09-20

## Actual sculpt and proportions

The selected A soft-oval concept informed an actual geometry rebuild, not only a scale change. The decoded idle model measures **1.19977 units tall**, **0.54182 units crown to chin**, and **2.214 heads tall**. Jacket hem to sole is **30.16%** of height (V4.5: 36.22%). The head retains its preceding size while the thigh/shin and torso become shorter.

The face is a closed loft with independently authored temple, cheek, jaw and chin sections. Its actual facial width/height is **0.957**, with the lower-jaw slice **76.6%** of the cheek width. The hair coverage shell is fitted to that new surface; inner rim construction retains outward normals. The shoulder cap blends into the chest, sleeve cuffs use oval folded contours, and shoes have continuous uppers. The trousers have one connected surface spanning Hips, both UpLegs and both Legs, replacing the disconnected rounded waist and leg primitives.

Neutral waist-side sleeve clearance is **15.8 mm**; hand-to-trouser clearance is **64.1 mm**. Original wheel grip positions and stationary hand rotations remain unchanged. The walking capsule is shortened to **1.14 units** (radius .22, half-height .35); camera aim drops from .65 to .60 above the feet. Existing boarding locations and boat dimensions remain valid.

## Regression and asset verification

**179 tests pass** on Node 24.19.0: all 173 preceding checks, with the intentionally changed height/ratio contracts updated, plus six checks for actual hem fraction, facial cross-sections, connected trousers, face/shoe surface closure and complete seated trouser clearance. The new bench regression samples **61 times × five headings**, including mixed Hips/UpLeg vertices that the previous shin-only check missed. The .336 forward seat offset keeps the full pants surface outside the wooden slats; pelvis support is about **3.0 mm** above the seat.

The build decodes the compressed GLB and checks 481 samples per gait. Lowest sole clearance is **1.02–1.71 mm walking**, **0.58–19.45 mm running**, including the deliberate short flight phase. The 121-sample helm loop retains zero hand drift. Existing tests continue to cover fixed-step movement at 30/60/120 FPS, animation interruptions, boarding, all nine routes, sea gameplay and persistent records.

Final GLB: **279,760 bytes**, **40,892 triangles**, **six material primitives**, one 22-joint skin and seven clips. It remains below the existing 350 KB / 43,000-triangle budget. No new network texture or runtime dependency is added. The marching-cubes table provenance and Three.js license are included.

Production Vite build passes under Node 24.19.0. `dist/models/jack.glb` equals the tested source byte for byte: SHA-256 `0cd0ffab3826e094ae529e8931db3df0f8f80317baa83b5801aa5610f011d33b`. Temporary review pages, prior-version comparison models and concept bitmaps are excluded from source and deployment.

## Visual review and limits

Reviewed the decoded GLB in front, side and three-quarter views, first in neutral clay and then with runtime materials. Compared the selected A concept at a similar full-body angle, and saved actual rendered model sheets. These are real model renders; lighting and illustrative detail are not claimed to be pixel-identical to the concept.

On the existing Apple M3 Max / macOS / Codex in-app browser, checked Connect landing, a seven-segment running route, bench sitting, standing, boarding, alternating steering and Harbor landing. Checked 1440×900, 1920×1080, 390×844 and 844×390 layouts. Portrait-to-landscape resizing preserved the exact character position. Actual-vertex camera tests continue to meet desktop 16–20% and portrait 18–24% height targets at all main headings.

WebGPU/high and WebGL2/low with reduced motion rendered the new model without observed console errors. A short WebGPU voyage sample reported **144 FPS**; this is not a sustained performance certification. Phone-sized views are desktop emulation. Physical phones, mobile Safari, controlled cold starts, prolonged thermal behavior and network-failure injection were not remeasured. Existing fallback tests, content, résumé, island assets, gameplay and record schema remain intact.

---

# V4.5 — A Little More Jack validation · 2026-09-20

## Proportions and relaxed arms

Jack retains the 1.30-unit standing height with a shorter torso and limbs. The final decoded idle skin measures **1.29976 units high**, a **0.54176-unit crown-to-chin span**, and **2.399 heads tall**. The complete head, facial pivots and V4.4 hairstyle scale together. Thighs and shins are 8% shorter; each arm segment is 0.158 units. Clothing is refitted, the trouser seat is rounder, and shoe sole thickness is preserved.

The old upper-arm rotation signs pointed inward. V4.5 uses a shared outward stance across land clips: 22° upper-arm abduction, 10° forearm inward angle and 12° neutral elbow flex. The 20° design starting point was adjusted after measuring the real sleeve surface. At the neutral waist slice (coat hem + 0.05), actual sleeve-to-jacket clearance is **18.74 mm per side**; palm/thumb-to-trouser clearance is **65.09 mm**. These measurements intersect deformed triangles with horizontal planes; they are not bone distances or empty bounding-box corners. Other cross-sections are recorded in `jack.manifest.json`.

## Automated and build verification

**173 regression checks pass** on Node 24.19.0, including four new compressed-skin proportion/clearance checks. The existing tests cover fixed wheel contact across steering, waves and 30/60/120 FPS; animation transitions and pauses; benches at all nine island orientations; actual-vertex camera framing at 1440×900, 1920×1080, 390×844 and 844×390; and existing walking/sea gameplay. Runtime bone quaternions are normalized after animation sampling, eliminating compression-induced non-orthogonal transforms without changing the fixed hand pose.

The final GLB is **278,940 bytes**, **42,680 triangles**, six material primitives, one shared 22-joint skeleton and seven clips. No additional character material, downloaded texture or gameplay dependency is introduced. It stays within the agreed 43,000-triangle / six-batch / 350 KB budget.

After decoding, 481 samples per gait place the lowest shoe surface at **1.03–1.71 mm** while walking and **0.43–19.52 mm** while running. The small run flight phase is intentional. The shortened legs clear the bench front by **15.83 mm**, and pelvis-to-seat clearance is **0.94 mm**. The 121-sample helm loop has zero position/orientation drift; independent runtime tests retain the original boat-space grips within 0.1 mm. These checks do not establish intersection-free geometry in every conceivable blended pose.

Production Vite build passed. The built character matches the validated source byte for byte: SHA-256 `3747aac546fecc818efbc48e461247c29ed03860cc0839489e2173cc2393d5ef`. Temporary comparison models, reference bitmap and review page are excluded from deployment and source.

## Visual review and limits

Reviewed the actual GLB against V4.4 and the supplied concept in front, three-quarter and side views. In-scene checks on the existing Apple M3 Max / macOS / Codex in-app browser covered Connect landing, a seven-segment walking/running route, sitting, standing, boarding, left/right steering and four target viewport sizes. Desktop and phone-sized displays keep Jack and the controls visible. Phone views are viewport emulation, not physical-device testing.

WebGPU/high, WebGPU/low with reduced motion, and WebGL2/low with reduced motion rendered the new character. A short status sample reported 144 FPS and no console errors were observed in the final WebGL2 check. This is not a sustained performance, physical-phone or controlled-network certification. Mobile Safari, physical phones and cold-load timing were not remeasured for this cosmetic update. Existing content, résumé, physics dimensions, local-record schema and preview access remain unchanged.

---

# V4.4 — The Concept Comes Aboard validation · 2026-09-19

## Reference-led reconstruction

The supplied concept guides a new layered hairstyle, simpler black oval eyes and a smaller nose/smile, an open cream jacket over a navy tee, trousers and cream sneakers. The character is 1.30 units tall and approximately **2.67 heads tall** (actual crown-to-chin span 0.487). This is an original real-time interpretation of a single concept sheet, not an assertion that all camera angles and lighting are pixel-identical to the illustration. The comparison bitmap and temporary review page are excluded from source and deployment.

Hair consists of a hidden scalp and twelve overlapping sculpted locks. Three broad swept forelocks, a crown curl and longer back locks define the volume; shallow carved grooves and a small locally generated normal field add strand detail. Lock UVs follow their longitudinal flow. The same material detail is available in high/low and WebGPU/WebGL2, without a downloaded texture. The normal field uses one shared 128×256 RGBA texture with mipmaps (about 171 KB GPU memory).

## Asset and automated verification

Final GLB: **277,152 bytes**, **42,680 triangles**, six material primitives, one 22-joint skin and seven animation clips. Meshopt filtering keeps the asset below 350 KB. The triangle ceiling is deliberately raised from V4.3's 20,000 to **43,000** to support the requested layered shapes, finer grooves and rounded clothing; no additional character instances or material batches are introduced.

**169 regression checks pass** on Node 24.19.0. They cover deformed-vertex camera framing at 1440×900, 1920×1080, 390×844 and 844×390; paused/reduced expressions, blink deformation, animation transitions, bench fit, boarding, nine-island routes, fixed-step movement and existing maritime gameplay. Walking desktop distance changes from 12.5 to 12.6 to keep the broader final hair within the existing 16–20% height contract; portrait remains 24.

The rebuild decodes the compressed GLB and samples 481 frames per gait. Lowest shoe surface is **1.03–2.01 mm** above ground while walking and **0.26–19.35 mm** while running (intentional small flight phase). Lower-leg geometry clears the bench front by **14.28 mm**, and pelvis-to-seat clearance is **0.95 mm**. Helm samples retain fixed hands; a new independent check anchors their boat-space positions to the preceding wheel contacts with a 0.1 mm compression tolerance. Topology audits checked closed hair pieces, outward winding, overlap and finite coordinates. These checks do not prove every possible blended pose is intersection-free.

Production Vite build passed. The built `dist/models/jack.glb` matches the validated source byte for byte (SHA-256 `c218167ac2988c8eae87cdcd44fe6ce5564c75f534349cd960c1b40d15c98d32`).

## Browser review and limits

Actual exported model reviewed in front, three-quarter, side and rear compositions, followed by in-scene checks on the existing Apple M3 Max / macOS / Codex in-app browser host. Checked Connect walking/running, bench sitting, standing again, Harbor landing, boarding and alternating steering. WebGPU/high and WebGL2 high/low render the new model and strand material. Reduced motion remains usable. Desktop and phone-sized views were inspected; the phone sizes are viewport emulation, not physical-device tests. No console errors were observed in the final WebGL2 checks.

A short WebGL2/low status sample reported 144 FPS on this host. This is not a sustained mobile-performance, cold-start or thermal certification. Physical phones, mobile Safari and controlled network loading were not measured. Existing portfolio content, résumé, external links and local-record schema are unchanged.

---

# V4.3 — A Softer Look validation · 2026-09-19

## Scope and geometry

Head-only visual refinement: continuous sculpted short hair replaces the cap plus separate raised locks; face details use warmer irises, smaller highlights, tapered brows/smile and eye surfaces aligned to the cheeks. The body, 1.30-unit height, approximately 2.18-head proportion, helm contacts, locomotion clips and gameplay configuration remain unchanged.

Final GLB: **176,868 bytes**, **19,528 triangles**, five deduplicated materials and six primitives, one shared 22-joint skeleton, seven clips, no external textures. The higher hair tessellation removes visible corners in close-up; the explicit full-character budget is now 20,000 triangles, with the existing 350 KB and six-primitive limits retained.

A one-off geometric audit of the exact final hair module reports one closed connected mesh (4,416 triangles), consistent outward winding, no degenerate/non-manifold edges, finite unit normals, and clearance above the analytic face for vertices and sampled triangle interiors. The central fringe stays above the brows (Y 0.07476–0.16819 in Head space). The decoded builder again verifies 481 frames per gait, 121 static helm samples and bench clearance (22.66 mm at the shin).

## Validation

**All 168 regression checks pass** (Node 24.19.0); the production Vite build passes and the built Jack GLB matches the validated source exactly. The checks cover deformed camera framing at all four target sizes, blink deformation, paused/reduced expressions, interrupted animation blends, stable hands, nine-island routes and existing maritime gameplay. A transient eyebrow rounding difference during paused frames was fixed by applying its offset directly as a quaternion; expression state no longer accumulates through Euler conversions.

Visual review used the actual exported GLB in WebGL: front, three-quarter, top, back, neutral and smiling face. In-scene WebGPU/high checks covered Connect arrival, walking and returning to the boat at 1440×900 and 390×844. No console errors were observed. Phone dimensions were emulated on the existing Apple M3 Max / macOS / Codex in-app-browser host; physical-phone performance was not measured. This cosmetic release does not claim a new cold-load or sustained FPS measurement.

---

# V4.2 — A Livelier Jack validation · 2026-09-19

## Automated checks

`node --test tests/*.test.js`: **168 passing checks**, Node 24.19.0 / Three.js 0.183.2 / Rapier 0.17.3. The 157 existing checks remain, plus eleven checks for the rebuilt model and animation behavior:

- Interrupted idle/walk/run/interaction blends keep normalized action weights, including stopped strides; walk/run transfer their stride phase and use speed hysteresis.
- Pausing holds the complete rendered pose, expression clock and bench-exit interpolation. Boarding/reset clears outgoing gestures and transition state.
- Natural blinking scales both eyes and their highlights about their own centers; expressions restore the authored pose before applying offsets, preventing cumulative deformation. Reduced motion keeps the neutral face and head.
- Continuous two-bone skin weights bridge elbows and knees. Actual deformed-vertex projection checks still meet desktop 16–20% / portrait 18–24% character-height targets at 1440×900, 1920×1080, 390×844 and 844×390.
- Existing helm tests confirm fixed hand positions and orientations under steering, boat motion, pauses and 30/60/120 FPS schedules. The original nine-island route, collision, challenge and storage tests remain passing.

## Character asset

The original shared GLB is **155,476 bytes**, **15,564 triangles**, six material primitives, one 22-joint skin and seven clips, with no external textures. Height remains **1.30 units**; the 0.596-unit head gives approximately **2.18 heads tall**, compared with V4.1's 2.7. Rounded cheeks, inset blush, larger highlighted eyes, swept hair, jacket seams/zipper and compact shoes replace the earlier proportions. Continuous cloth around joints replaces separate bead-like segments.

The decoded asset builder samples 481 frames per gait: lowest sole is 1.16–2.15 mm above ground while walking and 1.09–19.48 mm while running. Across 121 helm frames, hands have no angular drift and only floating-point position noise. Dominant-weight lower-leg geometry clears the bench front by 22.6 mm. These numeric checks accompany visual inspection; they do not prove every possible animation blend is free of intersections. The extra geometry raises the previous 12,000-triangle target to a documented 16,000 limit while keeping the six-material and 350 KB limits.

Production Vite build passed; the built Jack GLB matches the checked source asset byte for byte.

## Browser verification

Host remains Apple M3 Max / Mac15,8 / 64 GB, macOS, Codex in-app browser. Phone dimensions are desktop viewport emulation.

- Reviewed the actual exported GLB front, side, three-quarter and seated helm poses. Inspected the final character in the live local scene, including Connect's bench, standing again, walking/running, Harbor landing and returning to the boat.
- Checked 1440×900, 1920×1080, 390×844 and 844×390. The character stays clear of primary touch controls. Paused screenshots were resumed by focusing the canvas before judging an animation transition.
- WebGPU low/high and WebGL2 high render the new character. Reduced motion remains usable. Alternating boosted turns → reading → Travel → close returns a stopped boat in sailing mode without old input.
- No console errors in the final WebGL2 session. A short WebGL2/high desktop observation reported 144 FPS; this is not a sustained performance guarantee.
- Physical phones, mobile Safari, controlled cold-network loading and a long thermal/memory soak were not measured. Existing HTML fallback and résumé/content data are unchanged.

---

# V4.1 — Little Captain Jack validation · 2026-09-19

## Automated checks

`node --test tests/*.test.js`: **157 passing checks**, Node 24.19.0 / Three.js 0.183.2 / Rapier 0.17.3. All 148 V4 checks remain; nine new avatar checks cover:

- Hand positions and orientations stay fixed in boat-local space through alternating steering, moving/rocking boat transforms, frozen frames, reduced motion, and 30/60/120 FPS update schedules. The neutral wheel stays still while the engine and instruments respond.
- Hard boarding resets stop every outgoing animation action, including interrupted walk-to-interact blends. Repeated boarding, canceled seated transitions, and reset from a bench retain one avatar and clear old gestures/standing interpolation.
- The GLB's authored helm anchor, scale, bench height and forward placement are used at runtime. Actual skinned lower-leg vertices clear the front slat for all nine authored bench orientations.
- Reduced motion stops idle/resting head motion while necessary walking animation still runs.

Actual deformed-vertex camera checks continue to pass at 1440×900, 1920×1080, 390×844 and 844×390, across four headings. Standard character framing remains within desktop 16–20% / portrait 18–24% of the short viewport edge. Boat framing, fixed-step movement, collision, island routes, challenge states, storage-denial behavior and history migration retain their existing regression coverage.

## Character asset verification

The original character was rebuilt and compressed locally with `node scripts/build-jack.mjs`, then decoded again for geometry and animation checks:

- **131,676 bytes**, **11,972 triangles**, six material primitives, one skin, 17 bones, seven clips and no external textures.
- Standing height 1.3009 units, width 0.4211; head design 0.48 units, approximately **2.7 heads tall**.
- Walk and run each sampled at **481 points per cycle** after compression. Lowest shoe surface: walk **1.08–2.36 mm** above ground; run **0.33–19.51 mm**, allowing a small flight phase. No sampled sole penetration.
- Seated lower legs clear the bench's front edge by **9.25 mm**; the lowest pelvis surface is **3.98 mm** above the seat. New seat placement includes a 0.22-unit forward offset for the shorter thighs.
- Helm palm samples overlap the neutral wheel rim; seated shoe clearance above the cockpit floor is approximately 5.3 mm. Helm body keys are static.
- The generator checks numeric geometry, budgets, foot contact and bench clearance on every rebuild. These checks do not replace visual inspection of all intermediate animation blends.
- Production build passed using Node 24.19.0. Built HTML/CSS/JS plus boat, Harbor, Connect, Jack and walk configuration total **1,565,914 bytes when gzip-compressed locally**; optional fonts and later scene assets are outside this initial estimate. The built Jack GLB matches the checked source asset exactly.

## Browser verification

Same host as V4: Apple M3 Max / Mac15,8 / 64 GB, macOS, Codex in-app browser. Phone dimensions are desktop viewport emulation.

- Reviewed front, three-quarter, side and helm views of the actual GLB; inspected idle, run and seated poses. Corrected hair face winding and elbow/knee seams before final delivery.
- All nine islands completed map Travel → Go ashore → Board boat. Walked and ran the Connect approach, used its bench, stood up, read content and returned to the boat. Bench placement was moved forward after in-scene inspection exposed the shorter shins behind the front slat.
- Alternating boosted turns, reverse, reading during sailing, Travel and close leave the boat stopped with Jack aboard. Reading preserves walking X/Z; grounding can settle by submillimeter amounts in Y.
- Checked the four specified viewport sizes. Portrait/landscape walking arrival messages were moved above the character to keep the larger head clear. Touch controls and Return to boat remain reachable.
- WebGPU high/low and forced WebGL2 low render the character; the reduced-motion path remains usable. No console errors were observed in the WebGL2 session. The latest desktop sample reported 111 FPS during WebGL2/low walking; this is a short observation, not a sustained guarantee.
- The complete nine-entry ordinary reading mode and résumé link remain available. Existing local visits, sightings, challenge records and 18-stamp totals are preserved.

## Limits

Physical phones, mobile Safari, a controlled cold connection and prolonged performance/thermal testing were not measured in this update. Earlier V4/V3 test notes below describe their own historical builds. No new mobile FPS or cold-start certification is claimed.

---

# V4 — Meet Jack validation · 2026-09-19

## Automated checks

`node --test tests/*.test.js`: **148 passing checks**, Node 24.19.0, Three.js 0.183.2, Rapier 0.17.3. The existing 121 checks remain passing; 27 V4 checks cover real character projections, Rapier movement, all nine routes, boarding state and migration. Production build passes with Node 24.19.0 and Vite 7.3.6.

- Actual compressed, skinned Jack vertices (four headings and three idle phases): height 19.46–19.63% of the short edge at 1440×900,1920×1080 and 844×390; 21.92–22.14% at 390×844. Centre 58.56–59.17% from the top. Walking minimum distance tuned from 12 to 12.5; portrait remains 24.
- All nine authored scenic loops complete with the real Rapier capsule, no recovery teleports, ground error below 0.005 units. Both full-hull berths on each island are free of sea colliders. All 28 station anchors and nine bench approaches are clear. Independent grid/path analysis checks station connectivity; Research’s raised exhibit uses the authored ramp.
- Character floor uses one subdivided trimesh with internal-edge correction; triangles are capped at 8-unit edges to avoid numerical floor-sweep errors. Sea collision groups remain independent. Real wall collision stops the run animation’s driving speed, and the character can move away again.
- 30/60/120 render schedules produce equal fixed-step walking results; diagonal movement is normalized. Camera resize does not modify character coordinates. Walking/boat zoom preferences are independent.
- Repeated E commits once; canceled loading cannot commit later. Interruption before/after the fade midpoint uses the last committed actor. Nested read/background pauses freeze the transition; Travel preserves the background pause. Failed required loading leaves Jack aboard and retryable. A parked boat withstands external force and becomes dynamic again after boarding.
- V3 preferences, livery, sightings and history migrate into V4. Island Walks remains separate from the 18 stamps. Original challenge order, crate settlement, pause accounting, storage-denial handling, fleet safety, marine configuration and boat CCD regression checks remain passing.
- Amtrak’s train progress pauses before its projected path reaches Jack; clearing the path resumes its existing phase.

## Browser verification

Host: Apple M3 Max / Mac15,8 / 64 GB. Codex in-app browser, macOS. Checked 1440×900,1920×1080,390×844 and 844×390; phone dimensions are desktop viewport emulation.

- All nine islands: map Travel → Go ashore → safe landing → island record → Return to boat. All nine records survive reload, with the prior 18-stamp count preserved.
- Walked Harbor and Connect approaches; opened nearby exhibits and confirmed same-position return. Tested mobile full-screen reading, contact/repository links, map opening, Island Walks, and the nine-entry no-3D reading page with résumé access.
- Activated Connect’s signal array, sat on its bench and stood by moving. Bench facing was corrected after visual inspection. Ground caps were separated from the coast ring so grass and clear paths render without coplanar overlap. Plaques, roofs and foliage can fade where they obstruct Jack.
- Opened Boat Studio on land, changed finish and closed back to the same walking position. Starting each of Buoy Run, Cargo Dock and Lighthouse Link from shore returns Jack to sailing and initializes the existing challenge state.
- WebGPU/high and forced WebGL2/low render the character and walking scene. No console errors observed in the WebGL2 session. Reduced-motion camera behavior is checked automatically; physical touch and mobile browser behavior still need device testing.
- After traveling through all nine islands, a 1920×1080 WebGPU/high sample reported 139–144 FPS over the recent 30 one-second samples, 227 draw calls, 158,176 visible triangles, 617 geometries and 17 textures. WebGL2/low reported 144 FPS in a short local sample. These are this desktop’s observations, not mobile or long-duration guarantees.
- Warm localhost ready measurements included 132 ms (WebGL2) and 144 ms (WebGPU). They exclude controlled cold-network conditions.

## Assets and delivery

- Jack: 87,280 bytes, 5,148 triangles, 6 material primitives, one skin/17 bones and seven clips. The seated and standing poses use one shared instance; no external textures.
- Nine V4 high island models: 2,454,068 bytes. Low alternatives: 1,740,172 bytes. Only the selected quality is needed. The shared manifest and walk layout retain maritime coastlines and both land/water semantics.
- Built HTML/CSS/JS plus boat, Harbor, Connect, Jack and walk configuration: approximately **1.54 MB gzip**, below the 6 MB initial-resource budget. Later nearby islands, traffic/fauna and optional fonts are outside this initial estimate. The V4 high island set plus Jack is below 3 MB.
- Résumé and verified career/project facts are preserved; Connect adds the verified public repository URL. The source repository remains public; the hosted preview remains owner-private.

## Remaining measurement limits

Physical iPhone/Android devices, mobile Safari, a controlled 20 Mbps cold start and prolonged thermal/memory soak are not measured. Runtime network failure for an individual model was covered by the boarding failure test, not browser network fault injection. Human 25–40-second routes and visit duration remain playtesting targets; authored lengths are 29.2–38.1 seconds at 2.4 units/sec. No claims of mobile 30 FPS or a certified five-second cold start are made.

---

# V2 delivery validation

## Automated checks

`node --test tests/*.test.js`: 97 passing checks (Node 24; Three.js 0.183.2; Rapier 0.17.3).

- Four real-GLB vertex projections, excluding wake, outline and empty bounding-box corners: 1440×900 and 1920×1080 = 20.91%; 390×844 = 25.70%; 844×390 = 20.91%. Tight boat centre is 61.2–61.7% from the top. The portrait reference distance was tuned from 52 to 53.
- 64 camera checks: four viewports × eight directions × 12/18 units per second, continuously moving through the actual smoothing update. Forward water at speed + 2 units and every boat vertex remain in view after the camera settles. These do not claim instant visibility when velocity changes discontinuously. Resume countdown supplies time for the camera to frame retained momentum.
- Identical fixed-step voyage and heading at simulated 30/60/120 render schedules; planar speed caps, smooth boost release, braking and reverse.
- Safe full-hull spawns, pier/coast/boundary impacts with CCD. Runtime travel validates an enlarged full-boat shape against all enabled colliders.
- All 24 toys have no initial collision overlap. Harbor scenery, the industrial bay entrance, Learning station and Catering channel post were moved away from dock safety margins.
- Real Rapier boat pushes a crate into its matching berth, confirms one second of rest, disables the delivered collider, and reverses clear. Cargo recovery checks all enabled shapes; when no recovery point is free, the round remains paused with Reset cargo available.
- Ordered directed six-gate crossing rejects misses, reverse passage and duplicate gates. Cargo checks full rotated bounds, linear/angular rest, wrong or incomplete placement. Lighthouse retry preserves the clue and replay changes it.
- Boost → read → travel → close invalidates both pending snapshots and old challenge state. Cargo background pause restores boat and prop velocities behind a two-second countdown. Nested pauses and initial countdown pauses exclude paused time.
- Quick reading does not award a visit. Local storage denial retains in-memory operation; old course times are not imported.
- Keyboard repeat after blur, held inputs after menus, touch cancel and camera-relative joystick direction.

A separate Rapier layout audit found connected routes to all nine docks with obstacles expanded by 6 units on a 2-unit sampling grid. This supports the 12-unit main route clearance; it is not a formal certification of every turning radius. The outer loop retains open acceleration water. Harbor was shifted slightly west to frame the pier in the opening close view.

## Browser checks

Host: Apple M3 Max, Mac15,8. Browser: Codex in-app browser. Actual WebGPU/high and forced WebGL2/low paths both rendered without console errors in observed sessions.

Checked desktop 1440×900 and 1920×1080, portrait 390×844 and landscape 844×390. Phone-sized views are desktop viewport emulation, not physical phone measurements. The portrait map and tool buttons were moved clear of the boat. At 390px width the document has no horizontal overflow; Read starts below the hull, the map starts below/right, and the joystick remains reachable.

- All nine destinations: travel, dock/read, close and return to a stationary boat.
- Independent Amtrak and VisionX reading compositions; scrollable HTML content and Escape focus restoration.
- All three challenge start flows; actual boosted first-gate passage at 18 units/second; map freezes elapsed time and position; travel cancels the round.
- Actual cargo pushing; lighthouse clue is visible in landscape with symbol names, progress and a target bearing. Logical completion paths also covered by automated tests.
- Settings low/high model switching, read-without-3D mode and all nine fallback entries. Resume and verified contact links remain accessible.
- WebMCP navigation, status, play and bounded steering use the same visible actions; valid calls and an invalid steering input were exercised.

Short local frame-loop samples reported 119–120 FPS during high-quality WebGPU sailing and 120 FPS with WebGL2/low on this Mac. Warm localhost initialization-ready events ranged about 105–326ms. These are short samples and warm-cache initialization measurements, not sustained mobile FPS or cold-start service guarantees.

## Payload and content

High GLBs: 3,123,188 bytes across the boat and nine islands. Low set including the shared boat: 2,282,900 bytes, 22.8% fewer scene triangles and 26.9% fewer model bytes. Low models keep identical dynamic node names/poses, docks and shore polygons. No texture payload is needed for the flat-color materials.

Initial HTML/CSS/JS plus the boat, Harbor and Connect total approximately 1.50MB when gzip-compressed locally; their GLBs alone are 602,584 bytes before transport gzip. Nearby island requests begin after the ready gate. This fits the 6MB primary resource budget. Google Font requests use display=swap with system fallback.

The resume PDF and shared content.json are unchanged from the verified V1. Package manifest/lockfile and existing owner-private hosting ID are preserved. No guessed GitHub/demo URLs, backend, account system or external leaderboard were added. Sound remains off by default.

## Explicit limits of validation

- No physical iPhone, Android phone, mobile Safari or long-running thermal test was available. The 30 FPS mobile target remains to be measured on representative hardware.
- No controlled 20Mbps cold-connection run was available; the five-second target is supported by payload size but has not been certified.
- Human first-attempt completion times of 45–60s / 60–120s / 60–90s need playtesting. The tests establish rules and recoverability, not player difficulty calibration.
- Runtime asset-load errors retain the geometric placeholder and working HTML content. The no-3D reading path was exercised; an actual failed network model request was not injected in the browser.

## Premium boat refresh — 2026-09-15

Replaced the shared boat with an original sculpted runabout: open cockpit, teak decking, upholstered seats with geometric stitching and aft grab handles, framed translucent windscreen, dual helm displays, satin deck fittings, swim platforms and compact engine. Final compressed model: 126,648 bytes, 10,433 triangles, 12 material batches. The boat source is `scripts/premium-boat.mjs`; `scripts/rebuild-boat.mjs` exports, compresses, validates numeric geometry and updates both manifests. The nine island GLBs, résumé, content, physics/controller, camera parameters and package lockfile are unchanged.

All 68 existing actual-GLB camera checks pass. Standard stationary tight-mesh projection is 21.04% of the short viewport edge at 1440×900, 1920×1080 and 844×390; portrait 390×844 is 25.80%. Tight boat centre is approximately 61% of viewport height. All eight headings at 12 and 18 units/second remain in frame. A 3% visual scale adjustment preserves the established portrait framing without changing physics or camera behavior.

The boat's transparent material skips depth writes and shadow casting/receiving so glazing does not obscure the instruments. Browser checks on the existing Mac/Codex in-app browser covered WebGPU low/high rendering, WebGL2 high rendering and a short throttle/turn trial, close view and the 390×844 portrait layout. New boat loading produced no renderer/model errors; the existing Rapier initialization deprecation warning remains. Desktop viewport emulation is not physical-phone testing. Production build passed.

Updated high-quality model payload is 3,212,012 bytes; low set with the shared boat is 2,371,724 bytes. Added boat payload is 88,824 bytes. Earlier V2 payload figures above are the pre-refresh baseline. No new network texture dependencies were introduced.

## V3 living bay — 2026-09-15

Implemented five vessel classes / six finite-mass NPC boats, dolphin/shark/turtle habitats, three 12-fish shoals, gulls, three shared-model finishes, Boat Studio, full-pier docking, four independent Sea Life observations, and nine detail overlays. All authored V3 GLBs are original, generated locally without network textures. Existing résumé, content.json, confirmed external links, dependency manifest/lockfile, course keys and private hosting configuration are unchanged.

### Automated and geometric checks

121 tests pass, including existing challenge/input/physics/camera checks and new V3 regressions. New checks cover complete vessel hull clearance, two minutes of actual Rapier traffic, high-speed predictive yielding, displaced vessel recovery, horn cooldown/pending-reply cancellation, all dock sides/tips/diagonals, the concave Connect root, land-blocked detection, entry/exit hysteresis, marine habitat/scatter limits, normalized WebGPU instance geometry, finish reuse and denied storage. Additional independent simulation checked 108 displaced vessel poses without a stuck or worsened route result. The initial cargo route was moved away from the complete Buoy Run corridor. NPC motion under 30/60/120 FPS render schedules agrees within 0.01 units; all physics remains at 60 Hz.

The final boat is 139,100 bytes, 11,129 triangles and 16 material batches (12 static, four animated). Its main controls, gauges and outboard use cached pivots. Named materials and palette-matched vertex colors change together. Tight transformed-mesh stationary projection: 20.97% at 1440×900, 1920×1080 and 844×390; 25.75% at 390×844. All existing moving-view tests remain within their forward-water and on-screen bounds. The waterline and stern wake anchors were lowered to meet the hull rather than float below it.

### Browser validation

Host: Apple M3 Max, Mac15,8, 64 GiB RAM, Codex in-app browser. These are desktop measurements, including viewport emulation; no physical phone was used.

- All nine islands traveled to, docked/read, closed, and returned to an exploring/stationary boat. Amtrak detail overlays and desktop focus composition inspected.
- Boat Studio checked on desktop, 390×844 portrait and 844×390 landscape. All three finishes selected; Graphite survived refresh. Portrait uses a scrollable lower panel that keeps the preview visible. Close remains accessible.
- Actual medium-speed sailing triggered two-dolphin companionship and a Dolphin sighting. Opening Projects froze simulation time, every NPC position and animal state across separate readings. Traveling to Research and then closing left speed zero and companion inactive.
- Actual head-on approach to the ferry caused it to yield at about 0.06 units/second. Horn button cooldown exercised; delayed sound/light reply and cancellation also covered by simulation.
- Sea Life page displayed two observed types independently of the original 18-stamp logbook.
- WebGPU/high and WebGL2/low/reduced rendered all six vessels and seven larger animals. A quantized-buffer stride issue in instanced fish/gulls was fixed by decoding into aligned float accessors. Final render runs did not reproduce it; the existing Rapier initialization deprecation warning remains.
- No-3D mode exposes all nine content cards and the original résumé download link. Storage denial is exercised in tests. Network model failure retains the existing placeholder/HTML handling; an actual failed request was not injected in the browser.

Short sailing/status samples reported 144 FPS on this host. A 30-second sampled window after all nine islands loaded ranged 115–144 FPS (the lower sample includes route changes/loading); another sailing window ranged 132–144 FPS. One complete-tour state reported nine islands, nine detail variants, 529–536 active geometries, 18–19 textures, and 171–236 draw calls depending on view. These are observations of bounded asset loading, not a long-duration thermal or leak certification. Warm localhost initialization was 111–149ms; this does not measure cold network load.

### Payload and limits

38 additional compressed GLBs total **705,992 bytes** (fleet 229,132; fauna 97,024; island details 379,836), below the 1.5 MB new-resource target before transport gzip. The main boat replacement adds 12,452 bytes over the preceding revision. Initial HTML/CSS/JS plus boat, Harbor and Connect total 4,232,970 bytes raw and approximately **1,557,564 bytes gzip**, excluding remotely served fonts. Fleet/fauna requests begin after the initial ready event; detail overlays are loaded by proximity. Asset caches are bounded by the two detail variants per island and fixed fleet/fauna model sets.

Physical mobile Safari/Android, sustained mobile 30 FPS, controlled 20 Mbps cold startup and prolonged memory/thermal behavior remain unmeasured. The 5-second cold-start target is not certified. Existing human challenge-completion-time targets still require playtesting. High/low geometry variants share gameplay boundaries and cues. No access expansion or domain change is part of this delivery.
