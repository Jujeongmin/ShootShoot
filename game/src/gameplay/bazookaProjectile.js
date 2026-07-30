import * as THREE from 'three';

const PROJECTILE_RADIUS = 0.3;
const PROJECTILE_COLOR = 0xff6600;

export function createBazookaProjectiles(scene) {
  const active = [];

  function disposeProjectile(projectile) {
    scene.remove(projectile.mesh);
    projectile.mesh.geometry.dispose();
    projectile.mesh.material.dispose();
  }

  function spawn(fromWorld, toWorld, flightSeconds, onImpact) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(PROJECTILE_RADIUS, 8, 8),
      new THREE.MeshBasicMaterial({ color: PROJECTILE_COLOR })
    );
    mesh.position.copy(fromWorld);
    scene.add(mesh);

    active.push({
      mesh,
      from: fromWorld.clone(),
      to: toWorld.clone(),
      elapsed: 0,
      duration: Math.max(flightSeconds, 0.0001),
      onImpact,
    });
  }

  function update(dt) {
    // 뒤에서부터 훑는다. 착탄 콜백이 새 포탄을 spawn해도 배열 끝에 붙으므로
    // 이번 패스에서는 건드리지 않는다.
    for (let i = active.length - 1; i >= 0; i--) {
      const projectile = active[i];
      // 착탄 콜백이 exitRun() 등을 거쳐 clear()를 호출하면 이 패스 도중 배열이
      // 비워질 수 있다. 그러면 이후 인덱스는 더 이상 유효하지 않으니 중단한다.
      if (!projectile) break;
      projectile.elapsed += dt;
      const t = Math.min(projectile.elapsed / projectile.duration, 1);
      projectile.mesh.position.lerpVectors(projectile.from, projectile.to, t);

      if (t < 1) continue;

      disposeProjectile(projectile);
      active.splice(i, 1);
      projectile.onImpact(projectile.to);
    }
  }

  function hasPending() {
    return active.length > 0;
  }

  function clear() {
    for (const projectile of active) {
      disposeProjectile(projectile);
    }
    active.length = 0;
  }

  return { spawn, update, hasPending, clear };
}
