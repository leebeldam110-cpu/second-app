'use strict';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const GRID = 200;            // world is a GRID x GRID grid of cells...
const CENTER = GRID / 2;
const ARENA_R = GRID / 2 - 1.5; // ...with a round arena inside it
const SPEED = 12;            // cells per second
const TURN_RATE = 7;         // max radians per second a head can turn
const SUBSTEP = 0.4;         // max distance moved per collision step (cells)
const BOT_COUNT = 10;
const START_RADIUS = 5;      // starting territory is a circle of this radius
const BOT_RESPAWN = 3;       // seconds before a dead bot comes back
const HEAD_SIZE = 2.2;       // avatar size in cells
const HOME_REACH = 1.5;      // how close (cells) the avatar's centre must be to its land to count as touching it (~its corner)
const JOY_RADIUS = 70;       // how far (px) the invisible touch joystick base trails your thumb
const BORDER_KILL_ANGLE = 0.2; // hitting the border within ~11° of straight-on kills
const TRAIL_HIT = 0.5;       // a head this close (cells) to a drawn trail line touches it
const SELF_SKIP = 4;         // newest trail points behind your own head that can't hurt you
const HOME_CLEARANCE = 2.5;  // how far (cells) from where you left before your land's edge counts as home
const WIN_PERCENT = 99.9;
const HARD_PERCENT = 60;     // owning this much of the arena switches on hard mode
const ULTRA_COUNT = 3;
const ULTRA_SPEED = 1.15;    // ultra-bots move this much faster than everyone else
const ULTRA_COLORS = {
  main: '#353a47', dark: '#181b22', trail: 'rgba(53,58,71,0.55)', rgb: [53, 58, 71],
};

const BOT_NAMES = [
  'Pixel', 'Zigzag', 'Blocky', 'Scribble', 'Inkwell', 'Origami', 'Crayon',
  'Doodle', 'Sketch', 'Papyrus', 'Confetti', 'Tetra', 'Marker', 'Quill',
  'Snippet', 'Folder', 'Stencil', 'Ruler',
];

const BOT_HUES = [0, 22, 42, 58, 90, 125, 150, 172, 250, 270, 290, 310, 330, 348];
const SKIN_HUES = [210, 0, 30, 52, 135, 172, 280, 325];
const SKIN_NAMES = ['Blue', 'Red', 'Orange', 'Yellow', 'Green', 'Teal', 'Purple', 'Pink'];
const PATTERNS = ['solid', 'stripes', 'dots', 'checks', 'waves'];

// ---------------------------------------------------------------------------
// World state
// ---------------------------------------------------------------------------
const owner = new Int32Array(GRID * GRID); // player id owning each cell (0 = none)
const trail = new Int32Array(GRID * GRID); // player id whose trail is on cell
const trailSeg = new Int32Array(GRID * GRID); // index into that player's trailPts near this cell
const inside = new Uint8Array(GRID * GRID); // 1 = cell is part of the arena
const areaCount = new Map();               // id -> number of owned cells
const byId = new Map();                    // id -> player
const players = [];
const ghosts = [];                         // fading land of eliminated players
const particles = [];
let nextId = 1;
let human = null;
let state = 'menu';                        // 'menu' | 'playing' | 'dead' | 'won'
let clock = 0;                             // game time in seconds (pauses with the tab)
let hardMode = false;                      // on once the player owns HARD_PERCENT of the arena

const idx = (x, y) => y * GRID + x;
const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const TAU = Math.PI * 2;

let ARENA_CELLS = 0;
for (let y = 0; y < GRID; y++) {
  for (let x = 0; x < GRID; x++) {
    if (Math.hypot(x + 0.5 - CENTER, y + 0.5 - CENTER) <= ARENA_R + 0.3) {
      inside[idx(x, y)] = 1;
      ARENA_CELLS++;
    }
  }
}
const inBounds = (x, y) =>
  x >= 0 && y >= 0 && x < GRID && y < GRID && inside[idx(x, y)] === 1;

function angleDiff(a, b) {
  let d = (a - b) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

// Players who lost land to someone else since the last split check.
const damaged = new Set();

function setOwner(i, id) {
  const old = owner[i];
  if (old === id) return;
  if (old && id) damaged.add(old);
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

// Ultra-bots are one team: they share a score and can't hurt each other.
const sameTeam = (a, b) => !!(a.ultra && b.ultra);

const hueGap = (a, b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));

// Pick a bot colour that is far from the player's and not already common.
function pickBotHue(self) {
  let best = BOT_HUES[0], bestScore = -Infinity;
  for (const h of BOT_HUES) {
    let score = Math.random();
    if (human && hueGap(h, human.hue) < 25) score -= 100;
    for (const o of players) if (o !== self && o.isBot && !o.ultra && o.alive && o.hue === h) score -= 10;
    if (score > bestScore) { bestScore = score; best = h; }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Players
// ---------------------------------------------------------------------------
function createPlayer(name, isBot) {
  const p = {
    id: 0, name, isBot, alive: false,
    ultra: false,          // member of the ultra-bot team (hard mode)
    hue: 0, colors: null, pattern: 'solid',
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

function findSpawn(r) {
  for (let attempt = 0; attempt < 300; attempt++) {
    const a = Math.random() * TAU;
    const d = Math.sqrt(Math.random()) * (ARENA_R - r - 8);
    const sx = Math.floor(CENTER + Math.cos(a) * d);
    const sy = Math.floor(CENTER + Math.sin(a) * d);
    if (areaIsFree(sx, sy, r + 3) && !players.some(o =>
      o.alive && Math.abs(o.cx - sx) + Math.abs(o.cy - sy) < 25)) return { sx, sy };
  }
  return null;
}

// Returns false if there is no room to spawn (bots then wait and retry).
function spawnPlayer(p) {
  const r = START_RADIUS;
  let spot = findSpawn(r);
  if (!spot) {
    if (p.isBot) return false;
    // The player must always get in: take any spot not on someone's trail.
    for (let attempt = 0; attempt < 500; attempt++) {
      const a = Math.random() * TAU;
      const d = Math.sqrt(Math.random()) * (ARENA_R - r - 2);
      const sx = Math.floor(CENTER + Math.cos(a) * d);
      const sy = Math.floor(CENTER + Math.sin(a) * d);
      if (areaIsFree(sx, sy, r, true)) { spot = { sx, sy }; break; }
    }
    if (!spot) spot = { sx: CENTER, sy: CENTER };
  }
  const { sx, sy } = spot;

  if (p.isBot && !p.ultra) {
    p.hue = pickBotHue(p);
    p.pattern = PATTERNS[rand(0, PATTERNS.length - 1)];
  }
  p.colors = p.ultra ? ULTRA_COLORS : makeColors(p.hue);
  p.id = nextId++;
  byId.set(p.id, p);
  areaCount.set(p.id, 0);
  p.alive = true;
  p.cx = sx; p.cy = sy;
  p.px = sx + 0.5; p.py = sy + 0.5;
  p.angle = Math.atan2(CENTER - sy, CENTER - sx) + (Math.random() - 0.5);
  p.target = p.angle;
  p.trail = [];
  p.trailPts = [];
  p.lastIn = { x: p.px, y: p.py };
  p.kills = 0;
  p.bestArea = 0;
  p.spawnTime = clock;
  p.box = { x0: sx - r, y0: sy - r, x1: sx + r, y1: sy + r };
  p.ai = { mode: 'idle', waypoints: [], maxTrail: 60, thinkIn: 0 };

  for (let y = sy - r; y <= sy + r; y++) {
    for (let x = sx - r; x <= sx + r; x++) {
      if ((x - sx) ** 2 + (y - sy) ** 2 > r * r + r) continue;
      if (!inBounds(x, y)) continue;
      const i = idx(x, y);
      if (trail[i]) continue;
      setOwner(i, p.id);
    }
  }
  // A fallback spawn may have landed on (and split) someone's territory.
  resolveSplits();
  eliminateLandless(null);
  return true;
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
  p.deathTime = clock;
  for (const i of p.trail) if (trail[i] === p.id) trail[i] = 0;
  p.trail = [];
  p.trailPts = [];
  const lost = [];
  for (let i = 0; i < owner.length; i++) {
    if (owner[i] === p.id) { owner[i] = 0; lost.push(i); }
  }
  ghosts.push({ cells: lost, color: p.colors.main, age: 0 });
  burst(p);
  areaCount.delete(p.id);
  byId.delete(p.id);

  if (killer && killer !== p && killer.alive) {
    killer.kills++;
    if (killer === human) toast(`You eliminated ${p.name}!`);
  }

  if (p === human) {
    joy.active = false;
    if (state === 'playing') {
      state = 'dead';
      setTimeout(() => showEnd(false, reason), 900);
    }
  } else {
    // In hard mode ordinary bots stay dead; ultra-bots keep coming back.
    p.respawnAt = hardMode && !p.ultra ? Infinity : clock + BOT_RESPAWN;
  }
}

// Called when a player returns to their own land with a trail.
function capture(p) {
  // Ultra-bots work together: a teammate's land is never taken and counts as
  // part of the wall when enclosing an area.
  const mates = new Set();
  for (const o of players) if (o.alive && o !== p && sameTeam(p, o)) mates.add(o.id);
  const ours = i => owner[i] === p.id || mates.has(owner[i]);

  for (const i of p.trail) {
    if (trail[i] === p.id) trail[i] = 0;
    if (!mates.has(owner[i])) setOwner(i, p.id);
  }
  p.trail = [];
  p.trailPts = [];

  // Flood fill from the edge of the bounding box; anything not reachable
  // without crossing this player's (or their team's) land is enclosed and
  // gets captured.
  const b = p.box;
  const x0 = Math.max(0, b.x0 - 1), y0 = Math.max(0, b.y0 - 1);
  const x1 = Math.min(GRID - 1, b.x1 + 1), y1 = Math.min(GRID - 1, b.y1 + 1);
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const seen = new Uint8Array(w * h);
  const stack = [];
  const visit = (x, y) => {
    const li = (y - y0) * w + (x - x0);
    if (seen[li] || ours(idx(x, y))) return;
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
      const i = idx(x, y);
      if (!seen[(y - y0) * w + (x - x0)] && inside[i] && !mates.has(owner[i])) setOwner(i, p.id);
    }
  }

  // Leaving a teammate's land untouched can leave this player's new land in
  // pieces, so their own land is checked too.
  if (p.ultra) damaged.add(p.id);
  resolveSplits();
  eliminateLandless(p);
}

// Each player's land must be one connected piece. For everyone who just lost
// land, keep their biggest piece and return any cut-off pieces to neutral.
const pieceMark = new Int32Array(GRID * GRID);
let pieceStamp = 0;
function resolveSplits() {
  for (const id of damaged) {
    const o = byId.get(id);
    if (o && o.alive) keepLargestPiece(o);
  }
  damaged.clear();
}

function keepLargestPiece(o) {
  // All of a player's land lies inside their bounding box (it only grows).
  const b = o.box;
  const x0 = Math.max(0, b.x0), y0 = Math.max(0, b.y0);
  const x1 = Math.min(GRID - 1, b.x1), y1 = Math.min(GRID - 1, b.y1);
  const stamp = ++pieceStamp;
  const pieces = [];
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const start = idx(x, y);
      if (owner[start] !== o.id || pieceMark[start] === stamp) continue;
      // Corner-touching cells count as connected, matching how land is drawn.
      const cells = [start];
      pieceMark[start] = stamp;
      for (let k = 0; k < cells.length; k++) {
        const cx = cells[k] % GRID, cy = (cells[k] / GRID) | 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = cx + dx, ny = cy + dy;
            if ((!dx && !dy) || nx < 0 || ny < 0 || nx >= GRID || ny >= GRID) continue;
            const ni = idx(nx, ny);
            if (owner[ni] !== o.id || pieceMark[ni] === stamp) continue;
            pieceMark[ni] = stamp;
            cells.push(ni);
          }
        }
      }
      pieces.push(cells);
    }
  }
  if (pieces.length < 2) return;

  // Keep the biggest piece; on a tie, keep the one the player is standing on.
  const headCell = idx(o.cx, o.cy);
  let keep = pieces[0];
  for (const piece of pieces) {
    if (piece.length > keep.length ||
        (piece.length === keep.length && piece.includes(headCell))) keep = piece;
  }
  for (const piece of pieces) {
    if (piece === keep) continue;
    for (const i of piece) setOwner(i, 0);
    ghosts.push({ cells: piece, color: o.colors.main, age: 0 });
  }
}

// Anyone whose land was completely swallowed is eliminated.
function eliminateLandless(by) {
  for (const o of players) {
    if (o.alive && o !== by && !areaCount.get(o.id)) {
      kill(o, by, `${by ? by.name : 'Someone'} took all of your land`);
    }
  }
}

// Is any of the player's land within the avatar's body (HOME_REACH of its centre)?
function touchesOwnLand(p) {
  const r = HOME_REACH;
  for (let y = Math.floor(p.py - r); y <= Math.floor(p.py + r); y++) {
    for (let x = Math.floor(p.px - r); x <= Math.floor(p.px + r); x++) {
      if (!inBounds(x, y) || owner[idx(x, y)] !== p.id) continue;
      const dx = Math.max(x - p.px, 0, p.px - (x + 1));
      const dy = Math.max(y - p.py, 0, p.py - (y + 1));
      if (dx * dx + dy * dy <= r * r) return true;
    }
  }
  return false;
}

// The head has moved into cell (x, y). Cells record where trails run (for
// capturing land and as a quick lookup); who dies is decided against the
// drawn trail lines in checkTrailHits.
function enterCell(p, x, y) {
  p.cx = x; p.cy = y;
  if (!inBounds(x, y)) return kill(p, null, 'You ran into the border');

  const i = idx(x, y);
  if (owner[i] === p.id) {
    if (p.trail.length) capture(p);
  } else if (trail[i] !== p.id) {
    // Two trails can share a cell without touching; the first one keeps the mark.
    if (!trail[i]) {
      trail[i] = p.id;
      trailSeg[i] = p.trailPts.length >> 1;
    }
    p.trail.push(i);
    growBox(p, x, y);
  }
}

// Distance from point (px,py) to segment (ax,ay)-(bx,by).
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
  let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}

// Does p's head touch o's drawn trail between points lo..hi (padded)? For your
// own trail, the newest stretch right behind the head is ignored.
function touchesTrailLine(p, o, lo, hi) {
  const pts = o.trailPts, last = (pts.length >> 1) - 1;
  if (last < 0) return false;
  const self = p === o;
  // Segment j runs from point j to point j+1; segment `last` runs to the head.
  const maxSeg = self ? last - SELF_SKIP - 1 : last;
  const from = Math.max(0, lo - 2), to = Math.min(maxSeg, hi + 2);
  for (let j = from; j <= to; j++) {
    const ax = pts[2 * j], ay = pts[2 * j + 1];
    const bx = j < last ? pts[2 * j + 2] : o.px, by = j < last ? pts[2 * j + 3] : o.py;
    if (segDist(p.px, p.py, ax, ay, bx, by) < TRAIL_HIT) return true;
  }
  return false;
}

// Check p's head against every trail near it.
const nearTrails = new Map();
function checkTrailHits(p) {
  nearTrails.clear();
  for (let y = p.cy - 1; y <= p.cy + 1; y++) {
    for (let x = p.cx - 1; x <= p.cx + 1; x++) {
      if (x < 0 || y < 0 || x >= GRID || y >= GRID) continue;
      const i = idx(x, y), t = trail[i];
      if (!t) continue;
      const r = nearTrails.get(t);
      if (r) { r.lo = Math.min(r.lo, trailSeg[i]); r.hi = Math.max(r.hi, trailSeg[i]); }
      else nearTrails.set(t, { lo: trailSeg[i], hi: trailSeg[i] });
    }
  }
  for (const [t, r] of nearTrails) {
    const o = byId.get(t);
    if (!o || !o.alive || !touchesTrailLine(p, o, r.lo, r.hi)) continue;
    if (o === p) {
      // The start of a trail hugs your land, so on a small loop the head can
      // touch it while the avatar is visibly back home: count that as home.
      if (touchesOwnLand(p)) capture(p);
      else kill(p, null, 'You crossed your own trail');
      return;
    }
    if (!sameTeam(p, o)) kill(o, p, `${p.name} cut your trail`);
  }
}

// Is any of the 8 cells around the head the player's own land?
function nextToOwnLand(p) {
  for (let y = p.cy - 1; y <= p.cy + 1; y++) {
    for (let x = p.cx - 1; x <= p.cx + 1; x++) {
      if (inBounds(x, y) && owner[idx(x, y)] === p.id) return true;
    }
  }
  return false;
}

function movePlayer(p, dt) {
  const turn = angleDiff(p.target, p.angle);
  const maxTurn = TURN_RATE * dt;
  p.angle += Math.max(-maxTurn, Math.min(maxTurn, turn));

  const limit = ARENA_R - 0.5;
  let dist = SPEED * (p.ultra ? ULTRA_SPEED : 1) * dt;
  while (dist > 0 && p.alive) {
    const step = Math.min(SUBSTEP, dist);
    dist -= step;
    const ox = p.px, oy = p.py;
    let nx = ox + Math.cos(p.angle) * step;
    let ny = oy + Math.sin(p.angle) * step;

    // Border: a head-on hit is fatal, a glancing one slides along the edge.
    const rx = nx - CENTER, ry = ny - CENTER;
    const r = Math.hypot(rx, ry);
    if (r > limit) {
      const outward = Math.atan2(ry, rx);
      if (Math.abs(angleDiff(p.angle, outward)) < BORDER_KILL_ANGLE) {
        kill(p, null, 'You ran into the border');
        break;
      }
      const t1 = outward + Math.PI / 2, t2 = outward - Math.PI / 2;
      p.angle = Math.abs(angleDiff(p.angle, t1)) < Math.abs(angleDiff(p.angle, t2)) ? t1 : t2;
      nx = ox + Math.cos(p.angle) * step;
      ny = oy + Math.sin(p.angle) * step;
      const k = limit / Math.hypot(nx - CENTER, ny - CENTER);
      if (k < 1) { nx = CENTER + (nx - CENTER) * k; ny = CENTER + (ny - CENTER) * k; }
    }
    p.px = nx; p.py = ny;

    const cx = Math.floor(nx), cy = Math.floor(ny);
    if (cx !== p.cx || cy !== p.cy) {
      if (cx !== p.cx && cy !== p.cy) {
        // Crossed a corner: visit the in-between cell first so trails stay
        // 4-connected and nobody can slip through a diagonal gap.
        const bx = cx > p.cx ? cx : p.cx;
        const by = cy > p.cy ? cy : p.cy;
        const tx = (bx - ox) / (nx - ox);
        const ty = (by - oy) / (ny - oy);
        if (tx < ty) enterCell(p, cx, p.cy);
        else enterCell(p, p.cx, cy);
        if (!p.alive) break;
      }
      enterCell(p, cx, cy);
    }
    if (!p.alive) break;

    checkTrailHits(p);
    if (!p.alive) break;

    // Coming back alongside your land counts as home once the avatar is over
    // its edge, as long as you're clear of the spot where you left.
    if (p.trail.length >= 3 && nextToOwnLand(p) &&
        Math.hypot(p.px - p.trailPts[0], p.py - p.trailPts[1]) > HOME_CLEARANCE) {
      capture(p);
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
      if (!B.alive || !A.alive || sameTeam(A, B)) continue;
      if ((A.px - B.px) ** 2 + (A.py - B.py) ** 2 > 1.4) continue;
      // Anyone without a trail out is home and safe.
      const aSafe = !A.trail.length;
      const bSafe = !B.trail.length;
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

// Distance along angle `a` until the border or own trail, or Infinity if clear.
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
  return { x: CENTER, y: CENTER };
}

function nearestEnemyTrail(p, r) {
  let best = null, bestD = Infinity;
  for (let y = p.cy - r; y <= p.cy + r; y++) {
    for (let x = p.cx - r; x <= p.cx + r; x++) {
      if (!inBounds(x, y)) continue;
      const t = trail[idx(x, y)];
      if (!t || t === p.id) continue;
      const o = byId.get(t);
      if (o && sameTeam(p, o)) continue;
      const d = Math.abs(x - p.cx) + Math.abs(y - p.cy);
      if (d < bestD) { bestD = d; best = { x, y }; }
    }
  }
  return best;
}

function enemyHeadDistance(p) {
  let best = Infinity;
  for (const o of players) {
    if (!o.alive || o === p || sameTeam(p, o)) continue;
    best = Math.min(best, Math.hypot(o.px - p.px, o.py - p.py));
  }
  return best;
}

function clampToArena(x, y) {
  const dx = x - CENTER, dy = y - CENTER;
  const d = Math.hypot(dx, dy), max = ARENA_R - 4;
  if (d > max) { x = CENTER + dx / d * max; y = CENTER + dy / d * max; }
  return { x: Math.floor(x), y: Math.floor(y) };
}

function planExcursion(p) {
  const area = areaCount.get(p.id) || 1;
  const reach = Math.sqrt(area) / 2 + rand(6, 18);
  const a0 = Math.random() * TAU;
  const side = a0 + (Math.random() < 0.5 ? 1 : -1) * (Math.PI / 2 + (Math.random() - 0.5) * 0.6);
  const a = clampToArena(p.px + Math.cos(a0) * reach, p.py + Math.sin(a0) * reach);
  const len = rand(6, 18);
  const b = clampToArena(a.x + Math.cos(side) * len, a.y + Math.sin(side) * len);
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
  clock += dt;
  if (human && human.alive) steerHuman();
  for (const p of players) {
    if (!p.alive) {
      if (p.isBot && clock >= p.respawnAt && !spawnPlayer(p)) p.respawnAt = clock + 1;
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
    const share = pct(human);
    human.bestArea = Math.max(human.bestArea, share);
    if (share >= HARD_PERCENT && !hardMode && state === 'playing') startHardMode();
    if (share >= WIN_PERCENT && state === 'playing') {
      state = 'won';
      showEnd(true);
    }
  }
}

// ---------------------------------------------------------------------------
// Hard mode: from HARD_PERCENT on, ordinary bots stop respawning and a team of
// faster ultra-bots joins (and keeps respawning).
// ---------------------------------------------------------------------------
function startHardMode() {
  hardMode = true;
  for (const b of players) if (b.isBot && !b.alive) b.respawnAt = Infinity;
  for (let i = 0; i < ULTRA_COUNT; i++) {
    const u = createPlayer('Ultra-bot', true);
    u.ultra = true;
    u.pattern = 'stripes';
    if (!spawnPlayer(u)) u.respawnAt = clock + 1; // no room yet: keep trying
  }
  $('stat-hard').hidden = false;
  toast('Hard mode! Ultra-bots have joined');
}

// A new game starts in normal mode: ultra-bots leave and the regular bots return.
function endHardMode() {
  hardMode = false;
  for (let i = players.length - 1; i >= 0; i--) {
    const b = players[i];
    if (!b.ultra) continue;
    kill(b, null);
    players.splice(i, 1);
  }
  for (const b of players) if (b.isBot && !b.alive) b.respawnAt = clock + Math.random() * 2;
  $('stat-hard').hidden = true;
}

// ---------------------------------------------------------------------------
// Effects
// ---------------------------------------------------------------------------
function burst(p) {
  for (let i = 0; i < 26; i++) {
    const a = Math.random() * TAU, v = 4 + Math.random() * 10;
    particles.push({
      x: p.px, y: p.py, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
      life: 0.6 + Math.random() * 0.5, age: 0,
      size: 0.4 + Math.random() * 0.7, spin: Math.random() * TAU,
      color: Math.random() < 0.5 ? p.colors.main : p.colors.dark,
    });
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
const cam = { x: CENTER, y: CENTER };

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

// Skin patterns are white overlays drawn on top of the player's colour.
const TILE = 32;
function drawPatternTile(g, type) {
  g.fillStyle = 'rgba(255,255,255,0.3)';
  g.strokeStyle = 'rgba(255,255,255,0.3)';
  if (type === 'stripes') {
    g.lineWidth = 7;
    for (let o = -TILE; o <= TILE; o += 16) {
      g.beginPath(); g.moveTo(o, TILE); g.lineTo(o + TILE, 0); g.stroke();
    }
  } else if (type === 'dots') {
    for (const [x, y] of [[8, 8], [24, 24]]) {
      g.beginPath(); g.arc(x, y, 4.5, 0, TAU); g.fill();
    }
  } else if (type === 'checks') {
    g.fillRect(0, 0, 16, 16); g.fillRect(16, 16, 16, 16);
  } else if (type === 'waves') {
    g.lineWidth = 4;
    for (const y0 of [8, 24]) {
      g.beginPath();
      for (let x = 0; x <= TILE; x++) {
        const y = y0 + Math.sin(x / TILE * TAU) * 4;
        x ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.stroke();
    }
  }
}
const patternCache = {};
function getPattern(type) {
  if (type === 'solid') return null;
  if (!patternCache[type]) {
    const c = document.createElement('canvas');
    c.width = c.height = TILE;
    drawPatternTile(c.getContext('2d'), type);
    patternCache[type] = ctx.createPattern(c, 'repeat');
  }
  return patternCache[type];
}

function cameraTarget() {
  if (human && (human.alive || state !== 'menu')) return human;
  const bot = players.find(p => p.alive);
  return bot || { px: CENTER, py: CENTER };
}

const screenX = x => viewW / 2 + (x - cam.x) * cell;
const screenY = y => viewH / 2 + (y - cam.y) * cell;

// Build one smooth outline per owner using marching squares over cell
// centres, so diagonal edges become slopes instead of staircases.
function buildTerritoryPaths(minX, minY, maxX, maxY) {
  const paths = new Map();
  const pathFor = id => {
    let path = paths.get(id);
    if (!path) { path = new Path2D(); paths.set(id, path); }
    return path;
  };
  const own = (x, y) => (x < 0 || y < 0 || x >= GRID || y >= GRID) ? 0 : owner[idx(x, y)];
  const h = cell / 2;

  for (let y = minY - 1; y <= maxY; y++) {
    let runId = 0, runStart = 0;
    const flush = end => {
      if (runId) pathFor(runId).rect(screenX(runStart + 0.5), screenY(y + 0.5), (end - runStart) * cell, cell);
      runId = 0;
    };
    for (let x = minX - 1; x <= maxX; x++) {
      const a = own(x, y), b = own(x + 1, y), c = own(x + 1, y + 1), d = own(x, y + 1);
      if (a && a === b && a === c && a === d) {
        if (runId !== a) { flush(x); runId = a; runStart = x; }
        continue;
      }
      flush(x);
      if (!a && !b && !c && !d) continue;
      const X = screenX(x + 0.5), Y = screenY(y + 0.5);
      const done = [];
      for (const id of [a, b, c, d]) {
        if (!id || done.includes(id)) continue;
        done.push(id);
        const tl = a === id, tr = b === id, br = c === id, bl = d === id;
        const path = pathFor(id);
        const pts = [];
        if (tl) pts.push(X, Y);
        if (tl !== tr) pts.push(X + h, Y);
        if (tr) pts.push(X + cell, Y);
        if (tr !== br) pts.push(X + cell, Y + h);
        if (br) pts.push(X + cell, Y + cell);
        if (br !== bl) pts.push(X + h, Y + cell);
        if (bl) pts.push(X, Y + cell);
        if (bl !== tl) pts.push(X, Y + h);
        path.moveTo(pts[0], pts[1]);
        for (let i = 2; i < pts.length; i += 2) path.lineTo(pts[i], pts[i + 1]);
        path.closePath();
      }
    }
    flush(maxX + 1);
  }
  return paths;
}

function render(dt) {
  const t = cameraTarget();
  const k = Math.min(1, dt * 8);
  cam.x += (t.px - cam.x) * k;
  cam.y += (t.py - cam.y) * k;

  // Outside the arena
  ctx.fillStyle = '#b9c4cf';
  ctx.fillRect(0, 0, viewW, viewH);

  const minX = Math.max(0, Math.floor(cam.x - viewW / 2 / cell) - 1);
  const minY = Math.max(0, Math.floor(cam.y - viewH / 2 / cell) - 2);
  const maxX = Math.min(GRID - 1, Math.ceil(cam.x + viewW / 2 / cell) + 1);
  const maxY = Math.min(GRID - 1, Math.ceil(cam.y + viewH / 2 / cell) + 1);

  // Round arena floor with a subtle checkerboard of 5x5-cell tiles
  const ax = screenX(CENTER), ay = screenY(CENTER), ar = ARENA_R * cell;
  ctx.fillStyle = '#9aa7b4';
  ctx.beginPath(); ctx.arc(ax, ay + Math.max(3, cell * 0.5), ar, 0, TAU); ctx.fill();
  ctx.save();
  ctx.beginPath(); ctx.arc(ax, ay, ar, 0, TAU);
  ctx.fillStyle = '#eef2f6';
  ctx.fill();
  ctx.clip();
  ctx.fillStyle = '#e4e9ef';
  const T = 5;
  for (let ty = Math.floor(minY / T); ty <= Math.floor(maxY / T); ty++) {
    for (let tx = Math.floor(minX / T); tx <= Math.floor(maxX / T); tx++) {
      if ((tx + ty) & 1) ctx.fillRect(screenX(tx * T), screenY(ty * T), T * cell, T * cell);
    }
  }
  ctx.restore();

  // Land of eliminated players fading out
  for (let g = ghosts.length - 1; g >= 0; g--) {
    const gh = ghosts[g];
    gh.age += dt;
    if (gh.age > 0.6) { ghosts.splice(g, 1); continue; }
    ctx.globalAlpha = 0.8 * (1 - gh.age / 0.6);
    ctx.fillStyle = gh.color;
    for (const i of gh.cells) {
      const x = i % GRID, y = (i / GRID) | 0;
      if (x < minX || x > maxX || y < minY || y > maxY) continue;
      ctx.fillRect(screenX(x), screenY(y), cell + 0.5, cell + 0.5);
    }
  }
  ctx.globalAlpha = 1;

  // Territory: dark "side" pass first, then the top face, to give depth.
  const depth = Math.max(3, cell * 0.5);
  // Both passes are clipped to the arena so land never overhangs its edge.
  const paths = buildTerritoryPaths(minX, minY, maxX, maxY);
  ctx.save();
  ctx.translate(0, depth);
  ctx.beginPath(); ctx.arc(ax, ay, ar, 0, TAU); ctx.clip();
  for (const [id, path] of paths) {
    const p = byId.get(id);
    if (!p) continue;
    ctx.fillStyle = p.colors.dark;
    ctx.fill(path);
  }
  ctx.restore();
  ctx.save();
  ctx.beginPath(); ctx.arc(ax, ay, ar, 0, TAU); ctx.clip();
  const patScale = (4 * cell) / TILE;
  const patMatrix = new DOMMatrix([patScale, 0, 0, patScale, screenX(0), screenY(0)]);
  for (const [id, path] of paths) {
    const p = byId.get(id);
    if (!p) continue;
    ctx.fillStyle = p.colors.main;
    ctx.fill(path);
    const pat = getPattern(p.pattern);
    if (pat) {
      pat.setTransform(patMatrix);
      ctx.fillStyle = pat;
      ctx.fill(path);
    }
  }
  ctx.restore();

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
    const pat = getPattern(p.pattern);
    if (pat) {
      pat.setTransform(new DOMMatrix([patScale * 0.6, 0, 0, patScale * 0.6, 0, 0]));
      ctx.fillStyle = pat;
      ctx.fill();
    }
    ctx.strokeStyle = p.ultra ? '#ff5a5a' : 'rgba(255,255,255,0.85)';
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

  // Death bursts
  for (let i = particles.length - 1; i >= 0; i--) {
    const q = particles[i];
    q.age += dt;
    if (q.age >= q.life) { particles.splice(i, 1); continue; }
    q.x += q.vx * dt; q.y += q.vy * dt;
    q.vx *= 1 - dt * 3; q.vy *= 1 - dt * 3;
    q.spin += dt * 6;
    const s = q.size * cell * (1 - q.age / q.life);
    ctx.save();
    ctx.translate(screenX(q.x), screenY(q.y));
    ctx.rotate(q.spin);
    ctx.fillStyle = q.color;
    ctx.fillRect(-s / 2, -s / 2, s, s);
    ctx.restore();
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
    const j = i * 4;
    if (!inside[i]) { d[j + 3] = 0; continue; }
    const id = trail[i] || owner[i];
    const p = id ? byId.get(id) : null;
    if (p) {
      d[j] = p.colors.rgb[0]; d[j + 1] = p.colors.rgb[1]; d[j + 2] = p.colors.rgb[2];
      d[j + 3] = trail[i] ? 130 : 255;
    } else {
      d[j] = d[j + 1] = d[j + 2] = 255; d[j + 3] = 90;
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
const statRank = $('stat-rank'), board = $('leaderboard'), feed = $('feed');

function pct(p) { return (areaCount.get(p.id) || 0) / ARENA_CELLS * 100; }

// Leaderboard entries: one per player, except the ultra-bots share one.
function standings() {
  const entries = [];
  let team = null;
  for (const p of players) {
    if (!p.ultra) {
      if (p.alive) entries.push({ name: p.name, color: p.colors.main, share: pct(p), player: p });
      continue;
    }
    if (!team) {
      team = { name: 'Ultra-bots', color: ULTRA_COLORS.main, share: 0, player: null };
      entries.push(team);
    }
    if (p.alive) team.share += pct(p);
  }
  return entries.sort((a, b) => b.share - a.share);
}

function updateHud() {
  const ranked = standings();
  const mine = ranked.find(e => e.player === human);
  if (human && human.alive) {
    statArea.textContent = pct(human).toFixed(2) + '%';
    statKills.textContent = `${human.kills} kill${human.kills === 1 ? '' : 's'}`;
    statRank.textContent = `Rank ${ranked.indexOf(mine) + 1} of ${ranked.length}`;
  }
  const top = ranked.slice(0, 5);
  if (mine && !top.includes(mine)) top.push(mine);
  board.innerHTML = '';
  for (const e of top) {
    const li = document.createElement('li');
    li.value = ranked.indexOf(e) + 1;
    if (e === mine) li.className = 'me';
    const swatch = document.createElement('i');
    swatch.style.background = e.color;
    li.appendChild(swatch);
    li.appendChild(document.createTextNode(e.name));
    const s = document.createElement('span');
    s.textContent = e.share.toFixed(1) + '%';
    li.appendChild(s);
    board.appendChild(li);
  }
}

function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  feed.appendChild(el);
  // Keep at most three messages on screen so they don't cover the action.
  while (feed.children.length > 3) feed.firstChild.remove();
  setTimeout(() => el.remove(), 2300);
}

function loadBest() {
  try { return parseFloat(localStorage.getItem('pt-best')) || 0; } catch (_) { return 0; }
}
function showBest() {
  const best = loadBest();
  $('best').textContent = best ? `Your best: ${best.toFixed(2)}%` : '';
}

function showEnd(won, reason) {
  const best = loadBest();
  if (human.bestArea > best) {
    try { localStorage.setItem('pt-best', String(human.bestArea)); } catch (_) { /* ignore */ }
  }
  $('end-title').textContent = won ? 'Arena conquered!' : 'You died!';
  $('death-reason').textContent = won ? 'You own the whole map.' : (reason || '');
  $('res-area').textContent = human.bestArea.toFixed(2) + '%';
  $('res-kills').textContent = human.kills;
  const endTime = won ? clock : human.deathTime;
  $('res-time').textContent = Math.round(endTime - human.spawnTime) + 's';
  $('new-best').hidden = !(human.bestArea > best && human.bestArea > 0);
  hud.classList.add('hidden');
  mini.classList.add('hidden');
  $('gameover').classList.remove('hidden');
}

// ---------------------------------------------------------------------------
// Skin picker
// ---------------------------------------------------------------------------
const skin = { hue: SKIN_HUES[0], pattern: 'solid' };
try {
  const saved = JSON.parse(localStorage.getItem('pt-skin') || 'null');
  if (saved && SKIN_HUES.includes(saved.hue) && PATTERNS.includes(saved.pattern)) Object.assign(skin, saved);
} catch (_) { /* ignore */ }

function buildSkinPicker() {
  const colors = $('colors'), pats = $('patterns');
  colors.innerHTML = '';
  pats.innerHTML = '';
  for (const hue of SKIN_HUES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'swatch' + (hue === skin.hue ? ' on' : '');
    b.style.background = `hsl(${hue},72%,56%)`;
    b.setAttribute('aria-label', SKIN_NAMES[SKIN_HUES.indexOf(hue)]);
    b.addEventListener('click', () => { skin.hue = hue; saveSkin(); buildSkinPicker(); });
    colors.appendChild(b);
  }
  for (const type of PATTERNS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pattern' + (type === skin.pattern ? ' on' : '');
    b.setAttribute('aria-label', `${type} pattern`);
    const c = document.createElement('canvas');
    c.width = c.height = TILE * 1.5;
    const g = c.getContext('2d');
    g.fillStyle = `hsl(${skin.hue},72%,56%)`;
    g.fillRect(0, 0, c.width, c.height);
    if (type !== 'solid') {
      const tile = document.createElement('canvas');
      tile.width = tile.height = TILE;
      drawPatternTile(tile.getContext('2d'), type);
      g.fillStyle = g.createPattern(tile, 'repeat');
      g.fillRect(0, 0, c.width, c.height);
    }
    b.appendChild(c);
    b.addEventListener('click', () => { skin.pattern = type; saveSkin(); buildSkinPicker(); });
    pats.appendChild(b);
  }
}
function saveSkin() {
  try { localStorage.setItem('pt-skin', JSON.stringify(skin)); } catch (_) { /* ignore */ }
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
  // A focused button already starts the game on Enter via its click event.
  if (state === 'menu' && e.code === 'Enter' && e.target.tagName !== 'BUTTON') return startGame();
  if (!(e.code in KEYS)) return;
  held.add(KEYS[e.code]);
  if (state === 'playing') { applyKeys(); e.preventDefault(); }
});
window.addEventListener('keyup', e => {
  if (e.code in KEYS) held.delete(KEYS[e.code]);
});
// Key-ups are lost while the window is unfocused, so forget held keys.
window.addEventListener('blur', () => held.clear());

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
  if (state === 'playing') return;
  // Close the on-screen keyboard if the name field still has focus.
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  const name = $('name').value.trim() || 'You';
  try { localStorage.setItem('pt-name', name); } catch (_) { /* ignore */ }
  removeHuman();
  if (hardMode) endHardMode();
  if (!human) human = createPlayer(name, false);
  human.name = name;
  human.hue = skin.hue;
  human.pattern = skin.pattern;
  // Repaint any bot that looks too much like the player's chosen colour.
  for (const b of players) {
    if (b.isBot && !b.ultra && b.alive && hueGap(b.hue, human.hue) < 25) {
      b.hue = pickBotHue(b);
      b.colors = makeColors(b.hue);
    }
  }
  spawnPlayer(human);
  cam.x = human.px; cam.y = human.py;
  state = 'playing';
  $('menu').classList.add('hidden');
  $('gameover').classList.add('hidden');
  hud.classList.remove('hidden');
  mini.classList.remove('hidden');
  updateHud();
}

// Take the player off the map without a death screen (after a win, or a restart).
function removeHuman() {
  if (!human || !human.alive) return;
  const prev = state;
  state = 'menu';
  kill(human, null);
  state = prev;
}

function backToMenu() {
  state = 'menu';
  removeHuman();
  $('gameover').classList.add('hidden');
  showBest();
  buildSkinPicker();
  $('menu').classList.remove('hidden');
}

$('play').addEventListener('click', startGame);
$('again').addEventListener('click', startGame);
$('to-menu').addEventListener('click', backToMenu);
try { $('name').value = localStorage.getItem('pt-name') || ''; } catch (_) { /* ignore */ }
buildSkinPicker();
showBest();

const names = BOT_NAMES.slice().sort(() => Math.random() - 0.5);
for (let i = 0; i < BOT_COUNT; i++) {
  spawnPlayer(createPlayer(names[i % names.length], true));
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
