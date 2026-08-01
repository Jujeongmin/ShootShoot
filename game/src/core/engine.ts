import * as THREE from 'three';

export function createEngine(container: HTMLElement) {
  const scene = new THREE.Scene();
  // far 는 하늘 장식(skyDecor.ts)의 가장 먼 요소가 잘리지 않을 만큼 잡는다.
  const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 1400);
  camera.position.set(0, 1.6, 0);
  scene.add(camera);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);

  let running = false;
  let lastTime = 0;
  let tickCallback: ((dt: number, elapsed: number) => void) | null = null;

  function resize() {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  }
  window.addEventListener('resize', resize);

  function loop(time: number) {
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
    start(onTick: (dt: number, elapsed: number) => void) {
      tickCallback = onTick;
      running = true;
      lastTime = performance.now();
      requestAnimationFrame(loop);
    },
    stop() {
      running = false;
    },
    setFov(fov: number) {
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
