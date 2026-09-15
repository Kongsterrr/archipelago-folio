# Validation record

## Automated checks

`npm test`: 19 passing checks using the actual production boat controller, island/boundary collider builders, race state machine, input manager and game pause/teleport methods.

- Identical fixed-step voyages across simulated 30, 60 and 120 FPS schedules (720 physics ticks each; position/yaw differences below numerical tolerance).
- Normal/boost/reverse speed limits and braking.
- All nine spawn points and complete boat hulls clear of shores and docks.
- Top-speed head-on/oblique shore impacts, pier impacts and boundary seams do not tunnel in the tested cases.
- Teleport resets position, yaw and velocity.
- Forward gate-plane crossings count, including a whole gate crossed in one update; backward/sideways/wide misses do not.
- Gate order, complete-run scoring, pause duration, interrupted resume countdown and initial-countdown pause.
- Keyboard focus restoration, lost keyup, paused repeats, canceled/held touch and camera-relative mobile steering.
- Boost → panel → travel → close leaves no old race, velocity, wake or camera interpolation.
- Docking anchors the current position; closing leaves the boat stationary.

## Browser checks

Codex in-app browser on the supplied Mac, with WebGPU enabled and forced WebGL2 verified. Desktop viewport and responsive 390×844 and 844×390 sizes checked. These are viewport checks, not a claim of testing on physical iOS/Android hardware.

- All nine destinations were traveled to, opened and closed in the running browser. E docking and a real joystick drag were also exercised.
- Original compressed models render; the browser console reports no application errors.
- Desktop project directory and project details, mobile full-height scrolling content and visible close/focus controls.
- Map/portfolio navigation tools exercise real read/travel actions; valid inputs update the same UI and invalid island IDs reject without navigation.
- User-selected 2D mode retains all nine entries; work details remain readable and 3D-only travel is hidden.
- Race Start run displays its countdown, ordered course information and direction indicator.
- Navigation/reset/race controls remain available in phone portrait and landscape layouts.

## Performance budgets and limits

Ten compressed GLBs total 707,740 bytes; no image textures are required. The production game bundle is approximately 1.2 MB gzipped and is loaded after the initial HTML/portfolio UI. The complete initial code plus even all ten models is below the 6 MB transfer budget; distant islands are requested progressively.

A throttled 20 Mbps cold-start measurement, physical-phone sustained 30 FPS, full browser/OS matrix, screen-reader testing, and manual completion of the full course on physical touch devices remain release checks. No unmeasured sustained frame-rate or 5-second cold-start guarantee is claimed.

The fixed-step tests validate simulation consistency, not actual rendering speed. The remaining Rapier initialization deprecation warning originates in its pinned compatibility build and does not prevent simulation.
