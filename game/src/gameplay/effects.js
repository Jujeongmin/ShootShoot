import * as THREE from 'three';

const PARTICLE_COUNT = 10;
const PARTICLE_LIFETIME = 0.5;

export function createEffects(scene) {
  const bursts = [];

  function spawnHitBurst(position, color = 0xffdd55) {
    const group = new THREE.Group();
    const material = new THREE.MeshBasicMaterial({ color });
    const particles = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.04, 4, 4), material);
      mesh.position.copy(position);
      const direction = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        Math.random() * 1.5,
        (Math.random() - 0.5) * 2
      ).normalize();
      const speed = 1.5 + Math.random() * 1.5;
      particles.push({ mesh, velocity: direction.multiplyScalar(speed) });
      group.add(mesh);
    }
    scene.add(group);
    bursts.push({ group, particles, elapsed: 0 });
  }

  function update(dt) {
    for (let i = bursts.length - 1; i >= 0; i--) {
      const burst = bursts[i];
      burst.elapsed += dt;
      const t = burst.elapsed / PARTICLE_LIFETIME;
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

  return { spawnHitBurst, update };
}
