// Audio is optional: a device/context error must never stop the game loop.
export function updateEngineSound(engine, audio, {enabled, speed, frozen, onLand}) {
  try {
    if (enabled && audio) {
      if (!engine) {
        const osc = audio.createOscillator(), gain = audio.createGain();
        osc.type = 'sine';
        osc.connect(gain).connect(audio.destination);
        gain.gain.value = 0;
        osc.start();
        engine = {osc, gain};
      }
      engine.osc.frequency.setTargetAtTime(48 + speed * 4, audio.currentTime, .15);
      engine.gain.gain.setTargetAtTime(frozen || onLand ? 0 : Math.min(speed * .0014, .022), audio.currentTime, .2);
    } else if (engine && audio) {
      engine.gain.gain.setTargetAtTime(0, audio.currentTime, .1);
    }
  } catch {
    // Keep the current engine so later frames can recover if audio resumes.
  }
  return engine;
}
