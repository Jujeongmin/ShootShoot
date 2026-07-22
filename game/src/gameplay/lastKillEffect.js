const EFFECT_DURATION = 0.6;
const TIME_SCALE = 0.3;
const MAX_FOV_DELTA = 10;

export function createLastKillEffect() {
  let elapsed = EFFECT_DURATION;

  function isActive() {
    return elapsed < EFFECT_DURATION;
  }

  function trigger() {
    elapsed = 0;
  }

  function update(realDt) {
    if (elapsed < EFFECT_DURATION) {
      elapsed += realDt;
    }
  }

  function getTimeScale() {
    return isActive() ? TIME_SCALE : 1;
  }

  function getFovDelta() {
    if (!isActive()) return 0;
    const t = elapsed / EFFECT_DURATION;
    return MAX_FOV_DELTA * (1 - t);
  }

  return { trigger, update, getTimeScale, getFovDelta };
}
