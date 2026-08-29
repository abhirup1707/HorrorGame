import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

const app = document.getElementById('game');
const clockEl = document.getElementById('clock');
const objectiveEl = document.getElementById('objective');
const hintEl = document.getElementById('hint');
const interactionEl = document.getElementById('interaction');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0c1220);
scene.fog = new THREE.Fog(0x0c1220, 35, 180);

const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.1, 250);
camera.position.set(0, 1.7, 6);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
app.appendChild(renderer.domElement);

const controls = new PointerLockControls(camera, renderer.domElement);
scene.add(controls.object);

const player = {
  height: 1.7,
  speed: 4.1,
  sprint: 7,
  radius: 0.35,
  minX: -15,
  maxX: 15,
  minZ: -30,
  maxZ: 15,
};

const keys = new Set();
let elapsed = 0;
let gameMinutes = 19 * 60;
let lastTrainMinute = 19 * 60 + 30;
let nextTrainId = 1;
let trainState = null;
let cooking = { done: false, step: 0, target: 1 };

const interactables = [];

function mat(color, roughness = 0.8, metalness = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

const mats = {
  wall: mat(0x6a5447),
  wallDark: mat(0x493b35),
  wood: mat(0x4d2f20),
  wood2: mat(0x75513a),
  floor: mat(0x2a2420),
  roof: mat(0x242321),
  metal: mat(0x45484c, 0.45, 0.65),
  rail: mat(0x47494d, 0.28, 0.85),
  gravel: mat(0x444039),
  glass: new THREE.MeshStandardMaterial({ color: 0x6d8492, roughness: 0.15, transparent: true, opacity: 0.35 }),
  signalRed: mat(0x9e2b27, 0.5),
  signalGreen: mat(0x386d43, 0.5),
};

function box(name, size, position, material, parent = scene) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function cylinder(name, radius, height, position, material, parent = scene, segments = 12) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, segments), material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addInteractable(mesh, label, callback, range = 2.5) {
  mesh.userData.interact = { label, callback, range };
  interactables.push(mesh);
  return mesh;
}

// Moonlight and ambient fill.
const hemi = new THREE.HemisphereLight(0x8ca5cf, 0x17130f, 0.66);
scene.add(hemi);
const moon = new THREE.DirectionalLight(0xb9cbff, 1.65);
moon.position.set(-35, 45, 20);
moon.castShadow = true;
moon.shadow.mapSize.set(2048, 2048);
moon.shadow.camera.left = -80;
moon.shadow.camera.right = 80;
moon.shadow.camera.top = 80;
moon.shadow.camera.bottom = -80;
scene.add(moon);

// Ground.
box('ground', [90, 0.25, 150], [0, -0.15, -35], mats.gravel);

// Cabin shell.
const cabin = new THREE.Group();
cabin.position.set(0, 0, 5);
scene.add(cabin);
box('cabin floor', [11, 0.4, 8], [0, 0, 0], mats.floor, cabin);
box('back wall', [11, 4.5, 0.35], [0, 2.25, 4], mats.wall, cabin);
box('left wall', [0.35, 4.5, 8], [-5.5, 2.25, 0], mats.wall, cabin);
box('right wall', [0.35, 4.5, 8], [5.5, 2.25, 0], mats.wall, cabin);
box('front wall left', [3.6, 4.5, 0.35], [-3.7, 2.25, -4], mats.wall, cabin);
box('front wall right', [3.6, 4.5, 0.35], [3.7, 2.25, -4], mats.wall, cabin);
box('front wall top', [4, 1.15, 0.35], [0, 3.9, -4], mats.wall, cabin);
box('roof', [12, 0.35, 9], [0, 4.7, 0], mats.roof, cabin);

// Front door: pivoted mesh.
const doorPivot = new THREE.Object3D();
doorPivot.position.set(-1.8, 0, -4.08);
cabin.add(doorPivot);
const door = box('door', [2.2, 3.9, 0.18], [1.1, 1.95, 0], mats.wood2, doorPivot);
addInteractable(door, 'Open / close door', () => {
  doorPivot.userData.open = !doorPivot.userData.open;
  doorPivot.userData.target = doorPivot.userData.open ? -Math.PI / 2 : 0;
}, 2.6);
doorPivot.userData.open = false;
doorPivot.userData.target = 0;

// Window on right wall.
box('window frame top', [3, 0.22, 0.22], [0.8, 3.0, 3.78], mats.wood, cabin);
box('window frame bottom', [3, 0.22, 0.22], [0.8, 1.35, 3.78], mats.wood, cabin);
box('window glass', [2.8, 1.45, 0.06], [0.8, 2.2, 3.77], mats.glass, cabin);
box('window mullion', [0.14, 1.45, 0.12], [0.8, 2.2, 3.71], mats.wood, cabin);

// Simple cabin furniture.
box('desk', [3.2, 0.3, 1.0], [-1.2, 1.45, 1.5], mats.wood2, cabin);
box('desk leg 1', [0.25, 1.45, 0.25], [-2.55, 0.72, 1.15], mats.wood, cabin);
box('desk leg 2', [0.25, 1.45, 0.25], [0.15, 0.72, 1.15], mats.wood, cabin);
box('chair seat', [1.1, 0.2, 1.0], [1.8, 0.85, 1.3], mats.wood2, cabin);
box('chair back', [0.15, 1.2, 1.0], [2.3, 1.35, 1.65], mats.wood, cabin);
box('stove', [1.6, 1.0, 1.0], [-3.8, 0.65, 2.65], mats.metal, cabin);
box('bed', [2.6, 0.55, 4.1], [3.2, 0.42, -0.9], mats.wood, cabin);
box('mattress', [2.4, 0.18, 3.8], [3.2, 0.78, -0.9], mat(0x554b42), cabin);

const lantern = new THREE.PointLight(0xffbd73, 3.5, 12, 2);
lantern.position.set(-1.3, 2.7, 1.2);
lantern.castShadow = true;
cabin.add(lantern);

const signalBox = box('signal lever box', [0.8, 1.2, 0.8], [0, 0.65, -5.7], mats.metal);
const lever = new THREE.Group();
lever.position.set(0, 1.0, -5.72);
scene.add(lever);
box('lever base', [0.12, 1.7, 0.12], [0, 0.85, 0], mats.metal, lever);
const leverHandle = box('lever handle', [0.9, 0.12, 0.12], [0.35, 1.42, 0], mats.wood2, lever);
addInteractable(signalBox, 'Operate railway signal', () => toggleSignal());

// Railway corridor directly in front of cabin.
for (const x of [-1.15, 1.15]) {
  box('rail', [0.16, 0.12, 135], [x, 0.12, -60], mats.rail);
}
for (let z = 3; z >= -122; z -= 2.2) {
  box('sleeper', [3.4, 0.16, 0.24], [0, 0.02, z], mats.wood);
}

// Signal post and lamps.
const signal = new THREE.Group();
signal.position.set(4.2, 0, -7);
scene.add(signal);
cylinder('signal pole', 0.11, 4.8, [0, 2.4, 0], mats.metal, signal);
box('signal hood', [0.75, 1.5, 0.4], [0, 4.2, 0], mats.metal, signal);
const signalLamp = new THREE.PointLight(0xb83030, 3, 12, 2);
signalLamp.position.set(0, 4.25, -0.3);
signal.add(signalLamp);
const signalDisc = cylinder('signal disc', 0.32, 0.08, [0, 4.25, -0.32], mats.signalRed, signal);
signalDisc.rotation.x = Math.PI / 2;
let signalOpen = false;

// Barrier across the approach.
const barrierPivot = new THREE.Object3D();
barrierPivot.position.set(3.0, 1.2, -3.1);
scene.add(barrierPivot);
const barrier = box('barrier arm', [0.18, 0.18, 6.5], [3.25, 0, 0], mat(0xd8d1bd), barrierPivot);
for (let z = -3; z <= 3; z += 0.8) box('barrier stripe', [0.22, 0.19, 0.42], [3.25, 0.03, z], mats.signalRed, barrierPivot);

// Blinking street light.
const lampPole = cylinder('street pole', 0.12, 5.8, [8.2, 2.9, 1.0], mats.metal);
const lamp = new THREE.PointLight(0xffca90, 6, 15, 2);
lamp.position.set(8.2, 5.9, 0.9);
lamp.castShadow = true;
scene.add(lamp);
cylinder('lamp head', 0.28, 0.18, [8.2, 5.95, 0.9], mat(0x201d18));
let lampPhase = 0;

// Distant trees to frame the playable area.
function addTree(x, z, scale = 1) {
  cylinder('tree trunk', 0.28 * scale, 2.3 * scale, [x, 1.15 * scale, z], mats.wood);
  const crown = new THREE.Group();
  crown.position.set(x, 2.7 * scale, z);
  scene.add(crown);
  for (let i = 0; i < 3; i++) {
    const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(1.0 * scale, 0), mat(0x1f3828));
    leaf.position.set((i - 1) * 0.55 * scale, i * 0.25 * scale, (i % 2) * 0.35 * scale);
    leaf.castShadow = true;
    crown.add(leaf);
  }
}
for (const [x, z, s] of [[-11, 0, 1.4], [12, -2, 1.6], [-13, -12, 1.7], [13, -20, 1.8], [-10, -27, 1.5], [11, -33, 1.5]]) addTree(x, z, s);

function addTrain() {
  const train = new THREE.Group();
  train.position.set(0, 1.1, -125);
  scene.add(train);
  const bodyMat = mat(0x4e5661, 0.45, 0.45);
  for (let i = 0; i < 5; i++) {
    const carriage = box(`carriage-${i}`, [5.4, 3.2, 8], [0, 0, i * 8.2], bodyMat, train);
    box(`window-${i}-a`, [5.45, 1.15, 0.15], [0, 0.45, i * 8.2 - 3.65], mat(0x1c2a38, 0.25, 0.1), train);
    box(`window-${i}-b`, [5.45, 1.15, 0.15], [0, 0.45, i * 8.2 - 0.35], mat(0x1c2a38, 0.25, 0.1), train);
    carriage.castShadow = true;
  }
  const head = new THREE.PointLight(0xfff1cd, 9, 35, 2);
  head.position.set(0, 0.2, -4.5);
  train.add(head);
  const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 10), new THREE.MeshStandardMaterial({ color: 0xffffef, emissive: 0xffd980, emissiveIntensity: 3 }));
  headMesh.position.copy(head.position);
  train.add(headMesh);
  trainState = { train, speed: 22 };
  objectiveEl.textContent = `TRAIN ${String(nextTrainId).padStart(2, '0')} APPROACHING — operate the signal.`;
  nextTrainId += 1;
}

function minutesToClock(minutes) {
  const m = ((Math.floor(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

function toggleSignal() {
  signalOpen = !signalOpen;
  signalDisc.material = signalOpen ? mats.signalGreen : mats.signalRed;
  signalLamp.color.setHex(signalOpen ? 0x3dff86 : 0xb83030);
  barrierPivot.userData.target = signalOpen ? -Math.PI * 0.48 : 0;
  objectiveEl.textContent = signalOpen ? 'Signal clear. Wait for the train to pass.' : 'Signal red. Stand by for the next train.';
}

function cook() {
  if (trainState || gameMinutes >= 22 * 60) return;
  if (cooking.step === 0) {
    cooking.step = 1;
    objectiveEl.textContent = 'Dinner task: collect the meal from the stove.';
  } else {
    cooking.done = true;
    cooking.step = 2;
    objectiveEl.textContent = 'Dinner packed. Return to your post.';
  }
}
const stove = addInteractable(scene.getObjectByName('stove'), 'Prepare / collect dinner', cook, 2.4);

function tryInteract() {
  const origin = controls.object.position.clone();
  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  let best = null;
  let bestDistance = Infinity;
  for (const mesh of interactables) {
    const world = new THREE.Vector3();
    mesh.getWorldPosition(world);
    const distance = origin.distanceTo(world);
    const aim = world.clone().sub(origin).normalize().dot(forward);
    if (distance <= (mesh.userData.interact.range ?? 2.5) && aim > 0.55 && distance < bestDistance) {
      best = mesh;
      bestDistance = distance;
    }
  }
  if (best) best.userData.interact.callback();
}

window.addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (e.code === 'KeyE') tryInteract();
  if (e.code === 'Escape') controls.unlock();
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
renderer.domElement.addEventListener('click', () => {
  if (!controls.isLocked) controls.lock();
});
controls.addEventListener('lock', () => { hintEl.style.opacity = '0'; });
controls.addEventListener('unlock', () => { hintEl.style.opacity = '1'; });

function movePlayer(dt) {
  if (!controls.isLocked) return;
  const direction = new THREE.Vector3();
  if (keys.has('KeyW')) direction.z -= 1;
  if (keys.has('KeyS')) direction.z += 1;
  if (keys.has('KeyA')) direction.x -= 1;
  if (keys.has('KeyD')) direction.x += 1;
  if (direction.lengthSq() === 0) return;
  direction.normalize();
  const speed = keys.has('ShiftLeft') || keys.has('ShiftRight') ? player.sprint : player.speed;
  const move = direction.multiplyScalar(speed * dt);
  controls.moveRight(move.x);
  controls.moveForward(move.z);
  const p = controls.object.position;
  p.x = THREE.MathUtils.clamp(p.x, player.minX, player.maxX);
  p.z = THREE.MathUtils.clamp(p.z, player.minZ, player.maxZ);
  p.y = player.height;
}

function updateDoor(dt) {
  if (!doorPivot.userData) return;
  doorPivot.rotation.y = THREE.MathUtils.damp(doorPivot.rotation.y, doorPivot.userData.target ?? 0, 7, dt);
  barrierPivot.rotation.y = THREE.MathUtils.damp(barrierPivot.rotation.y, barrierPivot.userData.target ?? 0, 4, dt);
}

function updateLamp(t) {
  lampPhase += t;
  const blink = Math.sin(lampPhase * 3.8) > 0.93 || Math.sin(lampPhase * 11) > 0.97;
  lamp.intensity = blink ? 0.35 : 5.5;
}

function updateTrain(dt) {
  if (!trainState) return;
  trainState.train.position.z += trainState.speed * dt;
  if (!signalOpen) trainState.train.position.z = Math.min(trainState.train.position.z, -35);
  if (trainState.train.position.z > 14) {
    scene.remove(trainState.train);
    trainState = null;
    signalOpen = false;
    signalDisc.material = mats.signalRed;
    signalLamp.color.setHex(0xb83030);
    barrierPivot.userData.target = 0;
    lastTrainMinute = Math.ceil(gameMinutes / 30) * 30 + 30;
    objectiveEl.textContent = 'Train passed. Complete your meal, then stand by.';
  }
}

function updateSchedule() {
  if (trainState) return;
  if (gameMinutes >= lastTrainMinute) addTrain();
}

function updateHUD() {
  clockEl.textContent = minutesToClock(gameMinutes);
  const dist = camera.position.distanceTo(new THREE.Vector3(0, 1.0, -7));
  interactionEl.style.opacity = dist < 3 ? '1' : '0';
}

let prev = performance.now();
function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min((now - prev) / 1000, 0.05);
  prev = now;
  elapsed += dt;
  gameMinutes += dt * 0.5; // 30 in-game minutes per real 60 seconds.
  movePlayer(dt);
  updateDoor(dt);
  updateLamp(elapsed);
  updateTrain(dt);
  updateSchedule();
  updateHUD();
  renderer.render(scene, camera);
}
requestAnimationFrame(animate);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
