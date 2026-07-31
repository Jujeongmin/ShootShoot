// 붕괴 조각 하나의 운동만 다룬다. three.js 를 쓰지 않고 { x, y, z } 만 주고받으므로
// 프레임 루프 밖에서 테스트된다.

// 중력가속도. 실측값이 아니라 낙하가 너무 굼뜨지도 빠르지도 않게 눈대중으로 고른 값이다.
const GRAVITY = 26;
// 바닥에 부딪히고 남는 속도 비율. 나무 궤짝이라 잘 안 튄다.
const RESTITUTION = 0.35;
// 바닥에 튈 때 수평 속도 중 남기는 비율. 마찰로 깎이는 정도이며 실측이 아니라
// 눈대중으로 고른 값이다.
const GROUND_FRICTION = 0.5;
// 바닥에 튈 때 회전 속도 중 남기는 비율. 실측이 아니라 눈대중으로 고른 값이다.
const SPIN_DAMPING = 0.5;
// 이보다 느리게 바닥에 닿으면 더 튀지 않고 멈춘다. 없으면 영원히 잘게 떤다.
const REST_SPEED = 1.2;
// 명중점이 조각 중심과 겹칠 때 속력이 발산하지 않도록 거리에 바닥을 깐다.
const MIN_IMPACT_DISTANCE = 0.5;
// 위로 띄우는 비율. 없으면 조각이 전부 바닥을 미끄러지기만 한다.
const IMPACT_LIFT = 0.45;
// 회전 속도를 얼마나 세게 줄지. 실측이 아니라 눈대중으로 고른 값이며, 예를 들어 한 단
// 위에서 맞은 상자(dy ≈ 0.6, speed ≈ 10)는 약 14 rad/s로 돌아 착지 전까지 두 바퀴 넘게
// 구른다 — 착지 순간 자세 보정(obstacles.js의 advanceCollapse)이 얼마나 큰 자세
// 어긋남까지 감당해야 하는지가 이 값에 달려 있다.
const SPIN_GAIN = 2.4;

interface Vector3Like {
  x: number;
  y: number;
  z: number;
}

interface DebrisBodyParams {
  position: Vector3Like;
  rotation: Vector3Like;
  velocity: Vector3Like;
  spin: Vector3Like;
  restY: number;
}

export function createDebrisBody({ position, rotation, velocity, spin, restY }: DebrisBodyParams) {
  const currentPosition = { x: position.x, y: position.y, z: position.z };
  const currentRotation = { x: rotation.x, y: rotation.y, z: rotation.z };
  const currentVelocity = { x: velocity.x, y: velocity.y, z: velocity.z };
  const currentSpin = { x: spin.x, y: spin.y, z: spin.z };
  let resting = false;

  return {
    step(dt: number) {
      if (resting) return;

      currentVelocity.y -= GRAVITY * dt;
      currentPosition.x += currentVelocity.x * dt;
      currentPosition.y += currentVelocity.y * dt;
      currentPosition.z += currentVelocity.z * dt;
      currentRotation.x += currentSpin.x * dt;
      currentRotation.y += currentSpin.y * dt;
      currentRotation.z += currentSpin.z * dt;

      if (currentPosition.y > restY) return;

      // 프레임이 길어 바닥을 지나쳤어도 여기서 끌어올리므로 뚫고 내려가지 않는다.
      currentPosition.y = restY;

      if (Math.abs(currentVelocity.y) < REST_SPEED) {
        resting = true;
        currentVelocity.x = 0;
        currentVelocity.y = 0;
        currentVelocity.z = 0;
        currentSpin.x = 0;
        currentSpin.y = 0;
        currentSpin.z = 0;
        return;
      }

      currentVelocity.y = -currentVelocity.y * RESTITUTION;
      currentVelocity.x *= GROUND_FRICTION;
      currentVelocity.z *= GROUND_FRICTION;
      currentSpin.x *= SPIN_DAMPING;
      currentSpin.y *= SPIN_DAMPING;
      currentSpin.z *= SPIN_DAMPING;
    },
    getPosition() {
      return { x: currentPosition.x, y: currentPosition.y, z: currentPosition.z };
    },
    getRotation() {
      return { x: currentRotation.x, y: currentRotation.y, z: currentRotation.z };
    },
    isResting() {
      return resting;
    },
  };
}

// 조각은 맞은 곳의 반대편으로 밀린다. 가까울수록 세게 난다.
export function impactImpulse(pieceCenter: Vector3Like, impactPoint: Vector3Like, strength: number) {
  const dx = pieceCenter.x - impactPoint.x;
  const dy = pieceCenter.y - impactPoint.y;
  const dz = pieceCenter.z - impactPoint.z;
  const distance = Math.max(Math.hypot(dx, dy, dz), MIN_IMPACT_DISTANCE);
  const speed = strength / (1 + distance);

  const velocity = {
    x: (dx / distance) * speed,
    y: (dy / distance) * speed + speed * IMPACT_LIFT,
    z: (dz / distance) * speed,
  };

  // 조각 중심보다 아래를 맞히면 밀리는 방향으로 앞구른다. 회전축은 미는 방향과
  // 수직인 수평축이고, 크기는 지렛대 길이(조각 중심 y - 명중점 y)에 비례한다.
  // 난수를 안 쓰므로 같은 사격은 항상 같은 붕괴를 낸다.
  const horizontal = Math.hypot(velocity.x, velocity.z);
  if (horizontal === 0) {
    return { velocity, spin: { x: 0, y: 0, z: 0 } };
  }
  const magnitude = speed * dy * SPIN_GAIN;
  const spin = {
    x: (velocity.z / horizontal) * magnitude,
    y: 0,
    z: (-velocity.x / horizontal) * magnitude,
  };

  return { velocity, spin };
}
