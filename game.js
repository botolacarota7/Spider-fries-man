import * as THREE from 'three';

const CITY_N = 9, CELL = 76, STREET = 16, BLOCK = 60, HALF = 350;
const G = 30, WALK = 8, RUN = 14, JUMP_V = 12, JUMP2_V = 11, MAX_SPEED = 55;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const lerpAngle = (a, b, t) => {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
};

const audio = {
  ctx: null,
  init() { if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); },
  tone(freq, dur, type = 'square', vol = 0.08, slide = 0) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), this.ctx.currentTime + dur);
    g.gain.value = vol;
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    o.connect(g).connect(this.ctx.destination);
    o.start(); o.stop(this.ctx.currentTime + dur);
  },
  thwip() { this.tone(900, 0.12, 'sawtooth', 0.05, -600); },
  collect() { this.tone(880, 0.1, 'sine', 0.1); setTimeout(() => this.tone(1320, 0.15, 'sine', 0.1), 90); },
  complete() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.tone(f, 0.18, 'triangle', 0.1), i * 120)); },
  fail() { [400, 300, 200].forEach((f, i) => setTimeout(() => this.tone(f, 0.2, 'sawtooth', 0.07), i * 130)); },
  eat() { this.tone(220, 0.08, 'square', 0.08); setTimeout(() => this.tone(180, 0.08, 'square', 0.08), 110); },
  hurt() { this.tone(150, 0.2, 'sawtooth', 0.1, -80); }
};

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.domElement.id = 'game';
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87b5e0);
scene.fog = new THREE.Fog(0x87b5e0, 120, 480);

const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 1200);

const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x3a3a35, 0.8);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2d9, 1.6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -70; sun.shadow.camera.right = 70;
sun.shadow.camera.top = 70; sun.shadow.camera.bottom = -70;
sun.shadow.camera.far = 400;
sun.shadow.bias = -0.0004;
scene.add(sun, sun.target);

const PARKS = [[4, 4], [1, 6]];
const FOODS = [
  { i: 2, j: 2, name: 'Burger Ragno', color: 0xd32f2f, sign: 0xffeb3b },
  { i: 6, j: 4, name: 'Pizza Planeta', color: 0xef6c00, sign: 0xffffff },
  { i: 4, j: 7, name: 'Kebab King', color: 0x2e7d32, sign: 0xff5252 }
];
const isPark = (i, j) => PARKS.some(p => p[0] === i && p[1] === j);
const isFood = (i, j) => FOODS.some(f => f.i === i && f.j === j);
const blockMin = i => -HALF + STREET + i * CELL;
const blockCenter = i => -HALF + STREET + i * CELL + BLOCK / 2;
const streetC = i => -HALF + STREET / 2 + i * CELL;

function groundTexture() {
  const S = 2048, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const px = S / (HALF * 2);
  const W = v => (v + HALF) * px;
  g.fillStyle = '#2b2b30';
  g.fillRect(0, 0, S, S);
  g.strokeStyle = '#c7a72c';
  g.lineWidth = Math.max(1, px * 0.35);
  g.setLineDash([px * 3, px * 3]);
  for (let k = 0; k <= CITY_N; k++) {
    const s = streetC(k);
    g.beginPath(); g.moveTo(W(s), 0); g.lineTo(W(s), S); g.stroke();
    g.beginPath(); g.moveTo(0, W(s)); g.lineTo(S, W(s)); g.stroke();
  }
  g.setLineDash([]);
  for (let i = 0; i < CITY_N; i++) for (let j = 0; j < CITY_N; j++) {
    const x = blockMin(i), z = blockMin(j);
    g.fillStyle = '#585860';
    g.fillRect(W(x), W(z), BLOCK * px, BLOCK * px);
    g.fillStyle = isPark(i, j) ? '#2e7d32' : '#6d6d68';
    g.fillRect(W(x + 4), W(z + 4), (BLOCK - 8) * px, (BLOCK - 8) * px);
    if (isPark(i, j)) {
      g.fillStyle = '#256a29';
      for (let t = 0; t < 14; t++) {
        g.beginPath();
        g.arc(W(x + rand(8, 52)), W(z + rand(8, 52)), rand(2, 5) * px, 0, 7);
        g.fill();
      }
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 8;
  return tex;
}

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(HALF * 2, HALF * 2),
  new THREE.MeshStandardMaterial({ map: groundTexture(), roughness: 0.95 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const buildings = [];
const windowMats = [];
const rayTargets = [];

function makeWindowTextures(base) {
  const lit = ['#ffd97a', '#cfe8ff', '#ffe9b0'];
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const e = document.createElement('canvas'); e.width = e.height = 128;
  const ge = e.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 128, 128);
  ge.fillStyle = '#000'; ge.fillRect(0, 0, 128, 128);
  for (let x = 0; x < 8; x++) for (let y = 0; y < 8; y++) {
    const on = Math.random() < 0.4;
    g.fillStyle = on ? lit[randi(0, 2)] : 'rgba(20,26,34,0.9)';
    g.fillRect(x * 16 + 4, y * 16 + 4, 8, 9);
    if (on) { ge.fillStyle = g.fillStyle; ge.fillRect(x * 16 + 4, y * 16 + 4, 8, 9); }
  }
  const map = new THREE.CanvasTexture(c);
  const em = new THREE.CanvasTexture(e);
  [map, em].forEach(t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; });
  return { map, em };
}

const facadeVariants = ['#7a8290', '#8f8577', '#6f7b8c', '#9a8f85', '#5d6a75'].map(makeWindowTextures);
const facadeColors = ['#7a8290', '#8f8577', '#6f7b8c', '#9a8f85', '#5d6a75'];

function addBuilding(cx, cz, w, d, h) {
  const v = randi(0, 4);
  const { map, em } = facadeVariants[v];
  const side = new THREE.MeshStandardMaterial({
    map: map.clone(), emissiveMap: em.clone(), emissive: 0xffffff,
    emissiveIntensity: 0.15, roughness: 0.85
  });
  side.map.repeat.set(Math.max(1, Math.round(w / 7)), Math.max(1, Math.round(h / 7)));
  side.emissiveMap.repeat.copy(side.map.repeat);
  side.map.needsUpdate = true;
  side.emissiveMap.needsUpdate = true;
  windowMats.push(side);
  const top = new THREE.MeshStandardMaterial({ color: new THREE.Color(facadeColors[v]).multiplyScalar(0.5), roughness: 0.95 });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [side, side, top, top, side, side]);
  mesh.position.set(cx, h / 2, cz);
  mesh.castShadow = mesh.receiveShadow = true;
  scene.add(mesh);
  buildings.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2, h, mesh });
  rayTargets.push(mesh);
}

function signTexture(text, bg) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#' + bg.toString(16).padStart(6, '0');
  g.fillRect(0, 0, 512, 128);
  g.fillStyle = '#111';
  g.font = 'bold 62px Trebuchet MS';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 256, 66);
  return new THREE.CanvasTexture(c);
}

const restaurants = [];
FOODS.forEach(f => {
  const cx = blockCenter(f.i), cz = blockCenter(f.j);
  const w = 26, d = 16, h = 7;
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color: f.color, roughness: 0.6 })
  );
  body.position.set(cx, h / 2, cz);
  body.castShadow = body.receiveShadow = true;
  scene.add(body);
  const tex = signTexture(f.name, f.sign);
  const sign = new THREE.Mesh(
    new THREE.BoxGeometry(w * 0.9, 2.6, 0.6),
    new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.4 })
  );
  sign.position.set(cx, h + 1.6, cz + d / 2 - 0.2);
  scene.add(sign);
  windowMats.push(sign.material);
  buildings.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2, h, mesh: body });
  rayTargets.push(body);
  restaurants.push({ name: f.name, x: cx, z: cz + d / 2 + 1.5 });
});

for (let i = 0; i < CITY_N; i++) for (let j = 0; j < CITY_N; j++) {
  if (isPark(i, j) || isFood(i, j)) continue;
  const distC = Math.hypot(blockCenter(i), blockCenter(j)) / 500;
  for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) {
    if (Math.random() < 0.15) continue;
    const w = rand(17, 24), d = rand(17, 24);
    const cx = blockMin(i) + 4 + a * 28 + w / 2 + rand(-1, 1);
    const cz = blockMin(j) + 4 + b * 28 + d / 2 + rand(-1, 1);
    const tall = Math.random() < 0.25 ? rand(60, 110) : rand(14, 55);
    const h = Math.max(12, tall * (1.15 - distC) + rand(0, 10));
    addBuilding(cx, cz, w, d, h);
  }
}

const treeMat1 = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 1 });
const treeMat2 = new THREE.MeshStandardMaterial({ color: 0x1b5e20, roughness: 1 });
PARKS.forEach(([i, j]) => {
  for (let t = 0; t < 14; t++) {
    const x = blockMin(i) + rand(7, 53), z = blockMin(j) + rand(7, 53);
    const s = rand(0.8, 1.5);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35 * s, 0.5 * s, 4 * s), treeMat1);
    trunk.position.set(x, 2 * s, z);
    const crown = new THREE.Mesh(new THREE.SphereGeometry(2.6 * s, 8, 6), treeMat2);
    crown.position.set(x, 5 * s, z);
    trunk.castShadow = crown.castShadow = true;
    scene.add(trunk, crown);
  }
});

const lampMat = new THREE.MeshStandardMaterial({ color: 0x37474f, roughness: 0.7 });
const bulbMat = new THREE.MeshStandardMaterial({ color: 0xfff3c4, emissive: 0xffdf80, emissiveIntensity: 0.1 });
for (let i = 0; i <= CITY_N; i += 2) for (let j = 0; j <= CITY_N; j += 2) {
  const x = streetC(i) + 4, z = streetC(j) + 4;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 7), lampMat);
  pole.position.set(x, 3.5, z);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), bulbMat);
  bulb.position.set(x, 7.2, z);
  scene.add(pole, bulb);
}

const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.85 });
const clouds = [];
for (let i = 0; i < 14; i++) {
  const grp = new THREE.Group();
  for (let k = 0; k < 4; k++) {
    const s = rand(6, 14);
    const m = new THREE.Mesh(new THREE.SphereGeometry(s, 7, 5), cloudMat);
    m.position.set(rand(-14, 14), rand(-2, 2), rand(-8, 8));
    m.scale.y = 0.55;
    grp.add(m);
  }
  grp.position.set(rand(-HALF, HALF), rand(120, 170), rand(-HALF, HALF));
  scene.add(grp);
  clouds.push(grp);
}

const carBodyMats = [0xc62828, 0x1565c0, 0xf9a825, 0x37474f, 0x2e7d32, 0xffffff].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.4, metalness: 0.4 }));
const carDark = new THREE.MeshStandardMaterial({ color: 0x111318, roughness: 0.3 });
const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.9 });
const cars = [];
for (let n = 0; n < 16; n++) {
  const grp = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.8, 4.4), carBodyMats[n % carBodyMats.length]);
  body.position.y = 0.75;
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.7, 2.2), carDark);
  cab.position.set(0, 1.45, -0.2);
  grp.add(body, cab);
  [[-0.9, 1.4], [0.9, 1.4], [-0.9, -1.4], [0.9, -1.4]].forEach(([x, z]) => {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.3), wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.38, z);
    grp.add(w);
  });
  body.castShadow = true;
  const axis = Math.random() < 0.5 ? 'x' : 'z';
  const k = randi(0, CITY_N);
  const lane = Math.random() < 0.5 ? -3 : 3;
  const dir = lane > 0 ? 1 : -1;
  if (axis === 'x') grp.position.set(rand(-HALF, HALF), 0, streetC(k) + lane);
  else { grp.position.set(streetC(k) + lane, 0, rand(-HALF, HALF)); grp.rotation.y = Math.PI / 2; }
  scene.add(grp);
  cars.push({ grp, axis, dir, speed: rand(9, 16) });
}

const pedColors = [0xe57373, 0x64b5f6, 0x81c784, 0xfff176, 0xba68c8, 0xff8a65];
const peds = [];
for (let n = 0; n < 18; n++) {
  const grp = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.7, 3, 8), new THREE.MeshStandardMaterial({ color: pedColors[n % pedColors.length], roughness: 0.8 }));
  body.position.y = 0.95;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshStandardMaterial({ color: 0xd7a583, roughness: 0.9 }));
  head.position.y = 1.62;
  body.castShadow = true;
  grp.add(body, head);
  scene.add(grp);
  peds.push({ grp, bi: randi(0, CITY_N - 1), bj: randi(0, CITY_N - 1), t: Math.random(), speed: rand(0.02, 0.05), dir: Math.random() < 0.5 ? 1 : -1 });
}
function pedPos(p) {
  const m = 2.2, x0 = blockMin(p.bi), z0 = blockMin(p.bj), L = BLOCK - m * 2;
  const per = L * 4;
  const d = ((p.t % 1) + 1) % 1 * per;
  let x, z, ry;
  if (d < L) { x = x0 + m + d; z = z0 + m; ry = 0; }
  else if (d < L * 2) { x = x0 + BLOCK - m; z = z0 + m + (d - L); ry = Math.PI / 2; }
  else if (d < L * 3) { x = x0 + BLOCK - m - (d - L * 2); z = z0 + BLOCK - m; ry = Math.PI; }
  else { x = x0 + m; z = z0 + BLOCK - m - (d - L * 3); ry = -Math.PI / 2; }
  return { x, z, ry };
}

const COSTUMES = [
  { id: 'classico', name: 'Classico', desc: 'Il suit rosso e blu originale', price: 0, torso: 0xc8102e, arms: 0xc8102e, legs: 0x1a3a9c, head: 0xc8102e, accent: 0xffffff },
  { id: 'symbiote', name: 'Symbiote', desc: 'Il nero con il ragno bianco', price: 200, torso: 0x101014, arms: 0x101014, legs: 0x101014, head: 0x101014, accent: 0xf5f5f5 },
  { id: 'miles', name: 'Miles Morales', desc: 'Nero con dettagli rossi', price: 300, torso: 0x14141a, arms: 0xc8102e, legs: 0x14141a, head: 0x14141a, accent: 0xc8102e },
  { id: 'scarlet', name: 'Scarlet Spider', desc: 'Rosso e blu con giacca', price: 400, torso: 0xd32f2f, arms: 0x1a3a9c, legs: 0x1a3a9c, head: 0xd32f2f, accent: 0x212121 },
  { id: 'iron', name: 'Iron Spider', desc: 'Rosso e oro nanotecnologico', price: 500, torso: 0xb71c1c, arms: 0xffc107, legs: 0xb71c1c, head: 0xb71c1c, accent: 0xffc107 }
];

const save = JSON.parse(localStorage.getItem('spidey_save') || '{}');
const state = {
  money: save.money ?? 50,
  unlocked: save.unlocked || ['classico'],
  costume: save.costume || 'classico',
  hp: 100, stamina: 100,
  fast: 0,
  started: false, paused: false, menuOpen: null
};
function persist() {
  localStorage.setItem('spidey_save', JSON.stringify({ money: state.money, unlocked: state.unlocked, costume: state.costume }));
}

const player = new THREE.Group();
scene.add(player);
const parts = {};
function buildPlayer() {
  while (player.children.length) player.remove(player.children[0]);
  const c = COSTUMES.find(k => k.id === state.costume) || COSTUMES[0];
  const matT = new THREE.MeshStandardMaterial({ color: c.torso, roughness: 0.55 });
  const matA = new THREE.MeshStandardMaterial({ color: c.arms, roughness: 0.55 });
  const matL = new THREE.MeshStandardMaterial({ color: c.legs, roughness: 0.55 });
  const matH = new THREE.MeshStandardMaterial({ color: c.head, roughness: 0.55 });
  const accent = new THREE.MeshStandardMaterial({ color: c.accent, roughness: 0.4, emissive: c.accent, emissiveIntensity: 0.15 });

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.5, 4, 10), matT);
  torso.position.y = 1.18;
  torso.castShadow = true;
  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.22, 0.28), matL);
  pelvis.position.y = 0.86;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 12, 10), matH);
  head.position.y = 1.72;
  head.castShadow = true;
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), accent);
  eyeL.position.set(-0.09, 1.74, -0.16);
  eyeL.scale.set(1, 0.55, 0.7);
  const eyeR = eyeL.clone(); eyeR.position.x = 0.09;
  const emblem = new THREE.Mesh(new THREE.OctahedronGeometry(0.09), accent);
  emblem.position.set(0, 1.28, -0.24);
  emblem.scale.set(1.4, 1, 0.4);

  function limb(mat, len, r) {
    const g = new THREE.Group();
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 3, 8), mat);
    m.position.y = -len / 2 - r * 0.5;
    m.castShadow = true;
    g.add(m);
    return g;
  }
  parts.armL = limb(matA, 0.52, 0.09); parts.armL.position.set(-0.36, 1.5, 0);
  parts.armR = limb(matA, 0.52, 0.09); parts.armR.position.set(0.36, 1.5, 0);
  parts.legL = limb(matL, 0.62, 0.11); parts.legL.position.set(-0.16, 0.86, 0);
  parts.legR = limb(matL, 0.62, 0.11); parts.legR.position.set(0.16, 0.86, 0);
  parts.handR = new THREE.Object3D();
  parts.handR.position.y = -0.75;
  parts.armR.add(parts.handR);

  player.add(torso, pelvis, head, eyeL, eyeR, emblem, parts.armL, parts.armR, parts.legL, parts.legR);
}
buildPlayer();

const rope = new THREE.Mesh(
  new THREE.CylinderGeometry(0.035, 0.035, 1, 5),
  new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.8 })
);
rope.visible = false;
scene.add(rope);
const rope2 = rope.clone();
rope2.visible = false;
scene.add(rope2);

const vel = new THREE.Vector3();
const pos = new THREE.Vector3(0, 0, 60);
let yaw = 0, pitch = 0.35;
let grounded = true, jumps = 0, prevY = 0, prevVy = 0;
let webAttached = false, webAnchor = new THREE.Vector3(), ropeLen = 0;
let zipTime = 0, hurtCd = 0;
let swingPhase = 0;

const keys = {};
addEventListener('keydown', e => {
  keys[e.code] = true;
  if (!state.started || state.menuOpen || state.paused) return;
  if (e.code === 'KeyT') toggleMenu('costume');
  if (e.code === 'KeyF') tryInteract();
  if (e.code === 'KeyE') {
    const t = thugs.find(t => !t.wrapped && pos.distanceTo(t.grp.position) < 3.5);
    if (t) webThug(t); else tryZip();
  }
  if (e.code === 'KeyC') cycleCostume();
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('contextmenu', e => e.preventDefault());
addEventListener('mousedown', e => {
  if (!state.started || state.menuOpen || state.paused) return;
  if (e.button === 0) tryWeb();
  if (e.button === 2) tryZip();
});
addEventListener('mouseup', e => { if (e.button === 0) detachWeb(); });
addEventListener('mousemove', e => {
  if (document.pointerLockElement !== renderer.domElement) return;
  yaw -= e.movementX * 0.0024;
  pitch = clamp(pitch + e.movementY * 0.0022, -0.5, 1.35);
});
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement !== renderer.domElement && state.started && !state.menuOpen && !state.paused) {
    state.paused = true;
    document.getElementById('pauseStats').innerHTML =
      `Salvato: €${state.money} · Costumi sbloccati: ${state.unlocked.length}/${COSTUMES.length}<br><br>` +
      `Missione in corso: ${mission ? mission.title : 'nessuna'}`;
    document.getElementById('pauseOverlay').style.display = 'flex';
  }
});
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

function lockPointer() { renderer.domElement.requestPointerLock(); }
document.getElementById('startBtn').onclick = () => {
  audio.init();
  state.started = true;
  document.getElementById('startOverlay').style.display = 'none';
  lockPointer();
};
document.getElementById('resumeBtn').onclick = () => {
  state.paused = false;
  document.getElementById('pauseOverlay').style.display = 'none';
  lockPointer();
};

function toggleMenu(which) {
  state.menuOpen = which;
  ['foodOverlay', 'costumeOverlay'].forEach(id => document.getElementById(id).style.display = 'none');
  if (which === 'food') { document.getElementById('foodOverlay').style.display = 'flex'; renderFoodMenu(); }
  if (which === 'costume') { document.getElementById('costumeOverlay').style.display = 'flex'; renderCostumeMenu(); }
  if (which) document.exitPointerLock();
  else if (state.started && !state.paused) lockPointer();
}
document.getElementById('foodClose').onclick = () => toggleMenu(null);
document.getElementById('costumeClose').onclick = () => toggleMenu(null);

const FOOD_ITEMS = [
  { name: 'Ragno Burger', icon: '🍔', desc: '+40 vita', price: 6, hp: 40, st: 0 },
  { name: 'Trancio di Pizza', icon: '🍕', desc: '+25 vita, +20 energia', price: 4, hp: 25, st: 20 },
  { name: 'Patatine Super', icon: '🍟', desc: '+35 energia', price: 3, hp: 0, st: 35 },
  { name: 'Bevanda Energica', icon: '🥤', desc: '+15 energia', price: 2, hp: 0, st: 15 },
  { name: 'Menu Completo', icon: '🍽️', desc: 'Vita ed energia al massimo, +25% velocità per 60s', price: 12, hp: 100, st: 100, fast: true }
];
function renderFoodMenu() {
  const list = document.getElementById('foodList');
  list.innerHTML = '';
  document.getElementById('foodMoney').textContent = '€' + state.money;
  FOOD_ITEMS.forEach(it => {
    const div = document.createElement('div');
    div.className = 'menuitem';
    div.innerHTML = `<div><div class="name">${it.icon} ${it.name}</div><div class="desc">${it.desc}</div></div>`;
    const b = document.createElement('button');
    b.textContent = `€${it.price}`;
    b.disabled = state.money < it.price;
    b.onclick = () => {
      if (state.money < it.price) return;
      state.money -= it.price;
      state.hp = Math.min(100, state.hp + it.hp);
      state.stamina = Math.min(100, state.stamina + it.st);
      if (it.fast) state.fast = 60;
      audio.eat();
      toast('Hai mangiato: ' + it.name + '!');
      persist();
      toggleMenu(null);
    };
    div.appendChild(b);
    list.appendChild(div);
  });
}
function renderCostumeMenu() {
  const list = document.getElementById('costumeList');
  list.innerHTML = '';
  document.getElementById('costumeMoney').textContent = '€' + state.money;
  COSTUMES.forEach(c => {
    const owned = state.unlocked.includes(c.id);
    const active = state.costume === c.id;
    const div = document.createElement('div');
    div.className = 'menuitem' + (owned ? ' owned' : '');
    div.innerHTML = `<div><div class="name"><span class="costumeSwatch" style="background:#${c.torso.toString(16).padStart(6, '0')}"></span>${c.name}${active ? ' ✔' : ''}</div><div class="desc">${c.desc}</div></div>`;
    const b = document.createElement('button');
    if (owned) {
      b.textContent = active ? 'IN USO' : 'INDOSSA';
      b.disabled = active;
      b.onclick = () => { state.costume = c.id; buildPlayer(); persist(); renderCostumeMenu(); };
    } else {
      b.textContent = `Sblocca €${c.price}`;
      b.disabled = state.money < c.price;
      b.onclick = () => {
        if (state.money < c.price) return;
        state.money -= c.price;
        state.unlocked.push(c.id);
        state.costume = c.id;
        buildPlayer();
        persist();
        audio.collect();
        toast('Nuovo costume: ' + c.name + '!');
        renderCostumeMenu();
      };
    }
    div.appendChild(b);
    list.appendChild(div);
  });
}
function cycleCostume() {
  if (state.unlocked.length < 2) { toast('Hai solo il costume Classico: sbloccane altri con T!'); return; }
  const idx = state.unlocked.indexOf(state.costume);
  const next = state.unlocked[(idx + 1) % state.unlocked.length];
  state.costume = next;
  buildPlayer();
  persist();
  toast('Costume: ' + COSTUMES.find(c => c.id === next).name);
}

let toastTimer = null;
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.display = 'block';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.style.display = 'none'; }, 2600);
}
function setPrompt(html) {
  const p = document.getElementById('prompt');
  if (html) { p.innerHTML = html; p.style.display = 'block'; }
  else p.style.display = 'none';
}

function tryWeb() {
  if (webAttached) return;
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const ray = new THREE.Raycaster(camera.position.clone(), dir, 0, 120);
  const hits = ray.intersectObjects(rayTargets, false);
  let point = null;
  if (hits.length && hits[0].point.y > 4) point = hits[0].point.clone();
  if (!point) {
    const fwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    point = pos.clone().addScaledVector(fwd, 26);
    point.y = Math.max(pos.y + 18, 24);
  }
  webAnchor.copy(point);
  ropeLen = Math.max(6, pos.distanceTo(point) * 0.92);
  webAttached = true;
  rope.visible = true;
  if (grounded) vel.y = Math.max(vel.y, 6);
  audio.thwip();
}
function detachWeb() {
  if (!webAttached) return;
  webAttached = false;
  rope.visible = false;
  if (vel.length() > 10) {
    vel.multiplyScalar(1.06);
    vel.y += 2.5;
  }
}
function tryZip() {
  if (state.stamina < 12 || zipTime > 0) return;
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const ray = new THREE.Raycaster(camera.position.clone(), dir, 0, 70);
  const hits = ray.intersectObjects(rayTargets, false);
  const target = hits.length ? hits[0].point : pos.clone().addScaledVector(dir, 30).add(new THREE.Vector3(0, 8, 0));
  const pull = target.clone().sub(pos);
  const dist = pull.length();
  pull.normalize().multiplyScalar(Math.min(48, 14 + dist * 1.1));
  vel.copy(pull);
  vel.y = Math.max(vel.y, 8);
  zipTime = 0.35;
  state.stamina -= 12;
  audio.thwip();
}

function landOn(h) {
  if (!grounded && prevVy < -22) damage(Math.min(60, (-prevVy - 22) * 2.2), 'caduta');
  pos.y = h;
  vel.y = 0;
  grounded = true;
  jumps = 0;
  detachWeb();
}
function damage(n, src) {
  if (hurtCd > 0) return;
  state.hp -= n;
  hurtCd = 0.6;
  audio.hurt();
  if (state.hp <= 0) {
    state.hp = 100;
    state.money = Math.max(0, state.money - 20);
    pos.set(0, 0, 60);
    vel.set(0, 0, 0);
    toast('Sei svenuto! Ti hanno portato alla base (-€20)');
    persist();
  } else {
    toast('Danno (' + src + '): -' + Math.round(n) + ' vita');
  }
}
function collideBuildings() {
  const r = 0.45;
  for (const b of buildings) {
    if (pos.x < b.minX - r || pos.x > b.maxX + r || pos.z < b.minZ - r || pos.z > b.maxZ + r) continue;
    if (prevY >= b.h - 0.01) {
      if (pos.y < b.h) { pos.y = b.h; landOn(b.h); }
      continue;
    }
    if (pos.y >= b.h) continue;
    const penL = pos.x - (b.minX - r), penR = (b.maxX + r) - pos.x;
    const penB = pos.z - (b.minZ - r), penF = (b.maxZ + r) - pos.z;
    const m = Math.min(penL, penR, penB, penF);
    if (m === penL) { pos.x = b.minX - r; if (vel.x > 0) vel.x = 0; }
    else if (m === penR) { pos.x = b.maxX + r; if (vel.x < 0) vel.x = 0; }
    else if (m === penB) { pos.z = b.minZ - r; if (vel.z > 0) vel.z = 0; }
    else { pos.z = b.maxZ + r; if (vel.z < 0) vel.z = 0; }
    detachWeb();
  }
}

const spiderIconMat = new THREE.MeshStandardMaterial({ color: 0xff1744, emissive: 0xff1744, emissiveIntensity: 0.9 });
const beamMat = new THREE.MeshBasicMaterial({ color: 0xff1744, transparent: true, opacity: 0.18, depthWrite: false });
const MARKERS = [new THREE.Vector3(-266, 0, 38), new THREE.Vector3(38, 0, -266), new THREE.Vector3(266, 0, 190)];
const markers = MARKERS.map(p => {
  const grp = new THREE.Group();
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 60, 12, 1, true), beamMat);
  beam.position.y = 30;
  const icon = new THREE.Mesh(new THREE.OctahedronGeometry(0.9), spiderIconMat);
  icon.position.y = 2.6;
  icon.scale.set(1.3, 1, 0.5);
  grp.add(beam, icon);
  grp.position.copy(p);
  scene.add(grp);
  return { grp, icon, pos: p.clone() };
});

const goldMat = new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0xffa000, emissiveIntensity: 0.8, metalness: 0.7, roughness: 0.3 });
const pickups = [];
function spawnPickup(x, y, z) {
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55), goldMat);
  m.position.set(x, y, z);
  scene.add(m);
  pickups.push(m);
}
const checkpointBeamMat = new THREE.MeshBasicMaterial({ color: 0x40c4ff, transparent: true, opacity: 0.25, depthWrite: false });
const ringMat = new THREE.MeshStandardMaterial({ color: 0x40c4ff, emissive: 0x40c4ff, emissiveIntensity: 0.8 });
let checkpointMesh = null;
function showCheckpoint(p) {
  hideCheckpoint();
  const grp = new THREE.Group();
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 70, 12, 1, true), checkpointBeamMat);
  beam.position.y = 35;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.22, 8, 24), ringMat);
  ring.position.y = 2.4;
  ring.rotation.x = Math.PI / 2;
  grp.add(beam, ring);
  grp.position.copy(p);
  scene.add(grp);
  checkpointMesh = grp;
}
function hideCheckpoint() { if (checkpointMesh) { scene.remove(checkpointMesh); checkpointMesh = null; } }

const thugMat = new THREE.MeshStandardMaterial({ color: 0x37474f, roughness: 0.8 });
const thugHeadMat = new THREE.MeshStandardMaterial({ color: 0xd7a583 });
const cocoonMat = new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.9 });
const thugs = [];
function spawnThug(x, z) {
  const grp = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.75, 3, 8), thugMat);
  body.position.y = 1;
  body.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.23, 8, 6), thugHeadMat);
  head.position.y = 1.7;
  grp.add(body, head);
  grp.position.set(x, 0, z);
  scene.add(grp);
  thugs.push({ grp, wrapped: false });
}
function webThug(t) {
  t.wrapped = true;
  t.grp.clear();
  const cocoon = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 1.1, 4, 8), cocoonMat);
  cocoon.position.y = 1;
  cocoon.rotation.z = Math.PI / 2;
  cocoon.castShadow = true;
  t.grp.add(cocoon);
  audio.thwip();
}

let mission = null;
function randomStreetPoint() {
  return new THREE.Vector3(streetC(randi(0, CITY_N)) + rand(-5, 5), 0, streetC(randi(0, CITY_N)) + rand(-5, 5));
}
function startMission() {
  const types = ['checkpoints', 'collect', 'thugs', 'delivery'];
  const type = types[randi(0, 3)];
  if (type === 'checkpoints') {
    const pts = [];
    let last = pos.clone();
    for (let i = 0; i < 4; i++) {
      let p, tries = 0;
      do { p = randomStreetPoint(); tries++; } while (p.distanceTo(last) < 120 && tries < 20);
      pts.push(p); last = p;
    }
    mission = { type, title: 'Inseguimento', desc: 'Passa da tutti i cerchi blu!', time: 100, pts, idx: 0, reward: 120 };
    showCheckpoint(pts[0]);
  } else if (type === 'collect') {
    for (let i = 0; i < 6; i++) {
      const p = randomStreetPoint();
      spawnPickup(p.x, rand(12, 42), p.z);
    }
    mission = { type, title: "Raccolta Ragni d'Oro", desc: "Raccogli i ragni d'oro sospesi tra i palazzi!", time: 150, left: 6, reward: 140 };
  } else if (type === 'thugs') {
    const c = randomStreetPoint();
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      spawnThug(c.x + Math.cos(a) * rand(4, 9), c.z + Math.sin(a) * rand(4, 9));
    }
    mission = { type, title: 'Ferma i Criminali', desc: 'Avvicinati ai criminali e premi E per legarli!', time: 120, left: 4, reward: 160 };
  } else {
    const from = restaurants[randi(0, 2)];
    let to = randomStreetPoint();
    let tries = 0;
    while (to.distanceTo(new THREE.Vector3(from.x, 0, from.z)) < 150 && tries < 20) { to = randomStreetPoint(); tries++; }
    mission = { type, title: 'Consegna Urgente', desc: 'Ritira il pacco da ' + from.name + '!', time: 90, phase: 0, from, to, reward: 110 };
    showCheckpoint(new THREE.Vector3(from.x, 0, from.z));
  }
  toast('Missione iniziata: ' + mission.title);
}
function endMission(success) {
  if (success) {
    state.money += mission.reward;
    persist();
    audio.complete();
    toast('Missione completata! +€' + mission.reward);
  } else {
    audio.fail();
    toast('Missione fallita...');
  }
  pickups.forEach(p => scene.remove(p));
  pickups.length = 0;
  thugs.forEach(t => scene.remove(t.grp));
  thugs.length = 0;
  hideCheckpoint();
  mission = null;
  document.getElementById('missionTitle').textContent = '';
  document.getElementById('missionText').textContent = '';
  document.getElementById('missionTimer').textContent = '';
}
function updateMission(dt) {
  if (!mission) return;
  mission.time -= dt;
  if (mission.time <= 0) { endMission(false); return; }
  const pxz = new THREE.Vector3(pos.x, 0, pos.z);
  if (mission.type === 'checkpoints') {
    const tgt = mission.pts[mission.idx];
    if (pxz.distanceTo(new THREE.Vector3(tgt.x, 0, tgt.z)) < 5) {
      mission.idx++;
      audio.collect();
      if (mission.idx >= mission.pts.length) { endMission(true); return; }
      showCheckpoint(mission.pts[mission.idx]);
    }
  } else if (mission.type === 'collect') {
    for (let i = pickups.length - 1; i >= 0; i--) {
      if (pickups[i].position.distanceTo(pos) < 3.2) {
        scene.remove(pickups[i]);
        pickups.splice(i, 1);
        mission.left--;
        audio.collect();
        if (mission.left <= 0) { endMission(true); return; }
      }
    }
  } else if (mission.type === 'thugs') {
    mission.left = thugs.filter(t => !t.wrapped).length;
    if (mission.left <= 0) { endMission(true); return; }
  } else if (mission.type === 'delivery') {
    const tgt = mission.phase === 0 ? new THREE.Vector3(mission.from.x, 0, mission.from.z) : mission.to;
    if (pxz.distanceTo(tgt) < 5) {
      if (mission.phase === 0) {
        mission.phase = 1;
        mission.desc = 'Consegna il pacco al punto indicato!';
        audio.collect();
        showCheckpoint(mission.to);
      } else { endMission(true); return; }
    }
  }
  document.getElementById('missionTitle').textContent = mission.title;
  document.getElementById('missionText').textContent = mission.desc +
    (mission.type === 'checkpoints' ? ' (' + (mission.idx + 1) + '/' + mission.pts.length + ')' :
     mission.type === 'collect' ? ' (' + (6 - mission.left) + '/6)' :
     mission.type === 'thugs' ? ' (rimasti: ' + mission.left + ')' : '');
  document.getElementById('missionTimer').textContent = Math.ceil(mission.time) + 's';
}

function tryInteract() {
  if (mission) return;
  const pxz = new THREE.Vector3(pos.x, 0, pos.z);
  for (const m of markers) {
    if (pxz.distanceTo(new THREE.Vector3(m.pos.x, 0, m.pos.z)) < 5) { startMission(); return; }
  }
  for (const r of restaurants) {
    if (Math.hypot(pos.x - r.x, pos.z - r.z) < 6 && pos.y < 3) { toggleMenu('food'); return; }
  }
}

const mapBg = document.createElement('canvas');
mapBg.width = mapBg.height = 190;
{
  const g = mapBg.getContext('2d');
  const s = 190 / (HALF * 2);
  const W = v => (v + HALF) * s;
  g.fillStyle = '#1c1c22'; g.fillRect(0, 0, 190, 190);
  for (let i = 0; i < CITY_N; i++) for (let j = 0; j < CITY_N; j++) {
    g.fillStyle = isPark(i, j) ? '#2e7d32' : '#3d3d46';
    g.fillRect(W(blockMin(i)), W(blockMin(j)), BLOCK * s, BLOCK * s);
  }
  g.fillStyle = '#ef6c00';
  FOODS.forEach(f => g.fillRect(W(blockCenter(f.i) - 5), W(blockCenter(f.j) - 5), 10, 10));
}
const mapCtx = document.getElementById('minimap').getContext('2d');

let dayTime = 0.3;
function updateDayNight(dt) {
  dayTime = (dayTime + dt / 240) % 1;
  const sunAngle = dayTime * Math.PI * 2;
  const sunH = Math.sin(sunAngle);
  const day = clamp(sunH * 2 + 0.35, 0, 1);
  sun.position.set(pos.x + Math.cos(sunAngle) * 100, Math.max(8, sunH * 120), pos.z + 40);
  sun.target.position.copy(pos);
  sun.intensity = 0.15 + day * 1.5;
  hemi.intensity = 0.25 + day * 0.6;
  const skyDay = new THREE.Color(0x87b5e0), skyNight = new THREE.Color(0x0a0e1e), skyDusk = new THREE.Color(0xd98a5f);
  const sky = skyNight.clone().lerp(skyDay, day);
  if (sunH < 0.25 && sunH > -0.15) sky.lerp(skyDusk, 1 - Math.abs(sunH - 0.05) / 0.2);
  scene.background.copy(sky);
  scene.fog.color.copy(sky);
  const night = 1 - day;
  windowMats.forEach(m => { m.emissiveIntensity = 0.12 + night * 0.85; });
  bulbMat.emissiveIntensity = 0.1 + night * 1.6;
  document.getElementById('clock').textContent = sunH > 0.1 ? 'Giorno' : sunH > -0.1 ? 'Tramonto/Alba' : 'Notte';
}

let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!state.started) { renderer.render(scene, camera); return; }
  const active = !state.paused && !state.menuOpen;

  if (active) {
    hurtCd = Math.max(0, hurtCd - dt);
    zipTime = Math.max(0, zipTime - dt);
    state.fast = Math.max(0, state.fast - dt);

    const fwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const move = new THREE.Vector3();
    if (keys['KeyW']) move.add(fwd);
    if (keys['KeyS']) move.sub(fwd);
    if (keys['KeyD']) move.add(right);
    if (keys['KeyA']) move.sub(right);
    const moving = move.lengthSq() > 0;
    if (moving) move.normalize();
    const sprinting = (keys['ShiftLeft'] || keys['ShiftRight']) && moving && state.stamina > 1;
    const speed = (sprinting ? RUN : WALK) * (state.fast > 0 ? 1.25 : 1);
    if (sprinting) state.stamina = Math.max(0, state.stamina - 11 * dt);
    else state.stamina = Math.min(100, state.stamina + 14 * dt);
    state.hp = Math.min(100, state.hp + 1.2 * dt);

    if (grounded) {
      vel.x += (move.x * speed - vel.x) * Math.min(1, 12 * dt);
      vel.z += (move.z * speed - vel.z) * Math.min(1, 12 * dt);
    } else {
      vel.x += move.x * 16 * dt;
      vel.z += move.z * 16 * dt;
      const hs = Math.hypot(vel.x, vel.z);
      if (hs > MAX_SPEED) { vel.x *= MAX_SPEED / hs; vel.z *= MAX_SPEED / hs; }
    }

    if (keys['Space'] && !keys._spaceLatch) {
      keys._spaceLatch = true;
      if (grounded) { vel.y = JUMP_V; grounded = false; jumps = 1; audio.tone(300, 0.1, 'sine', 0.05, 200); }
      else if (jumps < 2) { vel.y = JUMP2_V; jumps = 2; audio.tone(350, 0.1, 'sine', 0.05, 250); }
    }
    if (!keys['Space']) keys._spaceLatch = false;

    if (webAttached) {
      if (keys['KeyW']) ropeLen = Math.max(6, ropeLen - 9 * dt);
      vel.y -= G * 0.85 * dt;
    } else if (zipTime > 0) {
      vel.y -= G * 0.15 * dt;
    } else {
      vel.y -= G * dt;
    }

    prevY = pos.y;
    prevVy = vel.y;
    pos.addScaledVector(vel, dt);

    if (pos.y <= 0) { pos.y = 0; landOn(0); }
    else grounded = false;
    collideBuildings();

    if (webAttached) {
      const d = pos.clone().sub(webAnchor);
      const dist = d.length();
      if (dist > ropeLen) {
        const n = d.clone().normalize();
        pos.copy(webAnchor).addScaledVector(n, ropeLen);
        const radial = vel.dot(n);
        if (radial > 0) vel.addScaledVector(n, -radial);
        vel.multiplyScalar(1 + 0.06 * dt);
      }
      if (pos.y < 1.2) detachWeb();
    }

    for (const car of cars) {
      const g = car.grp;
      if (car.axis === 'x') { g.position.x += car.dir * car.speed * dt; if (Math.abs(g.position.x) > HALF) g.position.x = -car.dir * HALF; }
      else { g.position.z += car.dir * car.speed * dt; if (Math.abs(g.position.z) > HALF) g.position.z = -car.dir * HALF; }
      if (hurtCd <= 0 && Math.abs(pos.y - 1) < 2 && Math.hypot(pos.x - g.position.x, pos.z - g.position.z) < 2.4) {
        const away = pos.clone().sub(g.position).setY(0).normalize();
        vel.copy(away.multiplyScalar(18));
        vel.y = 9;
        grounded = false;
        damage(14, "investito da un'auto");
      }
    }

    for (const p of peds) {
      p.t += p.speed * p.dir * dt * 6;
      const pp = pedPos(p);
      p.grp.position.set(pp.x, 0, pp.z);
      p.grp.rotation.y = pp.ry + (p.dir < 0 ? Math.PI : 0);
    }

    for (const t of thugs) {
      if (!t.wrapped) t.grp.rotation.y = Math.atan2(pos.x - t.grp.position.x, pos.z - t.grp.position.z);
    }

    markers.forEach(m => { m.icon.rotation.y += dt * 2; m.icon.position.y = 2.6 + Math.sin(now / 400) * 0.3; });
    pickups.forEach(p => { p.rotation.y += dt * 3; p.rotation.x += dt; });
    clouds.forEach(c => { c.position.x += dt * 1.5; if (c.position.x > HALF + 60) c.position.x = -HALF - 60; });

    updateMission(dt);

    let interact = null;
    if (!mission) {
      const pxz = new THREE.Vector3(pos.x, 0, pos.z);
      for (const m of markers) {
        if (pxz.distanceTo(new THREE.Vector3(m.pos.x, 0, m.pos.z)) < 5 && pos.y < 4) { interact = 'Premi <b>F</b> per iniziare una missione'; break; }
      }
      if (!interact) {
        for (const r of restaurants) {
          if (Math.hypot(pos.x - r.x, pos.z - r.z) < 6 && pos.y < 3) { interact = 'Premi <b>F</b> per mangiare da <b>' + r.name + '</b>'; break; }
        }
      }
    }
    if (!interact) {
      for (const t of thugs) {
        if (!t.wrapped && pos.distanceTo(t.grp.position) < 3.5) { interact = 'Premi <b>E</b> per legare il criminale'; break; }
      }
    }
    setPrompt(interact);

    const spd = Math.hypot(vel.x, vel.z);
    if (spd > 1.5 && (grounded || webAttached)) {
      player.rotation.y = lerpAngle(player.rotation.y, Math.atan2(vel.x, vel.z), Math.min(1, 10 * dt));
    }
    swingPhase += dt * (sprinting ? 13 : 9);
    if (webAttached) {
      parts.armR.rotation.x = -2.8; parts.armR.rotation.z = 0;
      parts.armL.rotation.x = 0.6 + Math.sin(swingPhase) * 0.2;
      parts.legL.rotation.x = 0.5 + Math.sin(swingPhase * 0.7) * 0.25;
      parts.legR.rotation.x = 0.2 - Math.sin(swingPhase * 0.7) * 0.25;
      player.rotation.x = 0.35;
      const hand = new THREE.Vector3();
      parts.handR.getWorldPosition(hand);
      const dir = webAnchor.clone().sub(hand);
      const len = dir.length();
      rope.position.copy(hand).addScaledVector(dir, 0.5);
      rope.scale.set(1, len, 1);
      rope.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    } else if (!grounded) {
      player.rotation.x = clamp(-vel.y * 0.012, -0.4, 0.5);
      parts.armL.rotation.x = -2.4; parts.armR.rotation.x = -2.4;
      parts.armL.rotation.z = 0.5; parts.armR.rotation.z = -0.5;
      parts.legL.rotation.x = 0.6; parts.legR.rotation.x = -0.3;
    } else if (spd > 0.8) {
      player.rotation.x = 0.12;
      const sw = Math.sin(swingPhase);
      parts.legL.rotation.x = sw * 0.85; parts.legR.rotation.x = -sw * 0.85;
      parts.armL.rotation.x = -sw * 0.7; parts.armR.rotation.x = sw * 0.7;
      parts.armL.rotation.z = 0; parts.armR.rotation.z = 0;
    } else {
      player.rotation.x = 0;
      const br = Math.sin(now / 700) * 0.06;
      parts.legL.rotation.x = parts.legR.rotation.x = 0;
      parts.armL.rotation.x = br; parts.armR.rotation.x = -br;
      parts.armL.rotation.z = 0.08; parts.armR.rotation.z = -0.08;
    }

    if (zipTime > 0) {
      const hand = new THREE.Vector3();
      parts.handR.getWorldPosition(hand);
      const target = pos.clone().addScaledVector(vel.clone().normalize(), 12);
      const dir = target.clone().sub(hand);
      const len = dir.length();
      rope2.position.copy(hand).addScaledVector(dir, 0.5);
      rope2.scale.set(1, len, 1);
      rope2.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
      rope2.visible = true;
    } else rope2.visible = false;

    updateDayNight(dt);
  }

  const camDist = 8.5;
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const camTarget = new THREE.Vector3(
    pos.x + Math.sin(yaw) * cp * camDist,
    pos.y + 2 + sp * camDist,
    pos.z + Math.cos(yaw) * cp * camDist
  );
  camTarget.y = Math.max(camTarget.y, 0.6);
  camera.position.lerp(camTarget, Math.min(1, 14 * dt));
  camera.lookAt(pos.x, pos.y + 1.6, pos.z);

  document.getElementById('hpFill').style.width = state.hp + '%';
  document.getElementById('stFill').style.width = state.stamina + '%';
  document.getElementById('money').textContent = '€ ' + state.money;

  let target = null;
  if (mission) {
    if (mission.type === 'checkpoints') target = mission.pts[mission.idx];
    else if (mission.type === 'delivery') target = mission.phase === 0 ? new THREE.Vector3(mission.from.x, 0, mission.from.z) : mission.to;
    else if (mission.type === 'thugs') { const u = thugs.find(t => !t.wrapped); if (u) target = u.grp.position; }
  } else {
    let bd = 1e9;
    markers.forEach(m => { const d = m.pos.distanceTo(pos); if (d < bd) { bd = d; target = m.pos; } });
  }
  const arrow = document.getElementById('arrow');
  if (target) {
    const a = Math.atan2(target.x - pos.x, target.z - pos.z) - (yaw + Math.PI);
    document.getElementById('arrowInner').style.transform = 'rotate(' + (-a * 180 / Math.PI) + 'deg)';
    arrow.style.display = 'block';
  } else arrow.style.display = 'none';

  const s = 190 / (HALF * 2);
  mapCtx.drawImage(mapBg, 0, 0);
  mapCtx.fillStyle = '#40c4ff';
  markers.forEach(m => { mapCtx.beginPath(); mapCtx.arc((m.pos.x + HALF) * s, (m.pos.z + HALF) * s, 3, 0, 7); mapCtx.fill(); });
  if (checkpointMesh) {
    mapCtx.fillStyle = '#ffd54f';
    mapCtx.beginPath();
    mapCtx.arc((checkpointMesh.position.x + HALF) * s, (checkpointMesh.position.z + HALF) * s, 4, 0, 7);
    mapCtx.fill();
  }
  mapCtx.fillStyle = '#ff1744';
  mapCtx.beginPath();
  mapCtx.arc((pos.x + HALF) * s, (pos.z + HALF) * s, 4, 0, 7);
  mapCtx.fill();

  renderer.render(scene, camera);
}
requestAnimationFrame(loop);
