import * as THREE from 'three';

// M1 placeholder: a spinning cube proving the render pipeline works.
const container = document.getElementById('app');
if (!container) throw new Error('Missing #app container');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1b1410);
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 1.5, 4);
camera.lookAt(0, 0, 0);

const cube = new THREE.Mesh(
  new THREE.BoxGeometry(1.4, 1.4, 1.4),
  new THREE.MeshLambertMaterial({ color: 0xc9a14a, flatShading: true }),
);
scene.add(cube);
scene.add(new THREE.HemisphereLight(0x9ec9ff, 0x4a3020, 1.2));
const sun = new THREE.DirectionalLight(0xffd29a, 2);
sun.position.set(3, 5, 2);
scene.add(sun);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

renderer.setAnimationLoop((time: number) => {
  cube.rotation.x = time * 0.0007;
  cube.rotation.y = time * 0.001;
  renderer.render(scene, camera);
});
