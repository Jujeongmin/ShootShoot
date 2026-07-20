import * as THREE from 'three';

export function createEngine(container) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 100);
  camera.position.set(0, 1.6, 0);
  scene.add(camera);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);

  let running = false;
  let lastTime = 0;
  let tickCallback = null;

  function resize() {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  }
  window.addEventListener('resize', resize);

  function loop(time) {
    if (!running) return;
    const dt = Math.min((time - lastTime) / 1000, 0.1);
    lastTime = time;
    if (tickCallback) tickCallback(dt, time / 1000);
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }

  return {
    scene,
    camera,
    renderer,
    domElement: renderer.domElement,
    start(onTick) {
      tickCallback = onTick;
      running = true;
      lastTime = performance.now();
      requestAnimationFrame(loop);
    },
    stop() {
      running = false;
    },
    setFov(fov) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    },
    dispose() {
      running = false;
      window.removeEventListener('resize', resize);
      renderer.dispose();
    },
  };
}
