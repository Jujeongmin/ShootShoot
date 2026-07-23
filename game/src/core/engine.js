import * as THREE from 'three';

export function createEngine(container) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 800);
  // 높은 사대에서 섬을 내려다본다. 눈높이가 섬 표면과 비슷하면 80유닛 밖의
  // 섬이 거의 옆면으로만 보여서, 표적 뒤로 지면이 안 깔리고 하늘을 배경으로
  // 떠 있는 것처럼 보인다.
  camera.position.set(0, 22, 0);
  scene.add(camera);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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
