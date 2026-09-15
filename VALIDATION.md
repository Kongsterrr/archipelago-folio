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
