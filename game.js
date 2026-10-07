'use strict';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const GRID = 200;            // world is GRID x GRID cells
const SPEED = 12;            // cells per second
const TURN_RATE = 7;         // max radians per second a head can turn
const SUBSTEP = 0.4;         // max distance moved per collision step (cells)
const BOT_COUNT = 10;
const START_RADIUS = 5;      // starting territory is a circle of this radius
const BOT_RESPAWN_MS = 3000;
const HEAD_SIZE = 2.2;       // avatar size in cells
const JOY_RADIUS = 70;       // touch joystick radius in px

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
const TAU = Math.PI * 2;

function angleDiff(a, b) {
  let d = (a - b) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

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
    trail: `hsla(${hue},72%,56%,0.55)`,
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
    px: 0, py: 0,          // precise position (cells, float)
    cx: 0, cy: 0,          // current cell
    angle: 0, target: 0,   // heading and desired heading (radians)
    trail: [],             // trail cell indices (for collision)
    trailPts: [],          // trail polyline [x0,y0,x1,y1,...] (for drawing)
    lastIn: { x: 0, y: 0 },// last position inside own land
    box: null,
    kills: 0, bestArea: 0, spawnTime: 0, respawnAt: 0,
    ai: null,
  };
  players.push(p);
  return p;
}

function spawnPlayer(p) {
  const r = START_RADIUS;
  let sx = 0, sy = 0, found = false;
  for (let attempt = 0; attempt < 300 && !found; attempt++) {
    sx = rand(r + 6, GRID - r - 7);
    sy = rand(r + 6, GRID - r - 7);
    found = areaIsFree(sx, sy, r + 3) && !players.some(o =>
      o.alive && Math.abs(o.cx - sx) + Math.abs(o.cy - sy) < 25);
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
  p.cx = sx; p.cy = sy;
  p.px = sx + 0.5; p.py = sy + 0.5;
  p.angle = Math.atan2(GRID / 2 - sy, GRID / 2 - sx) + (Math.random() - 0.5);
  p.target = p.angle;
  p.trail = [];
  p.trailPts = [];
  p.lastIn = { x: p.px, y: p.py };
  p.kills = 0;
  p.bestArea = 0;
  p.spawnTime = performance.now();
  p.box = { x0: sx - r, y0: sy - r, x1: sx + r, y1: sy + r };
  p.ai = { mode: 'idle', waypoints: [], maxTrail: 60, thinkIn: 0 };

  for (let y = sy - r; y <= sy + r; y++) {
    for (let x = sx - r; x <= sx + r; x++) {
      if ((x - sx) ** 2 + (y - sy) ** 2 > r * r + r) continue;
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
  p.trailPts = [];
  for (let i = 0; i < owner.length; i++) if (owner[i] === p.id) owner[i] = 0;
  areaCount.delete(p.id);
  byId.delete(p.id);

  if (killer && killer !== p && killer.alive) {
    killer.kills++;
    if (killer === human) toast(`You eliminated ${p.name}!`);
  }

  if (p === human) {
    state = 'dead';
    joy.active = false;
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
  p.trailPts = [];

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

// The head has moved into cell (x, y): resolve what happens there.
function enterCell(p, x, y) {
  p.cx = x; p.cy = y;
  if (!inBounds(x, y)) return kill(p, null, 'You hit the wall');

  const i = idx(x, y);
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
    growBox(p, x, y);
  }
}

function movePlayer(p, dt) {
  const turn = angleDiff(p.target, p.angle);
  const maxTurn = TURN_RATE * dt;
  p.angle += Math.max(-maxTurn, Math.min(maxTurn, turn));

  const cos = Math.cos(p.angle), sin = Math.sin(p.angle);
  let dist = SPEED * dt;
  while (dist > 0 && p.alive) {
    const step = Math.min(SUBSTEP, dist);
    dist -= step;
    const ox = p.px, oy = p.py;
    p.px += cos * step;
    p.py += sin * step;
    const nx = Math.floor(p.px), ny = Math.floor(p.py);

    if (nx !== p.cx || ny !== p.cy) {
      if (nx !== p.cx && ny !== p.cy) {
        // Crossed a corner: visit the in-between cell first so trails stay
        // 4-connected and nobody can slip through a diagonal gap.
        const bx = nx > p.cx ? nx : p.cx;
        const by = ny > p.cy ? ny : p.cy;
        const tx = (bx - ox) / (p.px - ox);
        const ty = (by - oy) / (p.py - oy);
        if (tx < ty) enterCell(p, nx, p.cy);
        else enterCell(p, p.cx, ny);
        if (!p.alive) break;
      }
      enterCell(p, nx, ny);
    }

    if (p.trail.length) {
      const pts = p.trailPts;
      if (!pts.length) pts.push(p.lastIn.x, p.lastIn.y);
      const lx = pts[pts.length - 2], ly = pts[pts.length - 1];
      if ((p.px - lx) ** 2 + (p.py - ly) ** 2 > 0.36) pts.push(p.px, p.py);
    } else {
      p.lastIn.x = p.px;
      p.lastIn.y = p.py;
    }
  }
}

function resolveHeadOns() {
  for (let a = 0; a < players.length; a++) {
    const A = players[a];
    if (!A.alive) continue;
    for (let b = a + 1; b < players.length; b++) {
      const B = players[b];
      if (!B.alive || !A.alive) continue;
      if ((A.px - B.px) ** 2 + (A.py - B.py) ** 2 > 1.4) continue;
      const aSafe = owner[idx(A.cx, A.cy)] === A.id;
      const bSafe = owner[idx(B.cx, B.cy)] === B.id;
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
  if (!inBounds(sx, sy) || trail[idx(sx, sy)] === p.id) return 0;
  spaceStamp++;
  const stack = [sx, sy];
  spaceSeen[idx(sx, sy)] = spaceStamp;
  let count = 0;
  while (stack.length && count < limit) {
    const y = stack.pop(), x = stack.pop();
    count++;
    for (let k = 0; k < 4; k++) {
      const nx = x + (k === 1) - (k === 3), ny = y + (k === 2) - (k === 0);
      if (!inBounds(nx, ny)) continue;
      const i = idx(nx, ny);
      if (spaceSeen[i] === spaceStamp || trail[i] === p.id) continue;
      if (nx === p.cx && ny === p.cy) continue;
      spaceSeen[i] = spaceStamp;
      stack.push(nx, ny);
    }
  }
  return count;
}

// Distance along angle `a` until a wall or own trail, or Infinity if clear.
function rayBlocked(p, a, len) {
  const c = Math.cos(a), s = Math.sin(a);
  for (let d = 1; d <= len; d += 0.5) {
    const x = Math.floor(p.px + c * d), y = Math.floor(p.py + s * d);
    if (!inBounds(x, y)) return d;
    if ((x !== p.cx || y !== p.cy) && trail[idx(x, y)] === p.id) return d;
  }
  return Infinity;
}

function nearestOwnCell(p) {
  const x0 = p.cx, y0 = p.cy;
  for (let r = 1; r < GRID; r++) {
    let best = null, bestD = Infinity;
    const check = (x, y) => {
      if (!inBounds(x, y) || owner[idx(x, y)] !== p.id) return;
      const d = Math.abs(x - x0) + Math.abs(y - y0);
      if (d < bestD) { bestD = d; best = { x, y }; }
    };
    for (let k = -r; k <= r; k++) {
      check(x0 + k, y0 - r); check(x0 + k, y0 + r);
      check(x0 - r, y0 + k); check(x0 + r, y0 + k);
    }
    if (best) return best;
  }
  return { x: GRID >> 1, y: GRID >> 1 };
}

function nearestEnemyTrail(p, r) {
  let best = null, bestD = Infinity;
  for (let y = p.cy - r; y <= p.cy + r; y++) {
    for (let x = p.cx - r; x <= p.cx + r; x++) {
      if (!inBounds(x, y)) continue;
      const t = trail[idx(x, y)];
      if (!t || t === p.id) continue;
      const d = Math.abs(x - p.cx) + Math.abs(y - p.cy);
      if (d < bestD) { bestD = d; best = { x, y }; }
    }
  }
  return best;
}

function enemyHeadDistance(p) {
  let best = Infinity;
  for (const o of players) {
    if (!o.alive || o === p) continue;
    best = Math.min(best, Math.hypot(o.px - p.px, o.py - p.py));
  }
  return best;
}

function planExcursion(p) {
  const area = areaCount.get(p.id) || 1;
  const reach = Math.sqrt(area) / 2 + rand(6, 18);
  const a0 = Math.random() * TAU;
  const side = a0 + (Math.random() < 0.5 ? 1 : -1) * (Math.PI / 2 + (Math.random() - 0.5) * 0.6);
  const clamp = v => Math.max(2, Math.min(GRID - 3, Math.round(v)));
  const a = { x: clamp(p.px + Math.cos(a0) * reach), y: clamp(p.py + Math.sin(a0) * reach) };
  const len = rand(6, 18);
  const b = { x: clamp(a.x + Math.cos(side) * len), y: clamp(a.y + Math.sin(side) * len) };
  p.ai.waypoints = [a, b];
  p.ai.maxTrail = rand(30, 90);
  p.ai.mode = 'out';
}

function botThink(p) {
  const ai = p.ai;
  const home = owner[idx(p.cx, p.cy)] === p.id;

  if (home) {
    if (ai.mode !== 'out' || !ai.waypoints.length) planExcursion(p);
  } else if (p.trail.length > ai.maxTrail || enemyHeadDistance(p) < 10) {
    ai.mode = 'return';
  }

  let target;
  if (ai.mode === 'out') {
    const wp = ai.waypoints[0];
    if (Math.hypot(wp.x + 0.5 - p.px, wp.y + 0.5 - p.py) < 2) ai.waypoints.shift();
    if (ai.waypoints.length) target = ai.waypoints[0];
    else ai.mode = 'return';
  }
  if (ai.mode === 'return') target = nearestOwnCell(p);

  // Opportunistic attack on nearby trails while it's safe.
  if (home || p.trail.length < 15) {
    const prey = nearestEnemyTrail(p, 8);
    if (prey) target = prey;
  }

  const desired = Math.atan2(target.y + 0.5 - p.py, target.x + 0.5 - p.px);
  let best = desired, bestScore = -Infinity;
  for (const off of [0, 0.35, -0.35, 0.7, -0.7, 1.1, -1.1, 1.6, -1.6, 2.2, -2.2]) {
    const a = desired + off;
    let score = -Math.abs(off) * 2 - Math.abs(angleDiff(a, p.angle)) * 0.5;
    const blocked = rayBlocked(p, a, 8);
    if (blocked < Infinity) {
      score -= (9 - blocked) * 8;
    } else {
      const ex = Math.floor(p.px + Math.cos(a) * 4), ey = Math.floor(p.py + Math.sin(a) * 4);
      const space = freeSpace(p, ex, ey, 150);
      if (space < 150) score -= (150 - space) * 0.3;
    }
    score += Math.random() * 0.3;
    if (score > bestScore) { bestScore = score; best = a; }
  }
  p.target = best;
}

// ---------------------------------------------------------------------------
// Game loop
// ---------------------------------------------------------------------------
function update(dt) {
  const now = performance.now();
  if (human && human.alive) steerHuman();
  for (const p of players) {
    if (!p.alive) {
      if (p.isBot && now >= p.respawnAt) spawnPlayer(p);
      continue;
    }
    if (p.isBot) {
      p.ai.thinkIn -= dt;
      if (p.ai.thinkIn <= 0) {
        p.ai.thinkIn = 0.08 + Math.random() * 0.06;
        botThink(p);
      }
    }
    movePlayer(p, dt);
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

let viewW = 0, viewH = 0, cell = 12;
const cam = { x: GRID / 2, y: GRID / 2 };

function resize() {
  const dpr = window.devicePixelRatio || 1;
  viewW = window.innerWidth;
  viewH = window.innerHeight;
  canvas.width = viewW * dpr;
  canvas.height = viewH * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  cell = Math.max(7, Math.min(16, Math.min(viewW, viewH) / 42));
}
window.addEventListener('resize', resize);
resize();

function cameraTarget() {
  if (human && (human.alive || state === 'dead')) return human;
  const bot = players.find(p => p.alive);
  return bot || { px: GRID / 2, py: GRID / 2 };
}

const screenX = x => viewW / 2 + (x - cam.x) * cell;
const screenY = y => viewH / 2 + (y - cam.y) * cell;

function render(dt) {
  const t = cameraTarget();
  const k = Math.min(1, dt * 8);
  cam.x += (t.px - cam.x) * k;
  cam.y += (t.py - cam.y) * k;

  // Out-of-bounds background
  ctx.fillStyle = '#c7d1db';
  ctx.fillRect(0, 0, viewW, viewH);

  const minX = Math.max(0, Math.floor(cam.x - viewW / 2 / cell) - 1);
  const minY = Math.max(0, Math.floor(cam.y - viewH / 2 / cell) - 2);
  const maxX = Math.min(GRID - 1, Math.ceil(cam.x + viewW / 2 / cell) + 1);
  const maxY = Math.min(GRID - 1, Math.ceil(cam.y + viewH / 2 / cell) + 1);

  // Playfield with a subtle checkerboard of 5x5-cell tiles
  ctx.fillStyle = '#eef2f6';
  ctx.fillRect(screenX(0), screenY(0), GRID * cell, GRID * cell);
  ctx.fillStyle = '#e4e9ef';
  const T = 5;
  for (let ty = Math.floor(minY / T); ty <= Math.floor(maxY / T); ty++) {
    for (let tx = Math.floor(minX / T); tx <= Math.floor(maxX / T); tx++) {
      if ((tx + ty) & 1) ctx.fillRect(screenX(tx * T), screenY(ty * T), T * cell, T * cell);
    }
  }

  // Territory: dark "side" pass first, then the top face, to give depth.
  // Adjacent same-owner cells in a row are merged into one rect.
  const depth = Math.max(3, cell * 0.5);
  for (let pass = 0; pass < 2; pass++) {
    for (let y = minY; y <= maxY; y++) {
      let x = minX;
      while (x <= maxX) {
        const o = owner[idx(x, y)];
        if (!o) { x++; continue; }
        let x2 = x + 1;
        while (x2 <= maxX && owner[idx(x2, y)] === o) x2++;
        const p = byId.get(o);
        if (p) {
          ctx.fillStyle = pass === 0 ? p.colors.dark : p.colors.main;
          ctx.fillRect(screenX(x), screenY(y) + (pass === 0 ? depth : 0),
            (x2 - x) * cell + 0.5, cell + 0.5);
        }
        x = x2;
      }
    }
  }

  // Trails as smooth lines
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = cell;
  for (const p of players) {
    if (!p.alive || !p.trailPts.length) continue;
    const pts = p.trailPts;
    ctx.strokeStyle = p.colors.trail;
    ctx.beginPath();
    ctx.moveTo(screenX(pts[0]), screenY(pts[1]));
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(screenX(pts[i]), screenY(pts[i + 1]));
    ctx.lineTo(screenX(p.px), screenY(p.py));
    ctx.stroke();
  }

  // Heads and names
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.font = `700 ${Math.round(Math.max(12, cell * 1.1))}px system-ui, sans-serif`;
  const size = HEAD_SIZE * cell;
  for (const p of players) {
    if (!p.alive) continue;
    const sx = screenX(p.px), sy = screenY(p.py);
    if (sx < -100 || sy < -100 || sx > viewW + 100 || sy > viewH + 100) continue;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(p.angle);
    ctx.fillStyle = p.colors.dark;
    roundRect(-size / 2, -size / 2 + depth * 0.6, size, size, size * 0.25);
    ctx.fill();
    ctx.fillStyle = p.colors.main;
    roundRect(-size / 2, -size / 2, size, size, size * 0.25);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 2;
    roundRect(-size / 2 + 3, -size / 2 + 3, size - 6, size - 6, size * 0.18);
    ctx.stroke();
    ctx.restore();

    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.strokeText(p.name, sx, sy - size * 0.75);
    ctx.fillStyle = '#fff';
    ctx.fillText(p.name, sx, sy - size * 0.75);
  }

  // Touch joystick
  if (joy.active && state === 'playing') {
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(joy.ox, joy.oy, JOY_RADIUS, 0, TAU);
    ctx.fill();
    ctx.stroke();
    let dx = joy.x - joy.ox, dy = joy.y - joy.oy;
    const len = Math.hypot(dx, dy);
    if (len > JOY_RADIUS) { dx *= JOY_RADIUS / len; dy *= JOY_RADIUS / len; }
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.arc(joy.ox + dx, joy.oy + dy, 26, 0, TAU);
    ctx.fill();
    ctx.stroke();
  }
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
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
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const x = human.cx + dx, y = human.cy + dy;
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
//   Touch: drag anywhere; the avatar heads the way your thumb points from
//          where it first touched (a floating joystick).
//   Mouse: the avatar heads toward the cursor.
//   Keys:  arrows / WASD, diagonals by holding two keys.
// ---------------------------------------------------------------------------
let controlMode = 'keys';
const joy = { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0 };
const mouse = { x: 0, y: 0 };
const held = new Set();

function steerHuman() {
  if (controlMode === 'mouse') {
    const dx = mouse.x - screenX(human.px), dy = mouse.y - screenY(human.py);
    if (Math.hypot(dx, dy) > cell) human.target = Math.atan2(dy, dx);
  } else if (controlMode === 'touch' && joy.active) {
    const dx = joy.x - joy.ox, dy = joy.y - joy.oy;
    if (Math.hypot(dx, dy) > 8) human.target = Math.atan2(dy, dx);
  }
}

const KEYS = {
  ArrowUp: 'u', KeyW: 'u', ArrowRight: 'r', KeyD: 'r',
  ArrowDown: 'd', KeyS: 'd', ArrowLeft: 'l', KeyA: 'l',
};
function applyKeys() {
  const dx = held.has('r') - held.has('l');
  const dy = held.has('d') - held.has('u');
  if ((dx || dy) && human && human.alive) {
    controlMode = 'keys';
    human.target = Math.atan2(dy, dx);
  }
}
window.addEventListener('keydown', e => {
  if (state === 'menu' && e.code === 'Enter') return startGame();
  if (!(e.code in KEYS)) return;
  held.add(KEYS[e.code]);
  if (state === 'playing') { applyKeys(); e.preventDefault(); }
});
window.addEventListener('keyup', e => {
  if (e.code in KEYS) held.delete(KEYS[e.code]);
});

window.addEventListener('pointermove', e => {
  if (e.pointerType !== 'mouse') return;
  mouse.x = e.clientX; mouse.y = e.clientY;
  if (state === 'playing') controlMode = 'mouse';
});

window.addEventListener('touchstart', e => {
  if (state !== 'playing' || joy.active) return;
  const t = e.changedTouches[0];
  joy.active = true;
  joy.id = t.identifier;
  joy.ox = joy.x = t.clientX;
  joy.oy = joy.y = t.clientY;
  controlMode = 'touch';
}, { passive: true });

window.addEventListener('touchmove', e => {
  if (!joy.active) return;
  for (const t of e.changedTouches) {
    if (t.identifier !== joy.id) continue;
    joy.x = t.clientX; joy.y = t.clientY;
    // Drag the joystick base along so reversing direction stays quick.
    const dx = joy.x - joy.ox, dy = joy.y - joy.oy;
    const len = Math.hypot(dx, dy);
    if (len > JOY_RADIUS) {
      joy.ox = joy.x - dx / len * JOY_RADIUS;
      joy.oy = joy.y - dy / len * JOY_RADIUS;
    }
  }
}, { passive: true });

function endTouch(e) {
  for (const t of e.changedTouches) if (t.identifier === joy.id) joy.active = false;
}
window.addEventListener('touchend', endTouch, { passive: true });
window.addEventListener('touchcancel', endTouch, { passive: true });

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------
function startGame() {
  const name = $('name').value.trim() || 'You';
  try { localStorage.setItem('pt-name', name); } catch (_) { /* ignore */ }
  if (!human) human = createPlayer(name, 210, false);
  human.name = name;
  spawnPlayer(human);
  cam.x = human.px; cam.y = human.py;
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
