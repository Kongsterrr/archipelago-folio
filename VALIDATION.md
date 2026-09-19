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
