const TAU = Math.PI * 2;
const wrap = (distance, length) => ((distance % length) + length) % length;

/** A stadium loop starts at the left end of its front straight, travelling +X.
 * Distances are metres, the two end turns are semicircles, and models face -Z.
 * Coordinates belong to the path's parent (island for rails, district for cars).
 */
export function trainPathLength(path) {
  return 4 * path.halfStraight + TAU * path.radius;
}

export function sampleTrainPath(path, distance, target = {}) {
  const {center, halfStraight: h, radius: r} = path;
  const straight = 2 * h, arc = Math.PI * r;
  let d = wrap(distance, trainPathLength(path)), x, z, tx, tz;
  if (d < straight) {
    x = -h + d; z = r; tx = 1; tz = 0;
  } else if ((d -= straight) < arc) {
    const a = d / r;
    x = h + r * Math.sin(a); z = r * Math.cos(a);
    tx = Math.cos(a); tz = -Math.sin(a);
  } else if ((d -= arc) < straight) {
    x = h - d; z = -r; tx = -1; tz = 0;
  } else {
    const a = (d - straight) / r;
    x = -h - r * Math.sin(a); z = -r * Math.cos(a);
    tx = -Math.cos(a); tz = Math.sin(a);
  }
  target.x = center[0] + x;
  target.y = center[1];
  target.z = center[2] + z;
  target.tangentX = tx;
  target.tangentZ = tz;
  target.yaw = Math.atan2(-tx, -tz);
  return target;
}

export function trainDuration(train = {}) {
  return train.path ? trainPathLength(train.path) / (train.speed || 2) : train.duration || 10;
}

/** Keeps legacy ellipse timing while new car offsets use physical arc length. */
export function sampleTrainMotion(train, elapsed, duration, offset = 0, target = {}) {
  if (train.path) return sampleTrainPath(train.path, (train.startDistance || 0) + elapsed * (train.speed || 2) - offset, target);
  const c = train.trackCentre || [0,0,-1.4], r = train.trackRadii || [8.8,5.8];
  const a = (train.initialAngle || 0) + elapsed / Math.max(1,duration) * TAU;
  const tx = -Math.sin(a) * r[0], tz = Math.cos(a) * r[1], length = Math.hypot(tx,tz);
  target.x = c[0] + Math.cos(a) * r[0];
  target.y = train.rootY ?? c[1];
  target.z = c[2] + Math.sin(a) * r[1];
  target.tangentX = tx / length;
  target.tangentZ = tz / length;
  target.yaw = Math.atan2(-tx,-tz);
  return target;
}

export function trainTrackPoints(train, segments = train.path ? 128 : 64) {
  const duration = trainDuration(train);
  // A legacy map describes the whole ellipse from its rightmost point.
  const track = train.path ? train : {...train,initialAngle:0};
  return Array.from({length:segments+1}, (_,index) => sampleTrainMotion(track,index/segments*duration,duration));
}
