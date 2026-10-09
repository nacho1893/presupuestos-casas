// Presupuestos Casas · visor 3D (three.js)
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const DATA = window.APP_DATA;
const LAT = -35.43;                          // Talca
const BASE = 0.30, T = 0.15;
const SILL = { win: [.9, 2.1], high: [1.5, 2.1], kit: [1.1, 2.1], door: [0, 2.05], tall: [.05, 2.9] };

/* ------------------------------------------------------------------ utilidades de textura */
function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) ^ Math.imul(s ^ (s >>> 13), 3266489909)) >>> 0) / 4294967296; }
function shade(hex, f) { const c = new THREE.Color(hex); c.multiplyScalar(f); return '#' + c.getHexString(); }
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function normalFromHeight(hc, strength) {
  const w = hc.width, h = hc.height, src = hc.getContext('2d').getImageData(0, 0, w, h).data;
  const out = canvas(w, h), ctx = out.getContext('2d'), img = ctx.createImageData(w, h), d = img.data;
  const H = (x, y) => src[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * strength, dy = (H(x, y + 1) - H(x, y - 1)) * strength;
    const nx = -dx, ny = dy, nz = 1, l = Math.hypot(nx, ny, nz), i = (y * w + x) * 4;
    d[i] = (nx / l * .5 + .5) * 255; d[i + 1] = (ny / l * .5 + .5) * 255; d[i + 2] = (nz / l * .5 + .5) * 255; d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0); return out;
}
function tex(c, srgb, rx, ry) {
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.repeat.set(rx || 1, ry || 1); return t;
}
function grainLines(g, x0, y0, w, h, hex, horiz, amount, R) {
  for (let k = 0; k < amount; k++) {
    g.strokeStyle = R() < .5 ? shade(hex, .82 + R() * .1) : shade(hex, 1.05 + R() * .08);
    g.globalAlpha = .18 + R() * .25; g.lineWidth = .5 + R() * 1.6; g.beginPath();
    if (horiz) { const yy = y0 + 2 + R() * (h - 4), ph = R() * 9; g.moveTo(x0, yy); for (let x = x0; x <= x0 + w; x += 16) g.lineTo(x, yy + Math.sin(x * .012 + ph) * 1.6 + Math.sin(x * .05 + ph) * .5); }
    else { const xx = x0 + 2 + R() * (w - 4), ph = R() * 9; g.moveTo(xx, y0); for (let y = y0; y <= y0 + h; y += 16) g.lineTo(xx + Math.sin(y * .012 + ph) * 1.6, y); }
    g.stroke();
  }
  // nudos
  for (let k = 0; k < (w * h) / 90000; k++) { const cx = x0 + R() * w, cy = y0 + R() * h; g.globalAlpha = .25; g.fillStyle = shade(hex, .6);
    g.beginPath(); g.ellipse(cx, cy, horiz ? 7 : 4, horiz ? 4 : 7, 0, 0, Math.PI * 2); g.fill(); }
  g.globalAlpha = 1;
}

/* Texturas de revestimiento: tamaño real del mosaico en metros, con mapa de normales y rugosidad */
const cladCache = new Map();
function cladTextures(key, hex) {
  const id = key + hex; if (cladCache.has(id)) return cladCache.get(id);
  const r = DATA.revest[key], R = rng(hex.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 7));
  const PX = 1024; let tw, th, n = 1;
  if (r.tex === 'board') { tw = 2.4; th = 2.4; }
  else if (r.tex === 'groove') { n = 5; tw = n * r.sp; th = 1.2; }
  else { n = Math.max(1, Math.round(1.2 / r.sp)); tw = 2.4; th = n * r.sp; }
  const cw = PX, ch = Math.round(PX * th / tw);
  const C = canvas(cw, ch), g = C.getContext('2d'), Hc = canvas(cw, ch), hg = Hc.getContext('2d'), Rc = canvas(cw, ch), rg = Rc.getContext('2d');
  g.fillStyle = hex; g.fillRect(0, 0, cw, ch); hg.fillStyle = '#808080'; hg.fillRect(0, 0, cw, ch);
  const baseRough = key === 'metal' ? 110 : key === 'pvc' ? 120 : 200;
  rg.fillStyle = `rgb(${baseRough},${baseRough},${baseRough})`; rg.fillRect(0, 0, cw, ch);
  if (r.tex === 'lap' || r.tex === 'panel') {
    const bh = ch / n;
    for (let i = 0; i < n; i++) {
      const y = i * bh;
      // tablas de largo variable con juntas verticales desfasadas (solo madera y fibrocemento)
      const segs = r.tex === 'lap' && key !== 'pvc' ? [0, .3 + R() * .5, 1] : [0, 1];
      for (let s = 0; s < segs.length - 1; s++) {
        const x0 = segs[s] * cw, x1 = segs[s + 1] * cw;
        g.fillStyle = shade(hex, .93 + R() * .12); g.fillRect(x0, y, x1 - x0, bh);
        if (r.grain) grainLines(g, x0, y, x1 - x0, bh, hex, true, (x1 - x0) * bh / (r.tex === 'panel' ? 900 : 500), R);
        if (s > 0) { g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x0 - 1, y, 2, bh); hg.fillStyle = '#303030'; hg.fillRect(x0 - 1, y, 3, bh); }
      }
      // cuña del traslapo: la tabla es más gruesa abajo
      const hgr = hg.createLinearGradient(0, y, 0, y + bh);
      hgr.addColorStop(0, '#3a3a3a'); hgr.addColorStop(.92, r.tex === 'lap' ? '#e8e8e8' : '#b0b0b0'); hgr.addColorStop(1, '#f2f2f2');
      hg.fillStyle = hgr; hg.fillRect(0, y, cw, bh);
      if (r.tex === 'panel') { hg.fillStyle = '#505050'; hg.fillRect(0, y + bh * .5 - 2, cw, 4); g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, y + bh * .5 - 1, cw, 2); }
      const sh = g.createLinearGradient(0, y, 0, y + bh * .2); sh.addColorStop(0, 'rgba(0,0,0,.42)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = sh; g.fillRect(0, y, cw, bh * .2);
      g.fillStyle = 'rgba(255,255,255,.10)'; g.fillRect(0, y + bh - 3, cw, 3);
    }
  } else if (r.tex === 'groove') {
    if (r.grain) grainLines(g, 0, 0, cw, ch, hex, false, cw * ch / 700, R);
    const gw = cw / n;
    for (let i = 0; i < n; i++) { const x = i * gw; g.fillStyle = 'rgba(0,0,0,.38)'; g.fillRect(x, 0, 6, ch); g.fillStyle = 'rgba(255,255,255,.1)'; g.fillRect(x + 6, 0, 3, ch);
      hg.fillStyle = '#202020'; hg.fillRect(x, 0, 7, ch); }
  } else {
    for (let k = 0; k < 9000; k++) { g.fillStyle = R() < .5 ? 'rgba(0,0,0,.04)' : 'rgba(255,255,255,.05)'; g.fillRect(R() * cw, R() * ch, 2, 2); }
    const pw = cw / 2;
    for (const x of [0, pw]) { g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(x, 0, 4, ch); hg.fillStyle = '#202020'; hg.fillRect(x, 0, 6, ch); }
    g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(0, 0, cw, 4); hg.fillStyle = '#202020'; hg.fillRect(0, 0, cw, 6);
    for (let k = 0; k < 400; k++) { const v = 115 + R() * 40; rg.fillStyle = `rgba(${v},${v},${v},.4)`; rg.fillRect(R() * cw, R() * ch, 8, 8); }
  }
  // variaciones de rugosidad
  for (let k = 0; k < 1500; k++) { const v = baseRough - 25 + R() * 50; rg.fillStyle = `rgba(${v},${v},${v},.25)`; rg.fillRect(R() * cw, R() * ch, 3 + R() * 12, 2 + R() * 4); }
  const out = { map: tex(C, true, 1 / tw, 1 / th), normalMap: tex(normalFromHeight(Hc, r.tex === 'lap' ? 6 : 3), false, 1 / tw, 1 / th), roughnessMap: tex(Rc, false, 1 / tw, 1 / th) };
  cladCache.set(id, out); return out;
}

function grassTextures() {
  const S = 512, R = rng(42), C = canvas(S, S), g = C.getContext('2d'), Hc = canvas(S, S), hg = Hc.getContext('2d');
  g.fillStyle = '#5f7a3a'; g.fillRect(0, 0, S, S); hg.fillStyle = '#707070'; hg.fillRect(0, 0, S, S);
  for (let k = 0; k < 220; k++) { const x = R() * S, y = R() * S, rr = 20 + R() * 60; const col = ['#6b8640', '#56722f', '#7a8f45', '#4f6a2c', '#82924c'][Math.floor(R() * 5)];
    const gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.globalAlpha = .45; g.fillStyle = gr; g.fillRect(x - rr, y - rr, rr * 2, rr * 2); }
  g.globalAlpha = 1;
  for (let k = 0; k < 26000; k++) { const x = R() * S, y = R() * S, l = 2 + R() * 5, a = -Math.PI / 2 + (R() - .5) * .9;
    g.strokeStyle = ['#7d9a4a', '#4c672a', '#8fa857', '#3f5a24', '#6d8a3e'][Math.floor(R() * 5)]; g.lineWidth = .8; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    const v = 90 + R() * 120; hg.fillStyle = `rgb(${v},${v},${v})`; hg.fillRect(x, y, 1.5, 1.5); }
  return { map: tex(C, true, 1, 1), normalMap: tex(normalFromHeight(Hc, 2), false, 1, 1) };
}
function gravelTextures() {
  const S = 512, R = rng(7), C = canvas(S, S), g = C.getContext('2d'), Hc = canvas(S, S), hg = Hc.getContext('2d');
  g.fillStyle = '#9a958c'; g.fillRect(0, 0, S, S); hg.fillStyle = '#404040'; hg.fillRect(0, 0, S, S);
  for (let k = 0; k < 5200; k++) { const x = R() * S, y = R() * S, rr = 2 + R() * 5; const v = 120 + R() * 90;
    g.fillStyle = `rgb(${v},${v - 4},${v - 10})`; g.beginPath(); g.ellipse(x, y, rr, rr * (.6 + R() * .4), R() * 3, 0, 7); g.fill();
    hg.fillStyle = `rgb(${150 + R() * 100},${150 + R() * 100},${150 + R() * 100})`; hg.beginPath(); hg.ellipse(x, y, rr, rr * .8, 0, 0, 7); hg.fill(); }
  return { map: tex(C, true, 1, 1), normalMap: tex(normalFromHeight(Hc, 3), false, 1, 1) };
}
function paverTextures() {
  const S = 512, R = rng(9), C = canvas(S, S), g = C.getContext('2d'), Hc = canvas(S, S), hg = Hc.getContext('2d');
  g.fillStyle = '#6d6a64'; g.fillRect(0, 0, S, S); hg.fillStyle = '#202020'; hg.fillRect(0, 0, S, S);
  const n = 4, s = S / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const v = 160 + R() * 30; g.fillStyle = `rgb(${v},${v - 3},${v - 8})`; g.fillRect(i * s + 4, j * s + 4, s - 8, s - 8);
    for (let k = 0; k < 300; k++) { g.fillStyle = `rgba(0,0,0,${R() * .06})`; g.fillRect(i * s + 4 + R() * (s - 8), j * s + 4 + R() * (s - 8), 2, 2); }
    hg.fillStyle = '#d0d0d0'; hg.fillRect(i * s + 6, j * s + 6, s - 12, s - 12); }
  return { map: tex(C, true, 1, 1), normalMap: tex(normalFromHeight(Hc, 4), false, 1, 1) };
}
function plankTextures(hex, n, seed) {
  const S = 1024, R = rng(seed || 3), C = canvas(S, S), g = C.getContext('2d'), Hc = canvas(S, S), hg = Hc.getContext('2d'), w = S / n;
  hg.fillStyle = '#c0c0c0'; hg.fillRect(0, 0, S, S);
  for (let i = 0; i < n; i++) {
    const cut = R() * S;
    for (const [y0, y1] of [[0, cut], [cut, S]]) { g.fillStyle = shade(hex, .88 + R() * .2); g.fillRect(i * w, y0, w, y1 - y0); grainLines(g, i * w, y0, w, y1 - y0, hex, false, w * (y1 - y0) / 1400, R); }
    g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(i * w, 0, 3, S); g.fillRect(i * w, cut, w, 2); hg.fillStyle = '#202020'; hg.fillRect(i * w, 0, 4, S); hg.fillRect(i * w, cut, w, 3);
  }
  return { map: tex(C, true, 1, 1), normalMap: tex(normalFromHeight(Hc, 3), false, 1, 1) };
}

/* ------------------------------------------------------------------ materiales */
function makeMaterials() {
  const grass = grassTextures(), gravel = gravelTextures(), paver = paverTextures();
  const deck = plankTextures('#9c7444', 8, 11), floor = plankTextures('#b48a5c', 10, 5);
  const M = {
    siding: new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, envMapIntensity: .55 }),
    trim: new THREE.MeshStandardMaterial({ color: '#efe9de', roughness: .55, envMapIntensity: .6 }),
    zinc: new THREE.MeshStandardMaterial({ color: '#b9c0c6', metalness: .92, roughness: .32, side: THREE.DoubleSide, envMapIntensity: 1.15 }),
    cap: new THREE.MeshStandardMaterial({ color: '#aeb5bb', metalness: .9, roughness: .38 }),
    glass: new THREE.MeshStandardMaterial({ color: '#1d2f3a', metalness: .15, roughness: .03, transparent: true, opacity: .62, envMapIntensity: 2.2, emissive: '#ffb45e', emissiveIntensity: 0 }),
    alu: new THREE.MeshStandardMaterial({ color: '#e4e6e7', metalness: .55, roughness: .38 }),
    door: new THREE.MeshStandardMaterial({ color: '#6a4426', roughness: .5, envMapIntensity: .5 }),
    brass: new THREE.MeshStandardMaterial({ color: '#c9a45c', metalness: 1, roughness: .25 }),
    gutter: new THREE.MeshStandardMaterial({ color: '#e8e8e4', roughness: .45, side: THREE.DoubleSide }),
    concrete: new THREE.MeshStandardMaterial({ color: '#9b9a96', roughness: .95 }),
    under: new THREE.MeshStandardMaterial({ color: '#1e1f1f', roughness: 1 }),
    beam: new THREE.MeshStandardMaterial({ color: '#7d6a50', roughness: .85 }),
    grass: new THREE.MeshStandardMaterial({ map: grass.map, normalMap: grass.normalMap, roughness: 1, envMapIntensity: .4 }),
    gravel: new THREE.MeshStandardMaterial({ map: gravel.map, normalMap: gravel.normalMap, roughness: 1 }),
    paver: new THREE.MeshStandardMaterial({ map: paver.map, normalMap: paver.normalMap, roughness: .9 }),
    deck: new THREE.MeshStandardMaterial({ map: deck.map, normalMap: deck.normalMap, roughness: .8, envMapIntensity: .4 }),
    floor: new THREE.MeshStandardMaterial({ map: floor.map, normalMap: floor.normalMap, roughness: .55 }),
    part: new THREE.MeshStandardMaterial({ color: '#efebe4', roughness: .92 }),
    white: new THREE.MeshStandardMaterial({ color: '#f2f1ee', roughness: .5 }),
    wood: new THREE.MeshStandardMaterial({ color: '#8a6240', roughness: .6 }),
    dark: new THREE.MeshStandardMaterial({ color: '#3a3f44', roughness: .45 }),
    fabric: new THREE.MeshStandardMaterial({ color: '#5f7482', roughness: .95 }),
    fence: new THREE.MeshStandardMaterial({ color: '#8c6f4e', roughness: .9 }),
    bark: new THREE.MeshStandardMaterial({ color: '#4e3c2c', roughness: 1 }),
    lamp: new THREE.MeshStandardMaterial({ color: '#fff2d6', emissive: '#ffcf86', emissiveIntensity: 0 }),
    hills: new THREE.MeshStandardMaterial({ color: '#7a8a77', roughness: 1, flatShading: true }),
    steel: new THREE.MeshStandardMaterial({ color: '#c7cbcf', metalness: 1, roughness: .28 }),
  };
  for (const k of ['grass', 'gravel', 'paver', 'deck', 'floor']) M[k].userData.world = true;
  return M;
}

/* ------------------------------------------------------------------ geometría auxiliar */
function offsetPolygon(pts, d) {        // polígono ortogonal CCW, d>0 hacia afuera
  const n = pts.length, lines = [];
  for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy), nx = dy / l, ny = -dx / l;
    lines.push([[a[0] + nx * d, a[1] + ny * d], [dx / l, dy / l]]); }
  const out = [];
  for (let i = 0; i < n; i++) { const [p1, d1] = lines[(i - 1 + n) % n], [p2, d2] = lines[i];
    const den = d1[0] * d2[1] - d1[1] * d2[0];
    if (Math.abs(den) < 1e-9) { out.push(p2); continue; }
    const t = ((p2[0] - p1[0]) * d2[1] - (p2[1] - p1[1]) * d2[0]) / den; out.push([p1[0] + d1[0] * t, p1[1] + d1[1] * t]); }
  return out;
}
function worldUV(geo, scale) {           // UV planas en metros (para pisos y terreno en el plano XZ)
  const p = geo.attributes.position, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) { uv[i * 2] = p.getX(i) / scale; uv[i * 2 + 1] = p.getZ(i) / scale; }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); return geo;
}

/* ------------------------------------------------------------------ visor */
export function createViewer(container, opts) {
  const coarse = matchMedia('(pointer: coarse)').matches;
  const state = { hour: 10.5, facade: 'norte', quality: coarse ? 'normal' : 'alta', roof: true, autorotate: false, dirty: true };
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, state.quality === 'alta' ? 2 : 1.25));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .62;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.prepend(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 16 / 10, .1, 3000);
  camera.position.set(12, 5, 16);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = .08; controls.maxPolarAngle = Math.PI / 2 - .04;
  controls.minDistance = 4; controls.maxDistance = 60; controls.target.set(0, 1.8, 0);
  controls.addEventListener('change', () => state.dirty = true);
  const M = makeMaterials();

  // cielo y luz
  const sky = new Sky(); sky.scale.setScalar(2000); scene.add(sky);
  const su = sky.material.uniforms; su.turbidity.value = 2; su.rayleigh.value = 2.6; su.mieCoefficient.value = .003; su.mieDirectionalG.value = .82;
  const skyScene = new THREE.Scene(); const sky2 = new Sky(); sky2.scale.setScalar(1000); skyScene.add(sky2);
  sky2.material.uniforms.turbidity.value = 2; sky2.material.uniforms.rayleigh.value = 2.6;
  sky2.material.uniforms.mieCoefficient.value = .004; sky2.material.uniforms.mieDirectionalG.value = .82;
  const pmrem = new THREE.PMREMGenerator(renderer); let envRT = null;
  const hemi = new THREE.HemisphereLight('#dfe9f3', '#5d6b45', .35); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff4e3', 3); sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096); sun.shadow.bias = -.0003; sun.shadow.normalBias = .03; sun.shadow.radius = 3;
  scene.add(sun, sun.target);
  scene.fog = new THREE.Fog('#c9d6df', 90, 700);

  // entorno fijo: terreno, cerros, árboles
  const env = new THREE.Group(); scene.add(env);
  const groundGeo = worldUV(new THREE.PlaneGeometry(800, 800, 220, 220).rotateX(-Math.PI / 2), 3.2);
  { const p = groundGeo.attributes.position, col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i);
      const n = .5 + .25 * Math.sin(x * .09 + Math.sin(z * .05) * 2) + .2 * Math.sin(z * .13 + x * .03) + .1 * Math.sin(x * .41 + z * .37);
      const dry = THREE.MathUtils.clamp(n, 0, 1); col[i * 3] = .9 + .25 * dry; col[i * 3 + 1] = .95 + .08 * dry; col[i * 3 + 2] = .82 + .05 * dry; }
    groundGeo.setAttribute('color', new THREE.BufferAttribute(col, 3)); }
  M.grass.vertexColors = true;
  const ground = new THREE.Mesh(groundGeo, M.grass);
  ground.receiveShadow = true; env.add(ground);
  {
    const R = rng(5), geo = new THREE.CylinderGeometry(330, 330, 1, 160, 1, true), pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) if (pos.getY(i) > 0) { const a = Math.atan2(pos.getZ(i), pos.getX(i));
      const hgt = 18 + 26 * Math.abs(Math.sin(a * 3.1 + 1)) + 14 * Math.sin(a * 7.3) + 8 * Math.sin(a * 17) + R() * 6 + (Math.cos(a + 1.4) > .3 ? 40 * (Math.cos(a + 1.4) - .3) : 0);
      pos.setY(i, Math.max(6, hgt)); } else pos.setY(i, -2);
    geo.computeVertexNormals(); const hills = new THREE.Mesh(geo, M.hills); hills.material.side = THREE.BackSide; env.add(hills);
  }
  const lot = new THREE.Group(); scene.add(lot);   // cerco, sendero y árboles (depende del modelo)

  // postproceso
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const gtao = new GTAOPass(scene, camera, 800, 500);
  gtao.updateGtaoMaterial({ radius: .55, distanceExponent: 1.4, thickness: 1.2, scale: 1.1, samples: 16 });
  gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
  gtao.blendIntensity = .9;
  composer.addPass(gtao); composer.addPass(new OutputPass());

  let house = null, roof = null, cur = null, dims = { W: 10, D: 8, H: 4.5 }, glowMats = [];
  const disposeGroup = g => g && g.traverse(o => { if (o.isMesh || o.isInstancedMesh) o.geometry.dispose(); });

  /* ---------------- sol */
  function sunDir() {
    const now = new Date(), doy = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 864e5);
    const dec = THREE.MathUtils.degToRad(-23.44 * Math.cos(2 * Math.PI / 365 * (doy + 10)));
    const lat = THREE.MathUtils.degToRad(LAT), H = THREE.MathUtils.degToRad((state.hour - 13.3) * 15); // hora oficial ≈ solar + 1,3 h
    const el = Math.asin(Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(H));
    let az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(lat) - Math.tan(dec) * Math.cos(lat)) + Math.PI; // desde el norte, hacia el este
    const Af = { sur: 180, norte: 0, oriente: 90, poniente: 270 }[state.facade];
    const a = az - THREE.MathUtils.degToRad(Af) + Math.PI;
    return { v: new THREE.Vector3(Math.sin(a) * Math.cos(el), Math.sin(el), -Math.cos(a) * Math.cos(el)), el };
  }
  let envTimer = null;
  function updateSun(rebuildEnv = true) {
    const { v, el } = sunDir();
    su.sunPosition.value.copy(v); sky2.material.uniforms.sunPosition.value.copy(v);
    const day = THREE.MathUtils.clamp(el / .35, 0, 1), low = 1 - THREE.MathUtils.clamp(el / .5, 0, 1);
    sun.intensity = 3.2 * THREE.MathUtils.smoothstep(el, -.02, .12);
    sun.color.setRGB(1, .86 + .14 * (1 - low), .7 + .3 * (1 - low));
    hemi.intensity = .12 + .3 * day;
    renderer.toneMappingExposure = .38 + .3 * day + (el < .05 ? .25 : 0);
    const dist = 60; sun.position.copy(v).multiplyScalar(dist).add(sun.target.position);
    scene.fog.color.setRGB(.5 + .2 * day + .12 * low * day, .56 + .22 * day, .62 + .24 * day);
    const night = 1 - THREE.MathUtils.smoothstep(el, -.04, .08);
    M.glass.emissiveIntensity = .9 * night; M.lamp.emissiveIntensity = 4 * night;
    M.hills.color.setRGB(.45 + .1 * day, .52 + .1 * day, .5 + .1 * day);
    if (rebuildEnv) { clearTimeout(envTimer); envTimer = setTimeout(() => { const rt = pmrem.fromScene(skyScene, 0, .1, 1000); envRT?.dispose(); envRT = rt; scene.environment = rt.texture; state.dirty = true; }, 60); }
    state.dirty = true;
  }

  /* ---------------- casa */
  function buildWindow(g, o, depth) {
    const w = o.b - o.a, hgt = o.h - o.s, cx = (o.a + o.b) / 2, cy = (o.s + o.h) / 2, f = .05, z = depth;
    const add = (m, x, y, zz) => { m.position.set(x, y, zz); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
    const B = (a, b, c, mat) => new THREE.Mesh(new THREE.BoxGeometry(a, b, c), mat);
    if (o.k === 'door') {
      add(B(w - .02, hgt - .01, .045, M.door), cx, cy, depth * .55);
      for (const [py, ph] of [[o.s + .35, .65], [o.s + 1.15, .75]]) add(B(w - .26, ph, .02, M.door), cx, py + ph / 2, depth * .55 + .03);
      add(new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, .14, 10), M.brass), o.b - .12, 1.02, depth * .55 + .06).rotation.z = Math.PI / 2;
      add(B(.08, .03, .03, M.brass), o.b - .14, 1.02, depth * .55 + .045);
      // lámpara exterior
      add(B(.12, .18, .1, M.dark), o.b + .32, 2.05, depth + .05); add(B(.08, .12, .02, M.lamp), o.b + .32, 2.03, depth + .11);
    } else {
      const panes = w > .75 ? 2 : 1, pw = w / panes;
      for (let i = 0; i < panes; i++) {
        const x0 = o.a + i * pw, zz = depth * .45 + (i % 2 ? .025 : -.01);
        const gl = add(B(pw - .04, hgt - .06, .006, M.glass), x0 + pw / 2, cy, zz); gl.castShadow = false;
        add(B(pw, .045, .05, M.alu), x0 + pw / 2, o.h - .0225, zz); add(B(pw, .045, .05, M.alu), x0 + pw / 2, o.s + .0225, zz);
        add(B(.045, hgt, .05, M.alu), x0 + .0225, cy, zz); add(B(.045, hgt, .05, M.alu), x0 + pw - .0225, cy, zz);
      }
      if (o.k !== 'tall') { const sill = add(B(w + .14, .035, .1, M.trim), cx, o.s - .02, z + .03); sill.rotation.x = -.08; }
      // cortina interior (da profundidad)
      add(B(w * .45, hgt * .9, .01, M.part), o.a + w * .23, cy, .02);
    }
    add(B(w + 2 * f + .04, .07, .045, M.trim), cx, o.h + .035, z + .02);
    for (const x of [o.a - f / 2 - .01, o.b + f / 2 + .01]) add(B(f + .02, hgt + .07, .045, M.trim), x, cy + .035, z + .02);
  }

  function corrugatedFace(pts, sd, V) {
    const P = pts.map(p => new THREE.Vector3(...p));
    const U = new THREE.Vector3(sd[0], sd[1], 0).normalize();
    const N = new THREE.Vector3().subVectors(P[1], P[0]).cross(new THREE.Vector3().subVectors(P[2], P[0])).normalize();
    if (N.z < 0) N.negate();
    const Vv = new THREE.Vector3().crossVectors(N, U).normalize();
    const O = P[0], loc = P.map(p => { const d = p.clone().sub(O); return [d.dot(U), d.dot(Vv)]; });
    const umin = Math.min(...loc.map(l => l[0])), umax = Math.max(...loc.map(l => l[0]));
    const pitch = .076, amp = .009, step = pitch / 8, n = Math.ceil((umax - umin) / step);
    const pos = [], idx = [], uv = [];
    for (let i = 0; i <= n; i++) {
      const u = Math.min(umax, umin + i * step), vs = [];
      for (let k = 0; k < loc.length; k++) { const a = loc[k], b = loc[(k + 1) % loc.length];
        if ((u >= Math.min(a[0], b[0]) - 1e-9) && (u <= Math.max(a[0], b[0]) + 1e-9)) {
          if (Math.abs(b[0] - a[0]) < 1e-9) { vs.push(a[1], b[1]); } else vs.push(a[1] + (b[1] - a[1]) * (u - a[0]) / (b[0] - a[0])); } }
      const v0 = Math.min(...vs), v1 = Math.max(...vs), off = amp * Math.sin(2 * Math.PI * (u - umin) / pitch);
      for (const vv of [v0, v1]) { const p = O.clone().addScaledVector(U, u).addScaledVector(Vv, vv).addScaledVector(N, off); const s = V(p.x, p.y, p.z + .06); pos.push(s.x, s.y, s.z); uv.push(u, vv); }
      if (i < n) { const a = 2 * i; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, M.zinc); m.castShadow = true; m.receiveShadow = true; return m;
  }

  function buildModel(mod) {
    const G = mod.g3, [x0, y0, x1, y1] = G.bbox, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const V = (x, y, z) => new THREE.Vector3(x - cx, z, cy - y);
    const grp = new THREE.Group(), rf = new THREE.Group();
    const B = (a, b, c, mat) => new THREE.Mesh(new THREE.BoxGeometry(Math.max(.005, a), Math.max(.005, b), Math.max(.005, c)), mat);
    const wall = (w, mat, th, withWin) => {
      const g = new THREE.Group(); const [dx, dy] = w.d, nx = dy, ny = -dx;
      g.position.copy(V(w.o[0] - nx * th, w.o[1] - ny * th, w.o[2])); g.rotation.y = Math.atan2(dy, dx);
      const shape = new THREE.Shape(w.pts.map(p => new THREE.Vector2(p[0], p[1])));
      for (const hl of w.holes) { const p = new THREE.Path(); p.moveTo(hl.a, hl.s); p.lineTo(hl.b, hl.s); p.lineTo(hl.b, hl.h); p.lineTo(hl.a, hl.h); p.lineTo(hl.a, hl.s); shape.holes.push(p); }
      const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: th, bevelEnabled: false }), mat);
      mesh.castShadow = true; mesh.receiveShadow = true; g.add(mesh);
      if (withWin) for (const hl of w.holes) buildWindow(g, hl, th);
      return g;
    };
    for (const w of G.walls) grp.add(wall(w, M.siding, T, true));
    for (const w of G.parts) grp.add(wall(w, M.part, .1, false));
    for (const [x, y, hh] of G.corners) { const c = B(.1, hh, .1, M.trim); c.position.copy(V(x, y, G.base + hh / 2)); c.castShadow = true; grp.add(c); }
    // fundación: viga perimetral, poyos y sombra bajo el piso
    const toShape = pts => new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x - cx, -(cy - y))));
    const inner = new THREE.Mesh(new THREE.ExtrudeGeometry(toShape(G.floors[0].pts), { depth: G.base - .14, bevelEnabled: false }), M.under);
    inner.rotation.x = -Math.PI / 2; grp.add(inner);
    const O = G.outline;
    for (let i = 0; i < O.length; i++) {
      const a = O[i], b = O[(i + 1) % O.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]), dx = (b[0] - a[0]) / L, dy = (b[1] - a[1]) / L;
      const bm = B(L + .02, .16, .05, M.beam); bm.position.copy(V((a[0] + b[0]) / 2 + dy * .005, (a[1] + b[1]) / 2 - dx * .005, G.base - .08)); bm.rotation.y = Math.atan2(dy, dx); bm.castShadow = true; grp.add(bm);
      const np = Math.max(2, Math.round(L / 1.5) + 1);
      for (let k = 0; k < np; k++) { const t = .15 + (L - .3) * k / (np - 1), px = a[0] + dx * t - dy * .12, py = a[1] + dy * t + dx * .12;
        const pz = B(.3, G.base - .12, .3, M.concrete); pz.position.copy(V(px, py, (G.base - .12) / 2)); pz.castShadow = true; pz.receiveShadow = true; grp.add(pz); }
    }
    for (const f of G.floors) { const fl = new THREE.Mesh(worldUV(new THREE.ShapeGeometry(toShape(f.pts)).rotateX(-Math.PI / 2), 2.4), M.floor); fl.position.y = f.z; fl.receiveShadow = true; grp.add(fl); }
    const MAT = { white: M.white, wood: M.wood, dark: M.dark, fabric: M.fabric, deck: M.deck, trim: M.trim }, upper = [];
    for (const b of G.boxes) {
      if (b[0] === 'slab') {
        const s3 = toShape(b[1]);
        for (const [a, bb, c, d] of b[3]) { const hp = new THREE.Path(); hp.moveTo(a - cx, -(cy - bb)); hp.lineTo(c - cx, -(cy - bb)); hp.lineTo(c - cx, -(cy - d)); hp.lineTo(a - cx, -(cy - d)); hp.lineTo(a - cx, -(cy - bb)); s3.holes.push(hp); }
        const sl = new THREE.Mesh(worldUV(new THREE.ExtrudeGeometry(s3, { depth: .25, bevelEnabled: false }).rotateX(-Math.PI / 2), 2.4), M.floor); sl.position.y = b[2] - .25; sl.receiveShadow = true; grp.add(sl); continue;
      }
      const [a, bb, z1, c, d, z2, mk] = b;
      if (z1 > 2) { upper.push(b); continue; }
      if (mk === 'deck' && z2 - z1 < .2) {        // terraza: tablas con textura
        const geo = worldUV(new THREE.BoxGeometry(c - a, z2 - z1, d - bb), 1.3);
        const m = new THREE.Mesh(geo, M.deck); m.position.copy(V((a + c) / 2, (bb + d) / 2, (z1 + z2) / 2)); m.receiveShadow = true; m.castShadow = true; grp.add(m); continue;
      }
      const m = B(c - a, z2 - z1, d - bb, MAT[mk] || M.white); m.position.copy(V((a + c) / 2, (bb + d) / 2, (z1 + z2) / 2)); m.castShadow = true; m.receiveShadow = true; grp.add(m);
    }
    // techo de zinc ondulado
    for (const f of G.roof) rf.add(corrugatedFace(f.p, f.sd, V));
    rf.updateMatrixWorld(true);
    for (const [a, bb, z1, c, d, z2, mk] of upper) {
      let top = z2;
      for (const [px, py] of [[a, bb], [c, bb], [a, d], [c, d], [(a + c) / 2, (bb + d) / 2]]) {
        const o = V(px, py, z1 + .05), hit = new THREE.Raycaster(o, new THREE.Vector3(0, 1, 0), 0, 10).intersectObjects(rf.children, false)[0];
        if (hit) top = Math.min(top, z1 + hit.distance - .02);
      }
      if (top - z1 < .05) continue;
      const m = B(c - a, top - z1, d - bb, MAT[mk] || M.white); m.position.copy(V((a + c) / 2, (bb + d) / 2, (z1 + top) / 2)); grp.add(m);
    }
    const seg = (a, b, w, hh, mat, dz = 0) => { const A = V(a[0], a[1], a[2] + dz), Bv = V(b[0], b[1], b[2] + dz); const m = B(w, hh, A.distanceTo(Bv), mat); m.position.copy(A).add(Bv).multiplyScalar(.5); m.lookAt(Bv); m.castShadow = true; return m; };
    for (const [a, b] of G.trims) rf.add(seg(a, b, .035, .19, M.trim, -.06));
    for (const [a, b] of G.caps) { const m = seg(a, b, .34, .03, M.cap, .095); rf.add(m); }
    // canaletas y bajadas en aleros bajos
    const zmax = Math.max(...G.roof.flatMap(f => f.p.map(p => p[2]))), zEave = G.base + Math.max(...G.corners.map(c => c[2])) + .25;
    const ctr = [cx, cy], outlinePts = G.outline;
    const nearestOnOutline = (x, y) => { let best = null, bd = 1e9;
      for (let i = 0; i < outlinePts.length; i++) { const a = outlinePts[i], b = outlinePts[(i + 1) % outlinePts.length], dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
        const t = THREE.MathUtils.clamp(((x - a[0]) * dx + (y - a[1]) * dy) / l2, 0, 1), px = a[0] + dx * t, py = a[1] + dy * t, d = Math.hypot(px - x, py - y); if (d < bd) { bd = d; best = [px, py]; } }
      return best; };
    for (const [a, b] of G.trims) {
      if (Math.abs(a[2] - b[2]) > .01 || a[2] > zmax - .4 || a[2] > zEave) continue;
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2; let ox = mx - ctr[0], oy = my - ctr[1];
      const ex = b[0] - a[0], ey = b[1] - a[1], el = Math.hypot(ex, ey), nx = ey / el, ny = -ex / el, s = Math.sign(nx * ox + ny * oy) || 1;
      const off = .07 * s, A = [a[0] + nx * off, a[1] + ny * off, a[2] - .1], Bp = [b[0] + nx * off, b[1] + ny * off, b[2] - .1];
      const P1 = V(...A), P2 = V(...Bp), len = P1.distanceTo(P2);
      const gut = new THREE.Mesh(new THREE.CylinderGeometry(.065, .065, len, 18, 1, true, Math.PI / 2, Math.PI), M.gutter);
      gut.position.copy(P1).add(P2).multiplyScalar(.5); gut.lookAt(P2); gut.rotateX(Math.PI / 2); gut.castShadow = true; rf.add(gut);
      for (const E of [A, Bp]) {
        const w = nearestOnOutline(E[0], E[1]); if (!w) continue;
        const dx = E[0] - w[0], dy = E[1] - w[1], dl = Math.max(1e-6, Math.hypot(dx, dy));
        const wx = w[0] + dx / dl * .07, wy = w[1] + dy / dl * .07;
        const p1 = V(E[0], E[1], E[2] - .04), p2 = V(wx, wy, E[2] - .5);
        const pipe = (pa, pb) => { const l = pa.distanceTo(pb); const c = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, l, 12), M.gutter); c.position.copy(pa).add(pb).multiplyScalar(.5); c.lookAt(pb); c.rotateX(Math.PI / 2); c.castShadow = true; rf.add(c); };
        pipe(p1, p2); pipe(p2, new THREE.Vector3(p2.x, .12, p2.z));
      }
    }
    for (const o of [grp, rf]) o.traverse(m => { if (m.isMesh && m.material !== M.glass) { m.castShadow = true; m.receiveShadow = true; } });
    return { grp, rf, W: x1 - x0, D: y1 - y0, H: G.extra_h, V, cx, cy, mod };
  }

  function chimney(b) {     // cañón de estufa a leña sobre el living
    const rooms = b.mod.rooms.flat(); const lv = rooms.find(r => /LIVING/.test(r[0])); if (!lv) return;
    const P = b.V(lv[1] / 1000, lv[2] / 1000 + .4, 0);
    const ray = new THREE.Raycaster(new THREE.Vector3(P.x, 30, P.z), new THREE.Vector3(0, -1, 0));
    const hit = ray.intersectObjects(b.rf.children, false)[0]; if (!hit) return;
    const y = hit.point.y, pipe = new THREE.Mesh(new THREE.CylinderGeometry(.075, .075, 1.5, 20), M.steel);
    pipe.position.set(P.x, y + .55, P.z); pipe.castShadow = true; b.rf.add(pipe);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(.2, .16, 20), M.steel); cap.position.set(P.x, y + 1.42, P.z); cap.castShadow = true; b.rf.add(cap);
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(.16, .2, .08, 20), M.steel); ring.position.set(P.x, y + .02, P.z); b.rf.add(ring);
  }

  function buildLot(b) {
    disposeGroup(lot); lot.clear();
    const G = b.mod.g3, R = rng(b.mod.id.charCodeAt(1) * 97 + 3);
    const toV = (x, y) => b.V(x, y, 0);
    // franja de gravilla alrededor de la casa
    const ring = offsetPolygon(G.outline, .65);
    const sh = new THREE.Shape(ring.map(([x, y]) => new THREE.Vector2(x - b.cx, -(b.cy - y))));
    const hole = new THREE.Path(G.outline.map(([x, y]) => new THREE.Vector2(x - b.cx, -(b.cy - y)))); sh.holes.push(hole);
    const gm = new THREE.Mesh(worldUV(new THREE.ShapeGeometry(sh).rotateX(-Math.PI / 2), 1.2), M.gravel); gm.position.y = .012; gm.receiveShadow = true; lot.add(gm);
    // sendero de baldosas desde la puerta principal
    const doors = G.walls.flatMap(w => w.holes.filter(h => h.k === 'door' && w.d[1] === 0 && w.d[0] === 1).map(h => ({ x: w.o[0] + h.a, x2: w.o[0] + h.b, y: w.o[1] })));
    const fd = doors.sort((p, q) => p.y - q.y)[0];
    const front = G.bbox[1] - (b.mod.datos.AC ? 2 : 0);
    if (fd) {
      const xm = (fd.x + fd.x2) / 2, ys = Math.min(front, fd.y) - (b.mod.datos.AC ? .2 : 1.9), ye = G.bbox[1] - 9;
      for (let y = ys; y > ye; y -= .62) {
        const p = new THREE.Mesh(worldUV(new THREE.BoxGeometry(1.1, .04, .5), .5), M.paver); p.position.copy(toV(xm + (R() - .5) * .04, y)); p.position.y = .02; p.receiveShadow = true; lot.add(p);
      }
    }
    // cerco de madera
    const bx = [G.bbox[0] - 5, G.bbox[1] - 9, G.bbox[2] + 5, G.bbox[3] + 6];
    const pickets = [], posts = [];
    const runs = [[[bx[0], bx[1]], [bx[2], bx[1]]], [[bx[2], bx[1]], [bx[2], bx[3]]], [[bx[2], bx[3]], [bx[0], bx[3]]], [[bx[0], bx[3]], [bx[0], bx[1]]]];
    const gate = fd ? (fd.x + fd.x2) / 2 : null;
    for (const [a, c] of runs) {
      const L = Math.hypot(c[0] - a[0], c[1] - a[1]), dx = (c[0] - a[0]) / L, dy = (c[1] - a[1]) / L;
      for (let t = 0; t <= L; t += .16) { const x = a[0] + dx * t, y = a[1] + dy * t; if (gate !== null && a[1] === bx[1] && c[1] === bx[1] && Math.abs(x - gate) < .7) continue; pickets.push([x, y, Math.atan2(dy, dx)]); }
      for (let t = 0; t <= L + .01; t += 2.4) posts.push([a[0] + dx * t, a[1] + dy * t]);
      const pieces = (gate !== null && a[1] === bx[1] && c[1] === bx[1]) ? [[a[0], gate - .7], [gate + .7, c[0]]] : null;
      const railsOf = pieces ? pieces.map(([u, v]) => [[u, a[1]], [v, a[1]]]) : [[a, c]];
      for (const [ra, rc] of railsOf) { const RL = Math.hypot(rc[0] - ra[0], rc[1] - ra[1]); if (RL < .1) continue;
        for (const z of [.35, 1.05]) { const r = B2(RL, .06, .03, M.fence); r.position.copy(toV((ra[0] + rc[0]) / 2, (ra[1] + rc[1]) / 2)); r.position.y = z; r.rotation.y = Math.atan2(dy, dx); r.castShadow = true; lot.add(r); } }
    }
    const pk = new THREE.InstancedMesh(new THREE.BoxGeometry(.1, 1.25, .02), M.fence, pickets.length), mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1);
    pickets.forEach(([x, y, a], i) => { const p = toV(x, y); p.y = .62 + (R() - .5) * .02; q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), a); mtx.compose(p, q, s); pk.setMatrixAt(i, mtx); });
    pk.castShadow = true; pk.receiveShadow = true; lot.add(pk);
    for (const [x, y] of posts) { const p = B2(.1, 1.45, .1, M.fence); p.position.copy(toV(x, y)); p.position.y = .72; p.castShadow = true; lot.add(p); }
    // árboles y arbustos
    const leafCols = ['#41602c', '#4b6b33', '#3a5628', '#55733a', '#344d25'];
    const foliage = (r, col, seed) => {
      let geo = new THREE.IcosahedronGeometry(r, 3); geo.deleteAttribute('normal'); geo.deleteAttribute('uv'); geo = mergeVertices(geo);
      const p = geo.attributes.position, Rr = rng(seed), o1 = Rr() * 9, o2 = Rr() * 9, o3 = Rr() * 9;
      for (let i = 0; i < p.count; i++) { const v = new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i)), n = v.clone().normalize();
        const k = 1 + .16 * Math.sin(n.x * 5 + o1) * Math.sin(n.y * 6 + o2) + .08 * Math.sin(n.z * 11 + o1) + .05 * Math.sin(n.x * 23 + n.y * 19 + o3); v.multiplyScalar(k); p.setXYZ(i, v.x, v.y, v.z); }
      geo.computeVertexNormals();
      return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: col, roughness: .95, envMapIntensity: .5 }));
    };
    const spots = [[bx[0] + 1.6, bx[3] - 1.8, 1.25], [bx[2] - 1.8, bx[3] - 2.2, 1.05], [bx[0] + 1.4, bx[1] + 2.6, .8],
      [bx[0] - 9, bx[3] + 4, 1.5], [bx[2] + 9, bx[3] + 3, 1.35], [bx[2] + 16, bx[1] - 9, 1.6], [bx[0] - 13, bx[1] - 4, 1.3], [bx[0] - 4, bx[3] + 14, 1.7],
      [bx[2] + 3, bx[3] + 16, 1.5], [bx[0] - 22, bx[3] + 8, 1.8], [bx[2] + 24, bx[3] + 10, 1.6], [bx[0] - 18, bx[1] + 6, 1.4]];
    spots.forEach(([x, y, k], i) => {
      const t = new THREE.Group(); const p = toV(x, y); t.position.set(p.x, 0, p.z); t.rotation.y = R() * 6;
      if (i % 3 === 1) {          // conífera
        const tr = new THREE.Mesh(new THREE.CylinderGeometry(.08 * k, .17 * k, 5.5 * k, 8), M.bark); tr.position.y = 2.75 * k; t.add(tr);
        for (let j = 0; j < 7; j++) { const geo = new THREE.ConeGeometry((1.7 - j * .22) * k, 1.5 * k, 14, 3), pp = geo.attributes.position;
          for (let q = 0; q < pp.count; q++) { if (pp.getY(q) < .7 * k) { const a = Math.atan2(pp.getZ(q), pp.getX(q)), f = 1 + .18 * Math.sin(a * 7 + j) + .08 * (R() - .5); pp.setX(q, pp.getX(q) * f); pp.setZ(q, pp.getZ(q) * f); pp.setY(q, pp.getY(q) - .15 * k * Math.abs(Math.sin(a * 7 + j))); } }
          geo.computeVertexNormals(); const c = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: ['#2f4a2a', '#34512d', '#2a4326'][j % 3], roughness: 1 })); c.position.y = (1.4 + j * .72) * k; t.add(c); }
      } else {
        const tr = new THREE.Mesh(new THREE.CylinderGeometry(.1 * k, .2 * k, 2.6 * k, 9), M.bark); tr.position.y = 1.3 * k; t.add(tr);
        for (const a of [0, 2.1, 4.2]) { const br = new THREE.Mesh(new THREE.CylinderGeometry(.04 * k, .07 * k, 1.3 * k, 6), M.bark); br.position.set(Math.cos(a) * .35 * k, 2.6 * k, Math.sin(a) * .35 * k); br.rotation.set(Math.sin(a) * .6, 0, -Math.cos(a) * .6); t.add(br); }
        const nb = 6 + Math.floor(R() * 4);
        for (let j = 0; j < nb; j++) { const r = (.75 + R() * .6) * k; const c = foliage(r, leafCols[Math.floor(R() * leafCols.length)], i * 31 + j);
          const a = R() * 6.28, d = (j === 0 ? 0 : .6 + R() * .7) * k; c.position.set(Math.cos(a) * d, (3.1 + R() * 1.5 + (j === 0 ? .4 : 0)) * k, Math.sin(a) * d); c.scale.y = .85; t.add(c); }
      }
      t.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); lot.add(t);
    });
    const ringPts = offsetPolygon(G.outline, 1.0);
    for (let i = 0; i < ringPts.length; i++) {
      const a = ringPts[i], c = ringPts[(i + 1) % ringPts.length], L = Math.hypot(c[0] - a[0], c[1] - a[1]); if (L < 2) continue;
      for (let t = 1; t < L - .5; t += 1.6 + R() * 1.4) { if (R() < .35) continue;
        const x = a[0] + (c[0] - a[0]) * t / L, y = a[1] + (c[1] - a[1]) * t / L;
        if (fd && Math.abs(x - (fd.x + fd.x2) / 2) < 1.6 && y < G.bbox[1] + .1) continue;
        const sh2 = foliage(.35 + R() * .25, leafCols[Math.floor(R() * 5)], Math.floor(R() * 1e6));
        const p = toV(x, y); sh2.position.set(p.x, .25, p.z); sh2.scale.y = .75; sh2.castShadow = true; lot.add(sh2); }
    }
    // límites de sombra según el tamaño del lote
    const ext = Math.max(bx[2] - bx[0], bx[3] - bx[1]) / 2 + 4;
    Object.assign(sun.shadow.camera, { left: -ext, right: ext, top: ext, bottom: -ext, near: 1, far: 140 }); sun.shadow.camera.updateProjectionMatrix();
  }
  function B2(a, b, c, mat) { return new THREE.Mesh(new THREE.BoxGeometry(a, b, c), mat); }

  /* ---------------- cámara */
  let tween = null;
  function viewPos(k) {
    const s = Math.max(dims.W, dims.D, 8) / 10, ty = Math.min(2.4, dims.H * .4);
    return { front: [[9.5 * s, 3.2 * s + dims.H * .2, 15 * s], [0, ty, 0]], side: [[17 * s, 2.8 * s + dims.H * .2, -2.5 * s], [0, ty, 0]],
      back: [[-11 * s, 3.6 * s + dims.H * .25, -14 * s], [0, ty, 0]], top: [[5 * s, 15 * s, 9 * s], [0, .6, 0]], eye: [[3.5 * s, 1.65, 12 * s], [0, 2.2, 0]] }[k];
  }
  function goView(k, instant) {
    if (roof) roof.visible = k === 'top' ? false : state.roof;
    const [p, t] = viewPos(k), reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    tween = { t0: performance.now(), dur: (reduce || instant) ? 0 : 1000, fp: camera.position.clone(), ft: controls.target.clone(), tp: new THREE.Vector3(...p), tt: new THREE.Vector3(...t) };
    state.dirty = true;
  }

  /* ---------------- API */
  let clad = { key: 'tinglado', color: 0 };
  function setCladding(key, ci) {
    clad = { key, color: ci }; const r = DATA.revest[key], hex = r.colores[ci][1], t = cladTextures(key, hex);
    Object.assign(M.siding, { map: t.map, normalMap: t.normalMap, roughnessMap: t.roughnessMap });
    M.siding.roughness = 1; M.siding.metalness = key === 'metal' ? .35 : 0; M.siding.normalScale = new THREE.Vector2(1, 1);
    M.siding.needsUpdate = true;
    const L = new THREE.Color(hex).getHSL({}).l; M.trim.color.set(L > .72 ? '#4c5054' : '#efe9de');
    state.dirty = true;
  }
  function show(mod, instant) {
    if (house) { scene.remove(house, roof); disposeGroup(house); disposeGroup(roof); }
    const b = buildModel(mod); house = b.grp; roof = b.rf; chimney(b); buildLot(b); cur = mod;
    dims = { W: b.W, D: b.D, H: b.H }; roof.visible = state.roof; scene.add(house, roof);
    sun.target.position.set(0, 0, 0); updateSun(false); goView('front', instant); state.dirty = true;
  }
  function resize() {
    const w = container.clientWidth, h = container.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); composer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); state.dirty = true;
  }
  new ResizeObserver(resize).observe(container); resize();
  setCladding('tinglado', 0); updateSun(true);

  renderer.setAnimationLoop(now => {
    if (tween) { const k = tween.dur ? Math.min(1, (now - tween.t0) / tween.dur) : 1, e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      camera.position.lerpVectors(tween.fp, tween.tp, e); controls.target.lerpVectors(tween.ft, tween.tt, e); if (k >= 1) tween = null; state.dirty = true; }
    if (state.autorotate) { const a = .0025, p = camera.position.clone().sub(controls.target); p.applyAxisAngle(new THREE.Vector3(0, 1, 0), a); camera.position.copy(controls.target).add(p); state.dirty = true; }
    const moving = controls.update();
    if (!state.dirty && !moving) return;
    state.dirty = false;
    if (state.quality === 'alta') composer.render(); else renderer.render(scene, camera);
  });

  /* miniaturas: un renderizador aparte, sin postproceso */
  async function thumbnails(mods, w = 560, h = 350) {
    const tr = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    tr.setSize(w, h, false); tr.setPixelRatio(1); tr.shadowMap.enabled = true; tr.shadowMap.type = THREE.PCFSoftShadowMap;
    tr.toneMapping = renderer.toneMapping; tr.toneMappingExposure = renderer.toneMappingExposure; tr.outputColorSpace = THREE.SRGBColorSpace;
    const pm = new THREE.PMREMGenerator(tr), envT = pm.fromScene(skyScene, 0, .1, 1000), mainEnv = scene.environment;
    const cam = new THREE.PerspectiveCamera(32, w / h, .1, 3000), out = {};
    const saved = cur, savedRoof = state.roof; state.roof = true;
    for (const m of mods) {
      if (house) { scene.remove(house, roof); disposeGroup(house); disposeGroup(roof); }
      const b = buildModel(m); house = b.grp; roof = b.rf; chimney(b); buildLot(b); scene.add(house, roof);
      const s = Math.max(b.W, b.D, 8) / 10; cam.position.set(9 * s, 2.6 * s + b.H * .25, 13.5 * s); cam.lookAt(0, Math.min(2, b.H * .35), 0);
      scene.environment = envT.texture; tr.render(scene, cam); out[m.id] = tr.domElement.toDataURL('image/jpeg', .82);
      await new Promise(r => setTimeout(r, 0));
    }
    scene.environment = mainEnv; envT.dispose(); pm.dispose(); tr.dispose(); tr.forceContextLoss?.();
    state.roof = savedRoof; if (saved) show(saved, true);
    return out;
  }

  return {
    show, setCladding, goView, thumbnails,
    setHour(hh) { state.hour = hh; updateSun(true); },
    setFacade(f) { state.facade = f; updateSun(true); },
    setRoof(v) { state.roof = v; if (roof) roof.visible = v; state.dirty = true; },
    setQuality(q) { state.quality = q; renderer.setPixelRatio(Math.min(devicePixelRatio, q === 'alta' ? 2 : 1.25)); sun.shadow.mapSize.set(q === 'alta' ? 4096 : 2048, q === 'alta' ? 4096 : 2048); sun.shadow.map?.dispose(); sun.shadow.map = null; resize(); },
    setAutorotate(v) { state.autorotate = v; state.dirty = true; },
    get state() { return state; },
  };
}
