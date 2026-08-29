import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

const root = document.getElementById('game');
const clockEl = document.getElementById('clock');
const objectiveEl = document.getElementById('objective');
const hintEl = document.getElementById('hint');
const interactionEl = document.getElementById('interaction');
const startEl = document.getElementById('start');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07101b);
scene.fog = new THREE.FogExp2(0x07101b, 0.018);

const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.05, 220);
camera.position.set(0, 1.65, 8.7);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
root.appendChild(renderer.domElement);

const controls = new PointerLockControls(camera, renderer.domElement);

const keys = new Set();
const clock = new THREE.Clock();
let elapsed = 0;
let gameMinutes = 19 * 60;
const trainSchedule = [19 * 60 + 30, 20 * 60 + 30, 21 * 60 + 15, 22 * 60];
let trainIndex = 0;
let train = null;
let signalClear = false;
let dinnerPacked = false;
let doorOpen = false;
let lampTime = 0;

const colliders = [];
const interactables = [];

function material(color, roughness = 0.8, metalness = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

const M = {
  plaster: material(0x6f655b, 0.95),
  wood: material(0x4a2e1f, 0.9),
  woodLight: material(0x775039, 0.9),
  floor: material(0x302820, 1),
  roof: material(0x202327, 0.98),
  metal: material(0x3e454a, 0.45, 0.7),
  rail: material(0x4b4f52, 0.28, 0.9),
  sleeper: material(0x3d2b20, 0.95),
  gravel: material(0x4a4742, 1),
  glass: new THREE.MeshStandardMaterial({ color: 0x71899a, roughness: 0.12, metalness: 0.05, transparent: true, opacity: 0.28 }),
  red: material(0x9b2d28, 0.5),
  green: material(0x3e8b59, 0.45),
  black: material(0x17191b, 0.95),
  cloth: material(0x66594f, 1),
  foliage: material(0x183026, 1),
};

function box(name, size, pos, mat, parent = scene, collision = false) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), mat);
  mesh.name = name;
  mesh.position.set(...pos);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  if (collision) addCollider(mesh, size);
  return mesh;
}

function cylinder(name, radius, height, pos, mat, parent = scene, segments = 16, collision = false) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, segments), mat);
  mesh.name = name;
  mesh.position.set(...pos);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  if (collision) addCollider(mesh, [radius * 2, height, radius * 2]);
  return mesh;
}

function addCollider(mesh, size) {
  colliders.push({ mesh, size: new THREE.Vector3(...size) });
  return mesh;
}

function addInteractable(mesh, label, action, range = 2.2) {
  mesh.userData.interact = { label, action, range };
  interactables.push(mesh);
  return mesh;
}

function collidesAt(pos) {
  const radius = 0.32;
  const height = 1.65;
  const pMinX = pos.x - radius, pMaxX = pos.x + radius;
  const pMinZ = pos.z - radius, pMaxZ = pos.z + radius;
  const pMinY = 0.1, pMaxY = height;
  for (const c of colliders) {
    const s = c.size, p = c.mesh.position;
    const minX = p.x - s.x / 2, maxX = p.x + s.x / 2;
    const minZ = p.z - s.z / 2, maxZ = p.z + s.z / 2;
    const minY = p.y - s.y / 2, maxY = p.y + s.y / 2;
    if (pMaxX > minX && pMinX < maxX && pMaxZ > minZ && pMinZ < maxZ && pMaxY > minY && pMinY < maxY) return true;
  }
  return false;
}

function movePlayer(dx, dz) {
  const tryX = camera.position.clone();
  tryX.x += dx;
  if (!collidesAt(tryX)) camera.position.x = tryX.x;
  const tryZ = camera.position.clone();
  tryZ.z += dz;
  if (!collidesAt(tryZ)) camera.position.z = tryZ.z;
  camera.position.x = THREE.MathUtils.clamp(camera.position.x, -17, 17);
  camera.position.z = THREE.MathUtils.clamp(camera.position.z, -52, 10.8);
  camera.position.y = 1.65;
}

const hemi = new THREE.HemisphereLight(0x8da9d4, 0x18130f, 0.78);
scene.add(hemi);
const moon = new THREE.DirectionalLight(0xb7c9ff, 1.8);
moon.position.set(-28, 35, 18);
moon.castShadow = true;
moon.shadow.mapSize.set(2048, 2048);
moon.shadow.camera.left = -70;
moon.shadow.camera.right = 70;
moon.shadow.camera.top = 70;
moon.shadow.camera.bottom = -70;
scene.add(moon);

const moonDisc = new THREE.Mesh(new THREE.SphereGeometry(2.2, 24, 24), new THREE.MeshBasicMaterial({ color: 0xdde8ff }));
moonDisc.position.set(-42, 34, -70);
scene.add(moonDisc);
const starsGeo = new THREE.BufferGeometry();
const starPositions = [];
for (let i = 0; i < 260; i++) {
  const a = Math.random() * Math.PI * 2;
  const r = 70 + Math.random() * 50;
  starPositions.push(Math.cos(a) * r, 18 + Math.random() * 45, -20 - Math.random() * 90);
}
starsGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
scene.add(new THREE.Points(starsGeo, new THREE.PointsMaterial({ color: 0xc9d8ee, size: 0.12, sizeAttenuation: true })));

box('ground', [70, 0.25, 140], [0, -0.18, -38], M.gravel);
box('yard', [38, 0.03, 100], [0, -0.02, -38], material(0x3c3935, 1));

const cabin = new THREE.Group();
scene.add(cabin);
box('cabin floor', [12, 0.35, 9], [0, 0, 8], M.floor, cabin, true);
box('back wall', [12, 4.6, 0.32], [0, 2.3, 12.34], M.plaster, cabin, true);
box('left wall', [0.32, 4.6, 9], [-5.84, 2.3, 8], M.plaster, cabin, true);
box('right wall', [0.32, 4.6, 9], [5.84, 2.3, 8], M.plaster, cabin, true);
box('front wall left', [4.1, 4.6, 0.32], [-3.95, 2.3, 3.66], M.plaster, cabin, true);
box('front wall right', [4.1, 4.6, 0.32], [3.95, 2.3, 3.66], M.plaster, cabin, true);
box('front lintel', [3.8, 1.1, 0.32], [0, 4.05, 3.66], M.plaster, cabin, true);
box('roof', [13, 0.42, 10], [0, 4.72, 8], M.roof, cabin, true);
box('front roof beam', [13, 0.22, 0.22], [0, 4.5, 3.35], M.wood, cabin);
box('left roof beam', [0.22, 0.22, 9.5], [-5.55, 4.5, 8], M.wood, cabin);
box('right roof beam', [0.22, 0.22, 9.5], [5.55, 4.5, 8], M.wood, cabin);

const doorPivot = new THREE.Object3D();
doorPivot.position.set(-1.1, 0, 3.48);
scene.add(doorPivot);
const door = box('front door', [2.2, 3.85, 0.18], [1.1, 1.93, 0], M.woodLight, doorPivot);
const doorCollider = { mesh: door, size: new THREE.Vector3(2.2, 3.85, 0.18) };
colliders.push(doorCollider);
addInteractable(door, 'Open door', () => {
  doorOpen = !doorOpen;
  doorPivot.userData.target = doorOpen ? -Math.PI / 2 : 0;
  if (doorOpen) {
    const i = colliders.indexOf(doorCollider);
    if (i >= 0) colliders.splice(i, 1);
    door.userData.interact.label = 'Close door';
  } else {
    if (!colliders.includes(doorCollider)) colliders.push(doorCollider);
    door.userData.interact.label = 'Open door';
  }
});

function windowFrame(x, y, z, rotationY = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotationY;
  scene.add(g);
  box('window top', [3.2, 0.18, 0.18], [0, 0.9, 0], M.wood, g);
  box('window bottom', [3.2, 0.18, 0.18], [0, -0.9, 0], M.wood, g);
  box('window left', [0.18, 1.8, 0.18], [-1.5, 0, 0], M.wood, g);
  box('window right', [0.18, 1.8, 0.18], [1.5, 0, 0], M.wood, g);
  box('window glass', [2.8, 1.45, 0.05], [0, 0, -0.02], M.glass, g);
}
windowFrame(-5.65, 2.65, 8.0, Math.PI / 2);

box('desk top', [3.4, 0.28, 1.1], [-1.8, 1.35, 9.8], M.woodLight, cabin, true);
for (const x of [-3.15, -0.45]) box('desk leg', [0.22, 1.35, 0.22], [x, 0.67, 9.8], M.wood, cabin, true);
box('chair seat', [1.1, 0.22, 1], [1.4, 0.8, 9.5], M.woodLight, cabin, true);
box('chair back', [0.18, 1.1, 1], [1.85, 1.3, 9.85], M.wood, cabin, true);
box('bed frame', [2.7, 0.5, 4.0], [3.5, 0.38, 6.8], M.wood, cabin, true);
box('mattress', [2.45, 0.18, 3.7], [3.5, 0.72, 6.8], M.cloth, cabin);
const stoveInteract = box('stove', [1.35, 1.0, 1.0], [-3.8, 0.65, 6.0], M.metal, cabin, true);
addInteractable(stoveInteract, 'Cook dinner', () => {
  if (train) return;
  dinnerPacked = true;
  objectiveEl.textContent = 'Dinner packed. Return to the signal cabin desk.';
}, 2.2);

const lantern = new THREE.PointLight(0xffb86c, 4.2, 10, 2);
lantern.position.set(-1.4, 3.0, 9.0);
lantern.castShadow = true;
scene.add(lantern);

const signalBox = box('signal control', [0.9, 1.2, 0.8], [0, 0.6, 5.4], M.metal, scene, true);
addInteractable(signalBox, 'Operate signal', () => toggleSignal(), 2.5);
const leverPivot = new THREE.Object3D();
leverPivot.position.set(0.25, 0.9, 5.0);
scene.add(leverPivot);
box('lever stem', [0.12, 1.45, 0.12], [0, 0.7, 0], M.metal, leverPivot);
box('lever handle', [0.9, 0.12, 0.12], [0.3, 1.28, 0], M.red, leverPivot);

for (const x of [-1.25, 1.25]) box('rail', [0.16, 0.12, 120], [x, 0.1, -55], M.rail);
for (let z = 2; z >= -112; z -= 2.2) box('sleeper', [3.5, 0.14, 0.25], [0, 0.02, z], M.sleeper);
box('rail ballast', [4.2, 0.16, 120], [0, -0.02, -55], M.gravel);

const signal = new THREE.Group();
signal.position.set(3.7, 0, 1.0);
scene.add(signal);
cylinder('signal pole', 0.11, 5.2, [0, 2.6, 0], M.metal, signal);
box('signal housing', [0.9, 1.5, 0.5], [0, 4.35, 0], M.black, signal);
const signalLamp = new THREE.PointLight(0xa72b2b, 2.8, 9);
signalLamp.position.set(0, 4.35, -0.3);
signal.add(signalLamp);
const signalDisc = cylinder('signal lamp', 0.28, 0.08, [0, 4.35, -0.31], M.red, signal, 16);
signalDisc.rotation.x = Math.PI / 2;

const barrierPivot = new THREE.Object3D();
barrierPivot.position.set(5.0, 1.0, 2.2);
scene.add(barrierPivot);
const barrier = box('barrier arm', [0.16, 0.16, 10.0], [-5.0, 0, 0], M.woodLight, barrierPivot);
for (let x = -9.2; x <= -0.8; x += 0.8) box('barrier stripe', [0.38, 0.18, 0.18], [x, 0.02, 0], M.red, barrierPivot);
addCollider(barrier, [10.0, 0.16, 0.16]);

const streetPole = cylinder('street light pole', 0.11, 5.8, [8.2, 2.9, 3.0], M.metal);
const streetLamp = new THREE.PointLight(0xffc98f, 5.5, 16, 2);
streetLamp.position.set(8.2, 5.8, 3.0);
streetLamp.castShadow = true;
scene.add(streetLamp);
cylinder('street lamp head', 0.27, 0.18, [8.2, 5.9, 3.0], M.black);

function addTree(x, z, s = 1) {
  cylinder('tree trunk', 0.25 * s, 2.4 * s, [x, 1.2 * s, z], M.wood);
  for (let i = 0; i < 3; i++) {
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.0 * s, 0), M.foliage);
    crown.position.set(x + (i - 1) * 0.45 * s, 2.4 * s + i * 0.45 * s, z + (i % 2) * 0.35 * s);
    crown.castShadow = true;
    scene.add(crown);
  }
}
[[-11,2,1.5],[12,0,1.6],[-13,-13,1.8],[13,-20,1.8],[-11,-29,1.5],[11,-37,1.6],[-15,-48,1.8],[15,-52,1.8]].forEach(v => addTree(...v));

function addTrain() {
  const group = new THREE.Group();
  group.position.set(0, 1.6, -105);
  scene.add(group);
  const body = material(0x3e4852, 0.42, 0.45);
  const dark = material(0x1a2730, 0.3, 0.25);
  for (let i = 0; i < 6; i++) {
    const z = i * 7.6;
    box(`coach-${i}`, [5.4, 3.1, 7.1], [0, 0, z], body, group);
    box(`window-band-${i}`, [5.45, 1.0, 0.12], [0, 0.55, z - 3.1], dark, group);
    box(`window-band2-${i}`, [5.45, 1.0, 0.12], [0, 0.55, z + 0.8], dark, group);
  }
  const head = new THREE.PointLight(0xffefc4, 11, 42, 2);
  head.position.set(0, 0, -4);
  group.add(head);
  const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 12), new THREE.MeshStandardMaterial({ color: 0xffffee, emissive: 0xffd98b, emissiveIntensity: 4 }));
  headMesh.position.copy(head.position);
  group.add(headMesh);
  train = { group, speed: 25 };
  objectiveEl.textContent = 'TRAIN APPROACHING — operate the signal.';
}

function toggleSignal() {
  signalClear = !signalClear;
  signalDisc.material = signalClear ? M.green : M.red;
  signalLamp.color.setHex(signalClear ? 0x55ff91 : 0xb52c2c);
  leverPivot.rotation.z = signalClear ? -0.7 : 0;
  barrierPivot.userData.target = signalClear ? -Math.PI * 0.5 : 0;
  objectiveEl.textContent = signalClear ? 'Signal clear. Wait for the train.' : 'Signal red. Operate it when the train is due.';
}

function nearestInteractable() {
  let best = null;
  let bestDist = Infinity;
  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  for (const mesh of interactables) {
    if (!mesh.visible || !mesh.userData.interact) continue;
    const world = mesh.getWorldPosition(new THREE.Vector3());
    const d = camera.position.distanceTo(world);
    if (d > mesh.userData.interact.range) continue;
    const to = world.sub(camera.position).normalize();
    if (forward.dot(to) < 0.25) continue;
    if (d < bestDist) { best = mesh; bestDist = d; }
  }
  return best;
}

function interact() {
  const target = nearestInteractable();
  if (target) target.userData.interact.action();
}

window.addEventListener('keydown', e => {
  keys.add(e.code);
  if (e.code === 'KeyE') interact();
  if (e.code === 'Escape') controls.unlock();
});
window.addEventListener('keyup', e => keys.delete(e.code));
renderer.domElement.addEventListener('click', () => { if (!controls.isLocked) controls.lock(); });
startEl.addEventListener('click', () => { controls.lock(); startEl.style.display = 'none'; });
controls.addEventListener('lock', () => { startEl.style.display = 'none'; });
controls.addEventListener('unlock', () => { if (elapsed < 2) startEl.style.display = 'grid'; });

function updatePlayer(dt) {
  if (!controls.isLocked) return;
  let forward = 0, strafe = 0;
  if (keys.has('KeyW')) forward += 1;
  if (keys.has('KeyS')) forward -= 1;
  if (keys.has('KeyD')) strafe += 1;
  if (keys.has('KeyA')) strafe -= 1;
  if (!forward && !strafe) return;
  const len = Math.hypot(forward, strafe) || 1;
  const speed = keys.has('ShiftLeft') || keys.has('ShiftRight') ? 6.2 : 3.8;
  movePlayer(strafe / len * speed * dt, forward / len * speed * dt);
}

function minutesToClock(total) {
  const m = Math.floor(total) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2,'0')}:${String(m % 60).padStart(2,'0')}`;
}

function updateClock(dt) {
  gameMinutes += dt * 0.5; // 30 in-game minutes per real minute.
  clockEl.textContent = minutesToClock(gameMinutes);
}

function updateTrain(dt) {
  if (!train && trainIndex < trainSchedule.length && gameMinutes >= trainSchedule[trainIndex]) {
    addTrain();
    trainIndex++;
  }
  if (!train) return;
  train.group.position.z += train.speed * dt;
  if (train.group.position.z > 20) {
    scene.remove(train.group);
    train = null;
    signalClear = false;
    signalDisc.material = M.red;
    signalLamp.color.setHex(0xb52c2c);
    leverPivot.rotation.z = 0;
    barrierPivot.userData.target = 0;
    objectiveEl.textContent = dinnerPacked ? 'Train passed. Return to your signal post.' : 'Train passed. Quiet gap — prepare your dinner at the stove.';
  }
}

function updateDoor(dt) {
  doorPivot.rotation.y = THREE.MathUtils.damp(doorPivot.rotation.y, doorPivot.userData.target ?? 0, 7, dt);
}
function updateBarrier(dt) {
  barrierPivot.rotation.z = THREE.MathUtils.damp(barrierPivot.rotation.z, barrierPivot.userData.target ?? 0, 6, dt);
}
function updateLamp(dt) {
  lampTime += dt;
  const cycle = lampTime % 5.5;
  let intensity = 5.5;
  if (cycle > 3.65 && cycle < 3.82) intensity = 0.25;
  if (cycle > 3.95 && cycle < 4.08) intensity = 0.8;
  if (cycle > 4.14 && cycle < 4.24) intensity = 0.15;
  if (cycle > 4.34 && cycle < 4.42) intensity = 4.5;
  streetLamp.intensity = intensity;
}
function updateUI() {
  const target = nearestInteractable();
  interactionEl.textContent = target ? `E · ${target.userData.interact.label}` : '';
  interactionEl.style.opacity = target ? '1' : '0';
  hintEl.textContent = controls.isLocked ? 'WASD move · Mouse look · E interact · Shift sprint · Esc release mouse' : 'Click the scene to start · WASD move · Mouse look · E interact · Shift sprint';
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;
  updatePlayer(dt);
  updateClock(dt);
  updateTrain(dt);
  updateDoor(dt);
  updateBarrier(dt);
  updateLamp(dt);
  updateUI();
  renderer.render(scene, camera);
}
animate();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
