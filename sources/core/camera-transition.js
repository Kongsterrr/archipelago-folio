const FADE_SECONDS = .1;
const ANGLE_EPSILON = 1e-5;
const TIME_EPSILON = 1e-12;

const sameAngle = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b))) <= ANGLE_EPSILON;

// The caller keeps the old camera while hold is true, then applies the latest
// pose immediately when snap is true. No camera orientation is interpolated.
export class CameraTransition {
  constructor() {
    this.reset();
  }

  get active() { return this.phase !== 'idle'; }

  reset(azimuth) {
    this.committedAzimuth = Number.isFinite(azimuth) ? azimuth : undefined;
    this.targetAzimuth = this.committedAzimuth;
    this.phase = 'idle';
    this.opacity = 0;
  }

  request(azimuth) {
    if (!Number.isFinite(azimuth)) return this.active;
    if (this.committedAzimuth === undefined) {
      this.reset(azimuth);
      return false;
    }
    if (sameAngle(azimuth, this.committedAzimuth)) {
      // Returning before the snap makes the pending camera change obsolete.
      if (this.phase === 'out') this.reset(this.committedAzimuth);
      return this.active;
    }
    this.targetAzimuth = azimuth;
    // Retargeting keeps the current opacity, including when reversing a fade in.
    this.phase = 'out';
    return true;
  }

  step(dt, {paused = false} = {}) {
    let snap = false;
    let finished = false;
    if (!paused && this.active) {
      const elapsed = Number.isFinite(dt) ? Math.max(0, dt) : 0;
      if (this.phase === 'out') {
        this.opacity = Math.min(1, this.opacity + elapsed / FADE_SECONDS);
        if (this.opacity >= 1 - TIME_EPSILON) {
          this.opacity = 1;
          this.committedAzimuth = this.targetAzimuth;
          this.phase = 'in';
          snap = true;
          // Do not consume leftover dt: the snapped view must render behind a
          // completely opaque frame before any fade in can begin.
        }
      } else {
        this.opacity = Math.max(0, this.opacity - elapsed / FADE_SECONDS);
        if (this.opacity <= TIME_EPSILON) {
          this.opacity = 0;
          this.phase = 'idle';
          finished = true;
        }
      }
    }
    return {snap, hold: this.phase === 'out', opacity: this.opacity, finished};
  }
}
