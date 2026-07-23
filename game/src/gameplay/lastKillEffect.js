const EFFECT_DURATION = 0.6;
const TIME_SCALE = 0.3;
// 화각에서 덜어낼 비율. 절대 각도로 빼면 조준 화각(한 자릿수)에서 0 이하로
// 내려가므로 비율로 둔다. 1/6은 예전에 60도에서 10도를 당기던 것과 같은 세기다.
const MAX_ZOOM_RATIO = 1 / 6;

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

  function getZoomRatio() {
    if (!isActive()) return 0;
    const t = elapsed / EFFECT_DURATION;
    return MAX_ZOOM_RATIO * (1 - t);
  }

  return { trigger, update, getTimeScale, getZoomRatio };
}
