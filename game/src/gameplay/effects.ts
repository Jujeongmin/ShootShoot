import * as THREE from 'three';

const PARTICLE_COUNT = 10;
const PARTICLE_LIFETIME = 0.5;
const EXPLOSION_PARTICLE_COUNT = 30;
const EXPLOSION_LIFETIME = 0.9;

interface Particle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
}

interface Burst {
  group: THREE.Group;
  particles: Particle[];
  elapsed: number;
  lifetime: number;
}

interface BurstParams {
  position: THREE.Vector3;
  color: number;
  count: number;
  radius: number;
  minSpeed: number;
  speedRange: number;
  lifetime: number;
}

export function createEffects(scene: THREE.Scene) {
  const bursts: Burst[] = [];

  function spawnBurst({ position, color, count, radius, minSpeed, speedRange, lifetime }: BurstParams) {
    const group = new THREE.Group();
    const material = new THREE.MeshBasicMaterial({ color });
    const particles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 4, 4), material);
      mesh.position.copy(position);
      const direction = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        Math.random() * 1.5,
        (Math.random() - 0.5) * 2
      ).normalize();
      const speed = minSpeed + Math.random() * speedRange;
      particles.push({ mesh, velocity: direction.multiplyScalar(speed) });
      group.add(mesh);
    }
    scene.add(group);
    bursts.push({ group, particles, elapsed: 0, lifetime });
  }

  function spawnHitBurst(position: THREE.Vector3, color = 0xffdd55) {
    spawnBurst({
      position,
      color,
      count: PARTICLE_COUNT,
      radius: 0.04,
      minSpeed: 1.5,
      speedRange: 1.5,
      lifetime: PARTICLE_LIFETIME,
    });
  }

  function spawnExplosion(position: THREE.Vector3, color = 0xff8800) {
    spawnBurst({
      position,
      color,
      count: EXPLOSION_PARTICLE_COUNT,
      radius: 0.35,
      minSpeed: 6,
      speedRange: 8,
      lifetime: EXPLOSION_LIFETIME,
    });
  }

  function update(dt: number) {
    for (let i = bursts.length - 1; i >= 0; i--) {
      const burst = bursts[i];
      burst.elapsed += dt;
      const t = burst.elapsed / burst.lifetime;
      for (const particle of burst.particles) {
        particle.mesh.position.addScaledVector(particle.velocity, dt);
        particle.velocity.y -= 4 * dt;
        particle.mesh.scale.setScalar(Math.max(1 - t, 0));
      }
      if (t >= 1) {
        scene.remove(burst.group);
        bursts.splice(i, 1);
      }
    }
  }

  return { spawnHitBurst, spawnExplosion, update };
}
