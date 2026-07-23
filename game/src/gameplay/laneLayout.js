const FRONT_Z = -78;
const BASE_DEPTH_GAP = 6;
const MAX_LANE_ANGLE = 0.09;
const ANGULAR_SWAY_AMPLITUDE = 0.038;
const SWAY_FREQUENCY_PER_SPEED = 1.8;
const GROUND_Y = -1.0;

function partitionIntoLanes(count) {
  if (count === 1) return [1];
  const remainder = count % 3;
  let threes = Math.floor(count / 3);
  let twos = 0;
  if (remainder === 1) {
    threes -= 1;
    twos = 2;
  } else if (remainder === 2) {
    twos = 1;
  }
  const sizes = [];
  for (let i = 0; i < threes; i++) sizes.push(3);
  for (let i = 0; i < twos; i++) sizes.push(2);
  return sizes;
}

export function computeLaneLayout(monkeyCount, monkeySpeed, monkeyScale) {
  const laneSizes = partitionIntoLanes(monkeyCount);
  const laneCount = laneSizes.length;
  const frequency = SWAY_FREQUENCY_PER_SPEED * monkeySpeed;
  const depthGap = BASE_DEPTH_GAP * monkeyScale;
  const slots = [];

  for (let laneIndex = 0; laneIndex < laneCount; laneIndex++) {
    const laneAngle =
      laneCount === 1 ? 0 : -MAX_LANE_ANGLE + (2 * MAX_LANE_ANGLE * laneIndex) / (laneCount - 1);
    const size = laneSizes[laneIndex];
    for (let j = 0; j < size; j++) {
      const z = FRONT_Z - j * depthGap;
      slots.push({
        x: laneAngle * Math.abs(z),
        y: GROUND_Y,
        z,
        swayAmplitude: ANGULAR_SWAY_AMPLITUDE * Math.abs(z),
        swayFrequency: frequency,
        swayPhase: (j * 2 * Math.PI) / size,
      });
    }
  }

  return slots;
}
