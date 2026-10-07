'use strict';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const GRID = 100;            // world is GRID x GRID cells
const SPEED = 7;             // cells per second
const BOT_COUNT = 10;
const START_RADIUS = 2;      // starting territory is (2r+1)^2
const BOT_RESPAWN_MS = 3000;

const DIRS = [
  { x: 0, y: -1 }, // 0 up
  { x: 1, y: 0 },  // 1 right
  { x: 0, y: 1 },  // 2 down
  { x: -1, y: 0 }, // 3 left
];

const BOT_NAMES = [
  'Pixel', 'Zigzag', 'Blocky', 'Scribble', 'Inkwell', 'Origami', 'Crayon',
  'Doodle', 'Sketch', 'Papyrus', 'Confetti', 'Tetra', 'Marker', 'Quill',
  'Snippet', 'Folder', 'Stencil', 'Ruler',
];

const HUES = [0, 30, 50, 90, 140, 170, 260, 285, 315, 340];

// ---------------------------------------------------------------------------
// World state
// ---------------------------------------------------------------------------
const owner = new Int32Array(GRID * GRID); // player id owning each cell (0 = none)
const trail = new Int32Array(GRID * GRID); // player id whose trail is on cell
const areaCount = new Map();               // id -> number of owned cells
const byId = new Map();                    // id -> player
const players = [];
let nextId = 1;
let human = null;
let state = 'menu';                        // 'menu' | 'playing' | 'dead'

const idx = (x, y) => y * GRID + x;
const inBounds = (x, y) => x >= 0 && y >= 0 && x < GRID && y < GRID;
const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

function setOwner(i, id) {
  const old = owner[i];
  if (old === id) return;
  if (old) areaCount.set(old, areaCount.get(old) - 1);
  if (id) areaCount.set(id, (areaCount.get(id) || 0) + 1);
  owner[i] = id;
}

function hslToRgb(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

function makeColors(hue) {
  return {
    main: `hsl(${hue},72%,56%)`,
    dark: `hsl(${hue},62%,38%)`,
    trail: `hsla(${hue},72%,56%,0.5)`,
    rgb: hslToRgb(hue, 72, 56),
  };
}

// ---------------------------------------------------------------------------
// Players
// ---------------------------------------------------------------------------
function createPlayer(name, hue, isBot) {
  const p = {
    id: 0, name, isBot, alive: false,
    colors: makeColors(hue),
    x: 0, y: 0, dir: 1, progress: 0, queue: [],
    trail: [], box: null,
    kills: 0, bestArea: 0, spawnTime: 0, respawnAt: 0,
    ai: { mode: 'idle', waypoints: [], maxTrail: 30 },
  };
  players.push(p);
  return p;
}

function spawnPlayer(p) {
  const r = START_RADIUS;
  let sx = 0, sy = 0, found = false;
  for (let attempt = 0; attempt < 300 && !found; attempt++) {
    sx = rand(r + 3, GRID - r - 4);
    sy = rand(r + 3, GRID - r - 4);
    found = areaIsFree(sx, sy, r + 2) && !players.some(o =>
      o.alive && Math.abs(o.x - sx) + Math.abs(o.y - sy) < 12);
  }
  if (!found) {
    // Fall back to any spot that is at least not on someone's trail.
    for (let attempt = 0; attempt < 300; attempt++) {
      sx = rand(r + 1, GRID - r - 2);
      sy = rand(r + 1, GRID - r - 2);
      if (areaIsFree(sx, sy, r, true)) break;
    }
  }

  p.id = nextId++;
  byId.set(p.id, p);
  areaCount.set(p.id, 0);
  p.alive = true;
  p.x = sx; p.y = sy;
  p.dir = rand(0, 3);
  p.progress = 0;
  p.queue = [];
  p.trail = [];
  p.kills = 0;
  p.bestArea = 0;
  p.spawnTime = performance.now();
  p.box = { x0: sx - r, y0: sy - r, x1: sx + r, y1: sy + r };
  p.ai = { mode: 'idle', waypoints: [], maxTrail: rand(14, 40) };

  for (let y = sy - r; y <= sy + r; y++) {
    for (let x = sx - r; x <= sx + r; x++) {
      const i = idx(x, y);
      if (trail[i]) continue;
      setOwner(i, p.id);
    }
  }
}

function areaIsFree(cx, cy, r, trailOnly = false) {
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      if (!inBounds(x, y)) return false;
      const i = idx(x, y);
      if (trail[i] || (!trailOnly && owner[i])) return false;
    }
  }
  return true;
}

function growBox(p, x, y) {
  const b = p.box;
  if (x < b.x0) b.x0 = x;
  if (y < b.y0) b.y0 = y;
  if (x > b.x1) b.x1 = x;
  if (y > b.y1) b.y1 = y;
}

function kill(p, killer, reason) {
  if (!p.alive) return;
  p.alive = false;
  for (const i of p.trail) if (trail[i] === p.id) trail[i] = 0;
  p.trail = [];
  for (let i = 0; i < owner.length; i++) if (owner[i] === p.id) owner[i] = 0;
  areaCount.delete(p.id);
  byId.delete(p.id);

  if (killer && killer !== p && killer.alive) {
    killer.kills++;
    if (killer === human) toast(`You eliminated ${p.name}!`);
  }

  if (p === human) {
    state = 'dead';
    setTimeout(() => showGameOver(reason), 900);
  } else {
    p.respawnAt = performance.now() + BOT_RESPAWN_MS;
  }
}

// Called when a player returns to their own land with a trail.
function capture(p) {
  for (const i of p.trail) {
    trail[i] = 0;
    setOwner(i, p.id);
  }
  p.trail = [];

  // Flood fill from the edge of the bounding box; anything not reachable
  // without crossing this player's land is enclosed and gets captured.
  const b = p.box;
  const x0 = Math.max(0, b.x0 - 1), y0 = Math.max(0, b.y0 - 1);
  const x1 = Math.min(GRID - 1, b.x1 + 1), y1 = Math.min(GRID - 1, b.y1 + 1);
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const seen = new Uint8Array(w * h);
  const stack = [];
  const visit = (x, y) => {
    const li = (y - y0) * w + (x - x0);
    if (seen[li] || owner[idx(x, y)] === p.id) return;
    seen[li] = 1;
    stack.push(x, y);
  };
  for (let x = x0; x <= x1; x++) { visit(x, y0); visit(x, y1); }
  for (let y = y0; y <= y1; y++) { visit(x0, y); visit(x1, y); }
  while (stack.length) {
    const y = stack.pop(), x = stack.pop();
    if (x > x0) visit(x - 1, y);
    if (x < x1) visit(x + 1, y);
    if (y > y0) visit(x, y - 1);
    if (y < y1) visit(x, y + 1);
  }
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (!seen[(y - y0) * w + (x - x0)]) setOwner(idx(x, y), p.id);
    }
  }

  // Anyone whose land was completely swallowed is eliminated.
  for (const o of players) {
    if (o.alive && o !== p && !areaCount.get(o.id)) {
      kill(o, p, `${p.name} took all of your land`);
    }
  }
}

// Move a player into the next cell and resolve what happens there.
function advance(p) {
  const nx = p.x + DIRS[p.dir].x;
  const ny = p.y + DIRS[p.dir].y;
  p.x = nx; p.y = ny;

  if (!inBounds(nx, ny)) return kill(p, null, 'You hit the wall');

  const i = idx(nx, ny);
  const t = trail[i];
  if (t === p.id) return kill(p, null, 'You crossed your own trail');
  if (t) {
    const victim = byId.get(t);
    if (victim) kill(victim, p, `${p.name} cut your trail`);
  }

  if (owner[i] === p.id) {
    if (p.trail.length) capture(p);
  } else {
    trail[i] = p.id;
    p.trail.push(i);
    growBox(p, nx, ny);
  }
}

function applyTurn(p) {
  while (p.queue.length) {
    const d = p.queue.shift();
    if (d !== p.dir && d !== (p.dir + 2) % 4) { p.dir = d; break; }
  }
}

function resolveHeadOns() {
  for (let a = 0; a < players.length; a++) {
    const A = players[a];
    if (!A.alive) continue;
    for (let b = a + 1; b < players.length; b++) {
      const B = players[b];
      if (!B.alive || A.x !== B.x || A.y !== B.y) continue;
      const i = idx(A.x, A.y);
      const aSafe = owner[i] === A.id, bSafe = owner[i] === B.id;
      if (aSafe && !bSafe) kill(B, A, `You crashed into ${A.name}`);
      else if (bSafe && !aSafe) kill(A, B, `You crashed into ${B.name}`);
      else if (!aSafe && !bSafe) {
        kill(A, B, `You crashed into ${B.name}`);
        kill(B, A, `You crashed into ${A.name}`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Bot AI
// ---------------------------------------------------------------------------
const spaceSeen = new Int32Array(GRID * GRID);
let spaceStamp = 1;

// How many cells can be reached from (sx,sy) without hitting a wall or own trail.
function freeSpace(p, sx, sy, limit) {
  spaceStamp++;
  const stack = [sx, sy];
  spaceSeen[idx(sx, sy)] = spaceStamp;
  let count = 0;
  while (stack.length && count < limit) {
    const y = stack.pop(), x = stack.pop();
    count++;
    for (const d of DIRS) {
      const nx = x + d.x, ny = y + d.y;
      if (!inBounds(nx, ny)) continue;
      const i = idx(nx, ny);
      if (spaceSeen[i] === spaceStamp || trail[i] === p.id) continue;
      if (nx === p.x && ny === p.y) continue;
      spaceSeen[i] = spaceStamp;
      stack.push(nx, ny);
    }
  }
  return count;
}

function nearestOwnCell(p) {
  for (let r = 1; r < GRID; r++) {
    let best = null, bestD = Infinity;
    for (let y = p.y - r; y <= p.y + r; y++) {
      for (let x = p.x - r; x <= p.x + r; x++) {
        if (Math.abs(x - p.x) !== r && Math.abs(y - p.y) !== r) continue;
        if (!inBounds(x, y) || owner[idx(x, y)] !== p.id) continue;
        const d = Math.abs(x - p.x) + Math.abs(y - p.y);
        if (d < bestD) { bestD = d; best = { x, y }; }
      }
    }
    if (best) return best;
  }
  return { x: GRID >> 1, y: GRID >> 1 };
}

function nearestEnemyTrail(p, r) {
  let best = null, bestD = Infinity;
  for (let y = p.y - r; y <= p.y + r; y++) {
    for (let x = p.x - r; x <= p.x + r; x++) {
      if (!inBounds(x, y)) continue;
      const t = trail[idx(x, y)];
      if (!t || t === p.id) continue;
      const d = Math.abs(x - p.x) + Math.abs(y - p.y);
      if (d < bestD) { bestD = d; best = { x, y }; }
    }
  }
  return best;
}

function enemyHeadDistance(p) {
  let best = Infinity;
  for (const o of players) {
    if (!o.alive || o === p) continue;
    best = Math.min(best, Math.abs(o.x - p.x) + Math.abs(o.y - p.y));
  }
  return best;
}

function planExcursion(p) {
  const area = areaCount.get(p.id) || 1;
  const reach = Math.ceil(Math.sqrt(area) / 2) + rand(3, 9);
  const d = rand(0, 3);
  const side = (d + (Math.random() < 0.5 ? 1 : 3)) % 4;
  const clamp = v => Math.max(1, Math.min(GRID - 2, v));
  const a = { x: clamp(p.x + DIRS[d].x * reach), y: clamp(p.y + DIRS[d].y * reach) };
  const len = rand(3, 10);
  const b = { x: clamp(a.x + DIRS[side].x * len), y: clamp(a.y + DIRS[side].y * len) };
  p.ai.waypoints = [a, b];
  p.ai.maxTrail = rand(14, 40);
  p.ai.mode = 'out';
}

function botThink(p) {
  const ai = p.ai;
  const home = owner[idx(p.x, p.y)] === p.id;

  if (home) {
    if (ai.mode !== 'out' || !ai.waypoints.length) planExcursion(p);
  } else if (p.trail.length > ai.maxTrail || enemyHeadDistance(p) < 6) {
    ai.mode = 'return';
  }

  let target;
  if (ai.mode === 'out') {
    const wp = ai.waypoints[0];
    if (Math.abs(wp.x - p.x) + Math.abs(wp.y - p.y) <= 1) ai.waypoints.shift();
    if (ai.waypoints.length) target = ai.waypoints[0];
    else ai.mode = 'return';
  }
  if (ai.mode === 'return') target = nearestOwnCell(p);

  // Opportunistic attack on nearby trails while it's safe.
  if (home || p.trail.length < 8) {
    const prey = nearestEnemyTrail(p, 5);
    if (prey) target = prey;
  }

  chooseDirection(p, target);
}

function chooseDirection(p, target) {
  const options = [p.dir, (p.dir + 1) % 4, (p.dir + 3) % 4];
  let bestDir = p.dir, bestScore = -Infinity;
  for (const d of options) {
    const nx = p.x + DIRS[d].x, ny = p.y + DIRS[d].y;
    if (!inBounds(nx, ny)) continue;
    if (trail[idx(nx, ny)] === p.id) continue;
    let score = -(Math.abs(target.x - nx) + Math.abs(target.y - ny));
    const space = freeSpace(p, nx, ny, 60);
    if (space < 60) score -= (60 - space) * 3;
    if (d === p.dir) score += 0.4;
    score += Math.random() * 0.6;
    if (score > bestScore) { bestScore = score; bestDir = d; }
  }
  p.queue = [bestDir];
}

// ---------------------------------------------------------------------------
// Game loop
// ---------------------------------------------------------------------------
function update(dt) {
  const now = performance.now();
  for (const p of players) {
    if (!p.alive) {
      if (p.isBot && now >= p.respawnAt) spawnPlayer(p);
      continue;
    }
    p.progress += SPEED * dt;
    while (p.progress >= 1 && p.alive) {
      p.progress -= 1;
      advance(p);
      if (!p.alive) break;
      if (p.isBot) botThink(p);
      applyTurn(p);
    }
  }
  resolveHeadOns();

  if (human && human.alive) {
    const pct = (areaCount.get(human.id) || 0) / (GRID * GRID) * 100;
    human.bestArea = Math.max(human.bestArea, pct);
  }
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const mini = document.getElementById('minimap');
const mctx = mini.getContext('2d');
mini.width = GRID; mini.height = GRID;
const miniImage = mctx.createImageData(GRID, GRID);

let viewW = 0, viewH = 0, cell = 24;
const cam = { x: GRID / 2, y: GRID / 2 };

function resize() {
  const dpr = window.devicePixelRatio || 1;
  viewW = window.innerWidth;
  viewH = window.innerHeight;
  canvas.width = viewW * dpr;
  canvas.height = viewH * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  cell = Math.max(16, Math.min(32, Math.min(viewW, viewH) / 26));
}
window.addEventListener('resize', resize);
resize();

function headPos(p) {
  return {
    x: p.x + DIRS[p.dir].x * (p.alive ? p.progress : 0),
    y: p.y + DIRS[p.dir].y * (p.alive ? p.progress : 0),
  };
}

function cameraTarget() {
  if (human && (human.alive || state === 'dead')) return headPos(human);
  const bot = players.find(p => p.alive);
  return bot ? headPos(bot) : { x: GRID / 2, y: GRID / 2 };
}

function render(dt) {
  const t = cameraTarget();
  const k = Math.min(1, dt * 8);
  cam.x += (t.x + 0.5 - cam.x) * k;
  cam.y += (t.y + 0.5 - cam.y) * k;

  const ox = viewW / 2 - cam.x * cell;
  const oy = viewH / 2 - cam.y * cell;
  const toX = x => ox + x * cell;
  const toY = y => oy + y * cell;

  // Out-of-bounds background
  ctx.fillStyle = '#c7d1db';
  ctx.fillRect(0, 0, viewW, viewH);

  const minX = Math.max(0, Math.floor(-ox / cell) - 1);
  const minY = Math.max(0, Math.floor(-oy / cell) - 1);
  const maxX = Math.min(GRID - 1, Math.ceil((viewW - ox) / cell) + 1);
  const maxY = Math.min(GRID - 1, Math.ceil((viewH - oy) / cell) + 1);

  // Playfield with subtle checkerboard
  ctx.fillStyle = '#eef2f6';
  ctx.fillRect(toX(0), toY(0), GRID * cell, GRID * cell);
  ctx.fillStyle = '#e4e9ef';
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX + ((minX + y) & 1); x <= maxX; x += 2) {
      ctx.fillRect(toX(x), toY(y), cell, cell);
    }
  }

  // Territory: dark "side" pass first, then the top face, to give depth.
  const depth = Math.max(3, cell * 0.22);
  for (let pass = 0; pass < 2; pass++) {
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const o = owner[idx(x, y)];
        if (!o) continue;
        const p = byId.get(o);
        if (!p) continue;
        if (pass === 0) {
          ctx.fillStyle = p.colors.dark;
          ctx.fillRect(toX(x), toY(y) + depth, cell + 0.5, cell + 0.5);
        } else {
          ctx.fillStyle = p.colors.main;
          ctx.fillRect(toX(x), toY(y), cell + 0.5, cell + 0.5);
        }
      }
    }
  }

  // Trails
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const t2 = trail[idx(x, y)];
      if (!t2) continue;
      const p = byId.get(t2);
      if (!p) continue;
      ctx.fillStyle = p.colors.trail;
      ctx.fillRect(toX(x) + 1, toY(y) + 1, cell - 2, cell - 2);
    }
  }

  // Heads and names
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.font = `700 ${Math.round(cell * 0.55)}px system-ui, sans-serif`;
  for (const p of players) {
    if (!p.alive) continue;
    const h = headPos(p);
    const sx = toX(h.x), sy = toY(h.y);
    if (sx < -cell * 4 || sy < -cell * 4 || sx > viewW + cell * 4 || sy > viewH + cell * 4) continue;
    const pad = cell * 0.08;
    ctx.fillStyle = p.colors.dark;
    ctx.fillRect(sx - pad, sy - pad + depth, cell + pad * 2, cell + pad * 2);
    ctx.fillStyle = p.colors.main;
    ctx.fillRect(sx - pad, sy - pad, cell + pad * 2, cell + pad * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 2;
    ctx.strokeRect(sx + 2, sy + 2, cell - 4, cell - 4);

    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.strokeText(p.name, sx + cell / 2, sy - cell * 0.25);
    ctx.fillStyle = '#fff';
    ctx.fillText(p.name, sx + cell / 2, sy - cell * 0.25);
  }
}

function renderMinimap() {
  const d = miniImage.data;
  for (let i = 0; i < owner.length; i++) {
    const id = trail[i] || owner[i];
    const p = id ? byId.get(id) : null;
    const j = i * 4;
    if (p) {
      d[j] = p.colors.rgb[0]; d[j + 1] = p.colors.rgb[1]; d[j + 2] = p.colors.rgb[2];
      d[j + 3] = trail[i] ? 130 : 255;
    } else {
      d[j] = d[j + 1] = d[j + 2] = 255; d[j + 3] = 60;
    }
  }
  if (human && human.alive) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const x = human.x + dx, y = human.y + dy;
        if (!inBounds(x, y)) continue;
        const j = idx(x, y) * 4;
        d[j] = d[j + 1] = d[j + 2] = 20; d[j + 3] = 255;
      }
    }
  }
  mctx.putImageData(miniImage, 0, 0);
}

// ---------------------------------------------------------------------------
// HUD
// ---------------------------------------------------------------------------
const $ = id => document.getElementById(id);
const hud = $('hud'), statArea = $('stat-area'), statKills = $('stat-kills');
const board = $('leaderboard'), feed = $('feed');

const pct = p => (areaCount.get(p.id) || 0) / (GRID * GRID) * 100;

function updateHud() {
  if (human && human.alive) {
    statArea.textContent = pct(human).toFixed(2) + '%';
    statKills.textContent = `${human.kills} kill${human.kills === 1 ? '' : 's'}`;
  }
  const ranked = players.filter(p => p.alive).sort((a, b) => pct(b) - pct(a));
  const top = ranked.slice(0, 5);
  if (human && human.alive && !top.includes(human)) top.push(human);
  board.innerHTML = '';
  for (const p of top) {
    const li = document.createElement('li');
    li.value = ranked.indexOf(p) + 1;
    if (p === human) li.className = 'me';
    const swatch = document.createElement('i');
    swatch.style.background = p.colors.main;
    li.appendChild(swatch);
    li.appendChild(document.createTextNode(p.name));
    const s = document.createElement('span');
    s.textContent = pct(p).toFixed(1) + '%';
    li.appendChild(s);
    board.appendChild(li);
  }
}

function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  feed.appendChild(el);
  setTimeout(() => el.remove(), 2300);
}

function showGameOver(reason) {
  $('death-reason').textContent = reason || '';
  $('res-area').textContent = human.bestArea.toFixed(2) + '%';
  $('res-kills').textContent = human.kills;
  $('res-time').textContent = Math.round((performance.now() - human.spawnTime) / 1000) + 's';
  hud.classList.add('hidden');
  mini.classList.add('hidden');
  $('gameover').classList.remove('hidden');
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------
function steer(d) {
  if (!human || !human.alive) return;
  const last = human.queue.length ? human.queue[human.queue.length - 1] : human.dir;
  if (d === last || d === (last + 2) % 4) return;
  if (human.queue.length < 3) human.queue.push(d);
}

const KEYS = {
  ArrowUp: 0, KeyW: 0, ArrowRight: 1, KeyD: 1,
  ArrowDown: 2, KeyS: 2, ArrowLeft: 3, KeyA: 3,
};
window.addEventListener('keydown', e => {
  if (state === 'menu' && e.code === 'Enter') return startGame();
  if (state !== 'playing') return;
  if (e.code in KEYS) { steer(KEYS[e.code]); e.preventDefault(); }
});

let touchStart = null;
window.addEventListener('touchstart', e => {
  const t = e.touches[0];
  touchStart = { x: t.clientX, y: t.clientY };
}, { passive: true });
window.addEventListener('touchmove', e => {
  if (!touchStart || state !== 'playing') return;
  const t = e.touches[0];
  const dx = t.clientX - touchStart.x, dy = t.clientY - touchStart.y;
  if (Math.hypot(dx, dy) < 24) return;
  steer(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0));
  touchStart = { x: t.clientX, y: t.clientY };
}, { passive: true });

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------
function startGame() {
  const name = $('name').value.trim() || 'You';
  try { localStorage.setItem('pt-name', name); } catch (_) { /* ignore */ }
  if (!human) human = createPlayer(name, 210, false);
  human.name = name;
  spawnPlayer(human);
  cam.x = human.x + 0.5; cam.y = human.y + 0.5;
  state = 'playing';
  $('menu').classList.add('hidden');
  $('gameover').classList.add('hidden');
  hud.classList.remove('hidden');
  mini.classList.remove('hidden');
  updateHud();
}

$('play').addEventListener('click', startGame);
$('again').addEventListener('click', startGame);
try { $('name').value = localStorage.getItem('pt-name') || ''; } catch (_) { /* ignore */ }

const names = BOT_NAMES.slice().sort(() => Math.random() - 0.5);
for (let i = 0; i < BOT_COUNT; i++) {
  spawnPlayer(createPlayer(names[i % names.length], HUES[i % HUES.length] + 8, true));
}

let last = performance.now(), hudTimer = 0, miniTimer = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  render(dt);
  hudTimer += dt; miniTimer += dt;
  if (hudTimer > 0.25) { hudTimer = 0; if (state === 'playing') updateHud(); }
  if (miniTimer > 0.15) { miniTimer = 0; if (state === 'playing') renderMinimap(); }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
