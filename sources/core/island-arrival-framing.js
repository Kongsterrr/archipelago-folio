import {Box3, Vector3, MathUtils} from 'three';
import {fitBoundsPose} from './focus-framing.js';

const ELEVATION = MathUtils.degToRad(38);

// During arrival the caller hides the walking/map/action HUD. Only the header
// and a bottom summary / Skip strip remain. Values are CSS pixels, not DPR.
export function arrivalFrameRect(width, height) {
  const compact = width <= 700 || height <= 560;
  const side = compact ? 18 : 36;
  return {
    left: Math.min(side, width * .1),
    right: width - Math.min(side, width * .1),
    top: Math.min(compact ? 84 : 100, height * .22),
    bottom: height - Math.min(width <= 700 ? 188 : compact ? 100 : 112, height * .28),
  };
}

// worldBounds is a fresh Box3 of the loaded island group/model. This keeps
// runtime structures and the true roof/peak heights; the shoreline's visible
// 1.17x halo belongs to the island too. Returned data is a plain world AABB.
export function arrivalBounds(island, worldBounds) {
  const asVector = p => p?.isVector3 ? p : new Vector3(...p);
  const box = new Box3(asVector(worldBounds.min).clone(), asVector(worldBounds.max).clone());
  if (box.isEmpty() || [...box.min.toArray(), ...box.max.toArray()].some(v => !Number.isFinite(v))) {
    throw new Error('Arrival framing requires finite, non-empty loaded island bounds.');
  }
  const c = Math.cos(island.rotation), s = Math.sin(island.rotation);
  for (const [x,z] of island.shore || []) {
    box.expandByPoint(new Vector3(island.x + (x*c + z*s)*1.17, -.055, island.z + (-x*s + z*c)*1.17));
  }
  // Millimetres of meshopt quantization and tiny animated details should not
  // perturb the fit across LOD switches. The fitter adds its own 4% margin.
  box.expandByScalar(.02);
  return {min:box.min.toArray(), max:box.max.toArray()};
}

export function arrivalOverviewPose(bounds, {width,height,azimuth=0,fov=28,near=.2,rect=arrivalFrameRect(width,height)}) {
  return fitBoundsPose(bounds, {width,height,azimuth,fov,near,elevation:ELEVATION,rect});
}

// progress is the approach-only normalized time: hold => 0, completion => 1.
// The same affine blend for eye AND target preserves the ordinary walking
// azimuth, including a terrain-raised endpoint, and keeps Jack between his
// initial/final screen positions. The exact endpoint avoids a handoff pop.
// The caller supplies the current ordinary walking pose, applies this pose
// directly (no second camera damping), and owns lifecycle/pause/reduced motion.
export function arrivalApproachPose(overview, walking, progress) {
  const t = MathUtils.clamp(Number.isFinite(progress) ? progress : 0, 0, 1);
  const blend = t*t*t*(t*(t*6-15)+10);
  const target = overview.target.clone().lerp(walking.target, blend);
  const position = overview.position.clone().lerp(walking.position, blend);
  return {target, position, distance:position.distanceTo(target)};
}
