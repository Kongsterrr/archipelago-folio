const TAU = Math.PI * 2;
const wrap = (distance, length) => ((distance % length) + length) % length;
const preparedPaths = new WeakMap();

function heightAt(path, distance) {
  const span = path.elevation.find(item => distance >= item.start - 1e-8 && distance <= item.end + 1e-8) || path.elevation.at(-1);
  const length = span.end - span.start, t = Math.max(0, Math.min(length, distance - span.start));
  if (span.y0 === span.y1) return {height:span.y0, grade:0};
  const ease = Math.min(span.ease ?? 3, length / 2), grade = (span.y1 - span.y0) / (length - ease);
  let rise, factor;
  if (t < ease) {factor = .5 - .5 * Math.cos(Math.PI * t / ease);rise = t / 2 - ease * Math.sin(Math.PI * t / ease) / (2 * Math.PI);}
  else if (t > length - ease) {const q = length - t;factor = .5 - .5 * Math.cos(Math.PI * q / ease);rise = length - ease - q / 2 + ease * Math.sin(Math.PI * q / ease) / (2 * Math.PI);}
  else {factor = 1;rise = t - ease / 2;}
  return {height:span.y0 + grade * rise, grade:grade * factor};
}

function preparePath(path) {
  let prepared = preparedPaths.get(path);if (prepared) return prepared;
  const total = path.planSegments.at(-1).end, count = Math.ceil(total / .1), table = [[0,0]];
  let distance = 0;
  for (let i = 1; i <= count; i++) {const a = total * (i - 1) / count,b = total * i / count,grade = heightAt(path,(a+b)/2).grade;distance += (b-a)*Math.hypot(1,grade);table.push([distance,b]);}
  prepared = {length:distance,planLength:total,table};preparedPaths.set(path,prepared);return prepared;
}

function interpolateTable(table, value, key) {
  let lo = 0,hi = table.length - 1;
  while (hi - lo > 1) {const mid = (lo + hi) >> 1;if (table[mid][key] <= value) lo = mid;else hi = mid;}
  const a = table[lo],b = table[hi],t = (value - a[key]) / Math.max(1e-9,b[key]-a[key]);return a[1-key] + (b[1-key]-a[1-key])*t;
}

/** Convert an authored plan distance to the physical distance used by all cars. */
export function trainDistanceAtPlan(path, distance) {
  if (!path.planSegments) return distance;
  const p = preparePath(path);return interpolateTable(p.table,Math.max(0,Math.min(p.planLength,distance)),1);
}

export function trainPlanLength(path) {return path.planSegments ? preparePath(path).planLength : trainPathLength(path);}

/** A stadium loop starts at the left end of its front straight, travelling +X.
 * Distances are metres, the two end turns are semicircles, and models face -Z.
 * Coordinates belong to the path's parent (island for rails, district for cars).
 */
export function trainPathLength(path) {
  if (path.planSegments) return preparePath(path).length;
  return 4 * path.halfStraight + TAU * path.radius;
}

export function sampleTrainPath(path, distance, target = {}) {
  if (path.planSegments) {
    const prepared = preparePath(path),d = interpolateTable(prepared.table,wrap(distance,prepared.length),0);
    const s = path.planSegments.find(item=>d <= item.end + 1e-8) || path.planSegments.at(-1),along = Math.max(0,d-s.start);
    let x,z,tx,tz;
    if (s.type === 'arc') {const sign = Math.sign(s.sweep),a = s.angle + sign*along/s.radius;x = s.center[0]+s.radius*Math.cos(a);z = s.center[1]+s.radius*Math.sin(a);tx = -Math.sin(a)*sign;tz = Math.cos(a)*sign;}
    else {const t = along/(s.end-s.start);x = s.from[0]+(s.to[0]-s.from[0])*t;z = s.from[1]+(s.to[1]-s.from[1])*t;tx = (s.to[0]-s.from[0])/(s.end-s.start);tz = (s.to[1]-s.from[1])/(s.end-s.start);}
    const h = heightAt(path,d),norm = Math.hypot(1,h.grade);
    Object.assign(target,{x,y:h.height,z,tangentX:tx/norm,tangentY:h.grade/norm,tangentZ:tz/norm,yaw:Math.atan2(-tx,-tz),pitch:Math.atan(h.grade),grade:h.grade,planDistance:d});return target;
  }
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
  target.tangentY = 0;target.pitch = 0;target.grade = 0;
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
