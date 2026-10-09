/* The Eze'Rhi'El — game engine. Pure logic, no DOM: runs in the browser and in Node (tools/sim.js). */
(function (root) {
  'use strict';
  const EZ = (root.EZ = root.EZ || {});
  const L = (s, store, id) => EZ.L(s, store, id);
  const D = () => EZ.DATA;
  const SAVE_KEY = 'ezerhiel-drpg-save-v1';

  /* ================= state ================= */
  EZ.newState = function () {
    const now = Date.now();
    return {
      v: 1, created: now, lastSave: now, lastTick: now,
      settings: { notation: 'suffix', particles: true, confirm: true, autosave: true },
      embers: 0, embersLife: 0, embersTitle: 0, embersTotal: 0,
      stokesTotal: 0, lifeTime: 0, titleTime: 0, burnTime: 0, cutTime: 0, playTime: 0,
      gens: {}, ups: {},
      whisper: { next: 75, active: null, seen: 0, clicked: 0 },
      buffs: [],
      // tier 1 — regeneration
      ash: 0, ashCycle: 0, ashEarned: 0, ashTotal: 0, regens: 0, regensTotal: 0, tree: {},
      ghosts: { n: 0, pct: { stoke: 30, ward: 20, fight: 50 } },
      arms: {},
      tourney: freshTourney(0),
      sigils: 0, sigilsTotal: 0, sigilRecord: 0,
      // tier 2 — the title
      slivers: 0, sliversCycle: 0, sliversTotal: 0, titles: 0, titlesTotal: 0, shop2: {},
      shades: {}, wrath: 0, cds: {},
      artron: 0, artronTotal: 0, fronts: { n: [0, 0, 0, 0, 0], b: [0, 0, 0, 0, 0] }, roar: 0,
      // tier 3 — burnt timelines
      paradox: 0, paradoxCycle: 0, burns: 0, burnsTotal: 0, shop3: {},
      chal: null, chalRegens: 0, chalDone: {},
      siege: freshSiege(0), engines: {}, grace: 0, graceTotal: 0,
      // tier 4 — the cage
      nightmare: 0, nightmareCycle: 0, cuts: 0, cutsTotal: 0, shop4: {},
      hunt: { progress: 0 }, lumen: 0,
      // finale
      cataclysms: 0,
      omens: {}, rank: 0, log: [], flags: { story: {}, seenGen: 0 }, misc: {},
    };
  };

  function freshTourney(bestEver) {
    return { bout: 1, enemyHp: -1, alive: false, squad: 0, hpFrac: 1, regroup: 0, best: 0, bestEver: bestEver || 0, lastProgress: 0 };
  }
  function freshSiege(bestChoir) { return { choir: 0, ward: -1, bestChoir: bestChoir || 0 }; }

  /* ================= unlock checks ================= */
  EZ.has = {
    regen: (s) => s.regensTotal > 0 || s.embersLife >= D().REQ.regen * 0.1,
    tree: (s) => s.regensTotal > 0,
    crack: (s) => L(s, 'tree', 'crack') > 0,
    tourney: (s) => L(s, 'tree', 'herald') > 0,
    title: (s) => s.titlesTotal > 0 || s.sigilsTotal > 0,
    shop2: (s) => s.titlesTotal > 0,
    shades: (s) => s.titlesTotal > 0,
    timewar: (s) => s.titlesTotal > 0,
    grimoire: (s) => s.titlesTotal >= 2,
    burn: (s) => s.burnsTotal > 0 || s.artronTotal >= D().REQ.burn * 1e-3,
    timelines: (s) => s.burnsTotal > 0,
    siege: (s) => s.burnsTotal > 0,
    cut: (s) => s.cutsTotal > 0 || s.graceTotal > 0,
    hunt: (s) => s.cutsTotal > 0,
    door: (s) => s.lumen >= 6 || s.cataclysms > 0,
  };

  /* ================= derived numbers ================= */
  EZ.C = {}; // per-tick cache, read by the UI

  EZ.riteBase = (s) => (s.chalDone.position ? 2.2 : 2);
  EZ.genGrowth = function (s) {
    if (s.chal === 'abyss') return 1.25;
    return 1.15 - 0.005 * L(s, 'tree', 'patient') - (s.chalDone.abyss ? 0.01 : 0);
  };
  EZ.totalGens = (s) => D().gens.reduce((a, g) => a + L(s, 'gens', g.id), 0);

  EZ.genProd = function (s, g, totalGens) {
    let p = g.prod * Math.pow(EZ.riteBase(s), L(s, 'ups', 'rite_' + g.id));
    const legion = L(s, 'ups', 'legion');
    if (legion) p *= 1 + 0.0025 * legion * (totalGens === undefined ? EZ.totalGens(s) : totalGens);
    if (g.idx >= 6 && s.chalDone.depths) p *= 10;
    return p;
  };

  EZ.omenCount = (s) => Object.keys(s.omens).length;
  /** Ghost stokers: +2% each up to 100, then square-root diminishing returns. */
  EZ.stokerMult = (n) => (n <= 100 ? 1 + 0.02 * n : 3 * Math.sqrt(n / 100));
  EZ.jobs = function (s) {
    const n = Math.floor(s.ghosts.n), p = s.ghosts.pct;
    return { stoke: Math.floor(n * p.stoke / 100), ward: Math.floor(n * p.ward / 100), fight: Math.floor(n * p.fight / 100) };
  };

  EZ.buffMult = function (s, kind) {
    let m = 1;
    for (const b of s.buffs) if (b.kind === kind) m *= b.mult;
    return m;
  };

  /** Every multiplier on ember production, for the ledger. */
  EZ.emberMults = function (s) {
    const out = [];
    const add = (name, v) => { if (v !== 1 && isFinite(v)) out.push([name, v]); };
    add('Condemned Fate', Math.pow(1.25, L(s, 'ups', 'condemned')));
    add('Ash earned this Title', 1 + 0.05 * s.ashCycle);
    add('Ash in the Lungs', Math.pow(1.6, L(s, 'tree', 'lungs')));
    add('Omens', 1 + 0.02 * EZ.omenCount(s));
    add('Rank in the Hierarchy', Math.pow(1.15, s.rank));
    if (EZ.has.crack(s)) add('Ghost stokers', EZ.stokerMult(EZ.jobs(s).stoke));
    add('Slivers earned', 1 + s.sliversCycle);
    add('The Title’s Weight', Math.pow(2, L(s, 'shop2', 'weight')));
    add('Artron held', Math.pow(1 + EZ.log10(1 + s.artron), 2));
    add('Paradox earned', Math.pow(1 + s.paradoxCycle, 1.5));
    add('Scorched Moments', Math.pow(5, L(s, 'shop3', 'scorch')));
    add('The Child’s Hunger', Math.pow(10, L(s, 'shop4', 'hunger')));
    add('Nightmare earned', Math.pow(1 + s.nightmareCycle, 1.5));
    if (s.lumen >= 1) add('Captain Jack extinguished', 10);
    add('Cataclysms', Math.pow(1000, s.cataclysms));
    if (s.chalDone.fronts) add('A War on Two Fronts', Math.pow(1.15, Math.floor(s.tourney.best / 10)));
    if (s.chal === 'fronts') add('Burning: A War on Two Fronts', Math.pow(0.5, Math.floor(s.tourney.best / 10)));
    add('Whispered & cast boons', EZ.buffMult(s, 'eps'));
    return out;
  };

  EZ.squadMult = function (s) {
    return Math.pow(1.5, L(s, 'tree', 'unborn')) * Math.pow(2, L(s, 'shop2', 'disgust')) *
      Math.pow(10, L(s, 'shop4', 'army')) * (s.lumen >= 3 ? 100 : 1);
  };
  EZ.squadAtkPer = function (s) {
    let a = Math.pow(1.3, L(s, 'arms', 'blade')) * Math.pow(2, L(s, 'arms', 'eternal')) * EZ.squadMult(s);
    if (s.chal === 'dagger') a *= 0.1;
    if (s.chalDone.dagger) a *= 5;
    return a;
  };
  EZ.squadHpPer = (s) => 10 * Math.pow(1.3, L(s, 'arms', 'mail')) * Math.pow(2, L(s, 'arms', 'skullward')) * EZ.squadMult(s);
  EZ.isChampion = (b) => b % 10 === 0;
  EZ.enemyHp = (b) => 25 * Math.pow(1.19, b - 1) * (EZ.isChampion(b) ? 5 : 1);
  EZ.enemyAtk = (b) => 2 * Math.pow(1.17, b - 1) * (EZ.isChampion(b) ? 1.6 : 1);
  EZ.enemyName = function (b) {
    const d = D();
    if (EZ.isChampion(b)) {
      const i = b / 10 - 1;
      return i < d.champions.length ? d.champions[i] : 'Echo of ' + d.champions[i % d.champions.length];
    }
    return d.enemies[(b * 7 + Math.floor(b / 10) * 3) % d.enemies.length];
  };
  EZ.sigilsFor = function (s, b) {
    return Math.pow(1.25, L(s, 'tree', 'favour')) *
      Math.pow(1.5, L(s, 'shop2', 'sigil')) * Math.pow(1.5, L(s, 'shop3', 'rigged'));
  };

  EZ.ghostCap = function (s) {
    return (20 + 6 * L(s, 'arms', 'haunt')) * (1 + 0.3 * L(s, 'tree', 'hollow')) *
      Math.pow(1.5, L(s, 'shop2', 'spawn')) * (s.chalDone.grind ? 2 : 1);
  };
  EZ.ghostRate = function (s) {
    const j = EZ.jobs(s);
    return (0.5 + 0.04 * s.ghosts.n) * Math.pow(1.5, L(s, 'tree', 'fecund')) * Math.pow(2, L(s, 'shop2', 'spawn')) *
      (1 + 0.03 * j.ward) * (s.chalDone.grind ? 3 : 1) * (s.chal === 'grind' ? 0.1 : 1);
  };

  EZ.artronMult = function (s) {
    return Math.pow(1.4, s.roar) * Math.pow(2, L(s, 'shop2', 'artronc')) * Math.pow(3, L(s, 'shop3', 'engine')) *
      (1 + s.paradoxCycle) * Math.pow(10, L(s, 'shop4', 'hunger')) * (s.lumen >= 2 ? 10 : 1) *
      Math.sqrt(1 + s.sliversCycle) * (1 + EZ.log10(1 + s.embersTitle) / 10);
  };
  /* The Artron multiplier only touches the first front's output; higher fronts build lower ones. */
  EZ.frontProd = (s, i) => D().fronts[i].prod * Math.pow(2, Math.floor(s.fronts.b[i] / 10)) * (i === 0 ? EZ.artronMult(s) : 1);

  EZ.wardMax = (c) => 1e6 * Math.pow(12, c);
  EZ.siegeDps = function (s) {
    const ram = L(s, 'engines', 'ram');
    if (!ram) return 0;
    return 1000 * ram * Math.pow(1.5, L(s, 'engines', 'mortar')) * Math.pow(3, L(s, 'shop3', 'siegecraft')) *
      (L(s, 'engines', 'ladder') ? 1 + EZ.ghostCap(s) / 40 : 1) *
      (L(s, 'engines', 'bluefire') ? 1 + s.paradoxCycle : 1) * (s.lumen >= 4 ? 10 : 1) *
      Math.pow(1 + s.nightmareCycle, 2) * (1 + EZ.log10(1 + s.artron) / 5);
  };
  EZ.wardRegen = (s, c) => 0.04 * Math.pow(0.85, L(s, 'engines', 'sapper')) * EZ.wardMax(c);

  EZ.huntPower = function (s) {
    return Math.pow(3, L(s, 'shop4', 'moriarty')) * Math.pow(1 + s.nightmareCycle, 2) *
      Math.max(1, EZ.log10(1 + s.embers)) * Math.max(1, EZ.log10(1 + s.artron)) / 10;
  };

  EZ.wrathMax = (s) => 100 + 25 * L(s, 'shop2', 'well');
  EZ.wrathRegen = (s) => Math.pow(1.25, L(s, 'shop2', 'well'));

  EZ.whisperInterval = function (s) {
    let t = EZ.rand(90, 210) * Math.pow(0.88, L(s, 'ups', 'focused')) * Math.pow(0.85, L(s, 'tree', 'lean'));
    if (s.chalDone.shadows) t *= 0.67;
    return t;
  };

  EZ.autoStokeRate = function (s) {
    if (s.chal === 'glass') return 0;
    let r = L(s, 'tree', 'restless') + (shadeOn(s, 'stoker') ? 10 : 0);
    return r * (s.chalDone.glass ? 3 : 1);
  };

  /** Recompute the per-tick cache. */
  EZ.calc = function (s) {
    const C = EZ.C;
    const tg = EZ.totalGens(s);
    let raw = 0;
    C.genProd = {};
    for (const g of D().gens) {
      const p = EZ.genProd(s, g, tg);
      C.genProd[g.id] = p;
      raw += p * L(s, 'gens', g.id);
    }
    const mults = EZ.emberMults(s);
    let mult = 1;
    for (const m of mults) mult *= m[1];
    let eps = raw * mult;
    if (s.chal === 'tale') eps = Math.sqrt(eps);
    if (s.chalDone.tale && eps > 1) eps = Math.pow(eps, 1.03);
    C.raw = raw; C.mult = mult; C.mults = mults; C.eps = eps; C.totalGens = tg;
    // eps without temporary boons, for Soul Torment & whispers
    const bm = EZ.buffMult(s, 'eps');
    C.epsBase = bm > 0 ? eps / bm : eps;
    C.clickBase = Math.pow(2, L(s, 'ups', 'pyric')) * Math.pow(3, L(s, 'tree', 'hands')) * (s.chalDone.glass ? 10 : 1);
    C.click = C.clickBase * EZ.buffMult(s, 'click') + eps * 0.01 * L(s, 'ups', 'untempered');
    C.autoStoke = EZ.autoStokeRate(s);
    return C;
  };

  /* ================= generic purchasing ================= */
  EZ.defMax = (s, d) => (typeof d.max === 'function' ? d.max(s) : d.max);
  EZ.isVisible = (s, d) => !d.visible || d.visible(s);

  /** Can this definition be bought right now? Returns '' if yes, otherwise a reason. */
  EZ.blocked = function (s, d) {
    const l = d.level(s);
    if (l >= EZ.defMax(s, d)) return 'max';
    if (d.gate && !d.gate(s, l)) return d.gateText ? d.gateText(s, l) : 'locked';
    if (d.store === 'ups' && s.chal === 'position' && d.id.startsWith('rite_')) return 'Forbidden in this timeline';
    if (!(s[d.cur] >= d.cost(s, l))) return 'poor';
    return '';
  };

  EZ.buy = function (s, d, mode) {
    const limit = mode === 'max' ? 100000 : (typeof mode === 'number' ? mode : 1);
    let bought = 0;
    while (bought < limit) {
      if (EZ.blocked(s, d)) break;
      const l = d.level(s);
      const c = d.cost(s, l);
      s[d.cur] -= c;
      if (d.set) d.set(s, l + 1); else s[d.store][d.id] = l + 1;
      bought++;
    }
    if (bought) afterBuy(s, d);
    return bought;
  };

  function afterBuy(s, d) {
    if (d.store === 'gens') s.flags.seenGen = Math.max(s.flags.seenGen, d.idx + 1);
    if (d.store === 'tree' && d.id === 'herald' && s.tourney.enemyHp < 0) s.tourney.enemyHp = EZ.enemyHp(1);
  }

  /* Kindlings use the generic buyer with state-dependent prices. */
  function prepGens() {
    D().gens.forEach((g) => {
      if (g._prepped) return;
      g._prepped = true;
      g.level = (s) => L(s, 'gens', g.id);
      g.cost = (s, l) => g.base * Math.pow(EZ.genGrowth(s), l);
      g.max = Infinity;
      g.gate = (s) => !(s.chal === 'depths' && g.idx >= 6) && (!g.req || g.req(s));
      g.gateText = (s) => (s.chal === 'depths' && g.idx >= 6) ? 'Does not exist in this timeline' : g.reqText;
      g.visible = (s) => (g.idx <= s.flags.seenGen || L(s, 'gens', g.id) > 0 || s.embersLife >= g.base * 0.4) && (!g.req || g.req(s));
    });
  }

  /* ================= actions ================= */
  EZ.stoke = function (s, n) {
    if (s.chal === 'glass') return 0;
    n = n || 1;
    const v = EZ.C.click * n;
    gain(s, v);
    s.stokesTotal += n;
    return v;
  };

  const CAP = 1e300;
  function gain(s, v) {
    if (!(v > 0)) return;
    if (v > CAP) v = CAP;
    s.embers += v; s.embersLife += v; s.embersTitle += v; s.embersTotal += v;
  }

  EZ.clickWhisper = function (s) {
    const w = s.whisper.active;
    if (!w) return null;
    s.whisper.active = null;
    s.whisper.clicked++;
    const power = s.chalDone.shadows ? 2 : 1;
    const durMul = 1 + 0.15 * L(s, 'ups', 'migrating');
    const r = Math.random();
    let msg, note;
    if (r < 0.5) {
      addBuff(s, { id: 'frenzy', name: 'Kindled Frenzy', kind: 'eps', mult: 7 * power, dur: 77 * durMul });
      msg = 'Kindled Frenzy! Ember production ×' + 7 * power + ' for ' + Math.round(77 * durMul) + 's.';
      note = 'a kindled frenzy: embers ×' + 7 * power + ' for ' + Math.round(77 * durMul) + 's.';
    } else if (r < 0.9) {
      const v = (Math.min(s.embers * 0.15, EZ.C.epsBase * 900) + 13) * power;
      gain(s, v);
      msg = 'Ash-fall Fortune! +' + EZ.fmt(v) + ' embers.';
      note = 'ash falls like fortune: +' + EZ.fmt(v) + ' embers.';
    } else {
      addBuff(s, { id: 'touch', name: 'Hellfire Touch', kind: 'click', mult: 777 * power, dur: 13 * durMul });
      msg = 'Hellfire Touch! Stokes ×' + 777 * power + ' for ' + Math.round(13 * durMul) + 's.';
      note = 'a hellfire touch: stokes ×' + 777 * power + ' for ' + Math.round(13 * durMul) + 's.';
    }
    EZ.log(s, 'the eye blinks. ' + note, 'whisper');
    return msg;
  };

  function addBuff(s, b) {
    const ex = s.buffs.find((x) => x.id === b.id);
    if (ex) { ex.t = Math.max(ex.t, b.dur); ex.dur = b.dur; ex.mult = b.mult; return; }
    b.t = b.dur;
    s.buffs.push(b);
  }

  EZ.setJobPct = function (s, job, value) {
    const p = s.ghosts.pct;
    value = EZ.clamp(Math.round(value), 0, 100);
    const others = Object.keys(p).filter((k) => k !== job);
    p[job] = value;
    let over = others.reduce((a, k) => a + p[k], 0) + value - 100;
    for (const k of others) {
      if (over <= 0) break;
      const cut = Math.min(p[k], over);
      p[k] -= cut; over -= cut;
    }
  };

  EZ.sendSquad = function (s, force) {
    const t = s.tourney;
    if (t.alive || !EZ.has.tourney(s)) return false;
    const size = EZ.jobs(s).fight;
    if (size < 1) return false;
    if (!force && s.ghosts.n < EZ.ghostCap(s) * 0.9) return false;
    if (t.enemyHp < 0) t.enemyHp = EZ.enemyHp(t.bout);
    t.alive = true; t.squad = size; t.hpFrac = 1; t.regroup = 0;
    return true;
  };

  EZ.cast = function (s, id) {
    const sp = D().spells.find((x) => x.id === id);
    if (!sp || !EZ.has.grimoire(s)) return false;
    if ((s.cds[id] || 0) > 0 || s.wrath < sp.cost) return false;
    const t = s.tourney;
    switch (id) {
      case 'breath': addBuff(s, { id: 'breath', name: 'Breath of Hellfire', kind: 'eps', mult: 10, dur: sp.dur }); break;
      case 'manip': addBuff(s, { id: 'manip', name: 'Hellfire Manipulation', kind: 'click', mult: 100, dur: sp.dur }); break;
      case 'torment': gain(s, EZ.C.epsBase * 600); break;
      case 'hellspawn':
        if (!EZ.has.crack(s)) return false;
        s.ghosts.n = Math.min(EZ.ghostCap(s), s.ghosts.n + EZ.ghostCap(s) * 0.25); break;
      case 'amputate':
        if (!t.alive || t.enemyHp <= 0) return false;
        t.enemyHp *= EZ.isChampion(t.bout) ? 0.75 : 0.5; break;
      case 'resurrect':
        if (!EZ.has.tourney(s)) return false;
        if (t.alive) t.hpFrac = 1;
        else {
          const size = Math.max(1, EZ.jobs(s).fight);
          if (t.enemyHp < 0) t.enemyHp = EZ.enemyHp(t.bout);
          t.alive = true; t.squad = size; t.hpFrac = 1; t.regroup = 0;
        }
        break;
      case 'portal':
        if (s.chal === 'shadows') return false;
        spawnWhisper(s); break;
    }
    s.wrath -= sp.cost;
    s.cds[id] = sp.cd;
    return true;
  };

  /* ================= ascension ================= */
  /* Each layer pays out (what this cycle's record is worth) minus (what it has already paid),
   * so resetting early gives nothing and only new progress is rewarded. */
  EZ.ashPossible = (s) => 12 * Math.cbrt(s.embersTitle / D().REQ.regen) *
    Math.pow(1.25, L(s, 'tree', 'energy')) * Math.pow(2, L(s, 'shop2', 'conduit'));
  EZ.ashGain = function (s) {
    if (s.embersLife < D().REQ.regen) return 0;
    return Math.max(0, Math.floor(EZ.ashPossible(s) - s.ashEarned));
  };
  EZ.canRegen = (s) => s.embersLife >= D().REQ.regen;
  EZ.regenerate = function (s) {
    if (!EZ.canRegen(s)) return 0;
    const g = EZ.ashGain(s);
    s.ash += g; s.ashCycle += g; s.ashTotal += g; s.ashEarned += g;
    s.regens++; s.regensTotal++;
    if (s.chal) s.chalRegens++;
    resetLife(s);
    EZ.log(s, 'you regenerate. +' + EZ.fmt(g) + ' ash. (regeneration ' + s.regensTotal + ')', 'ascend');
    return g;
  };

  EZ.sliverPossible = (s) => 3 * Math.pow(s.sigils / D().REQ.title, 1.3) * Math.pow(2, L(s, 'shop3', 'recursion'));
  EZ.sliverGain = function (s) {
    if (s.sigils < D().REQ.title) return 0;
    return Math.max(0, Math.floor(EZ.sliverPossible(s) - s.sliversCycle));
  };
  EZ.canTitle = (s) => !s.chal && s.sigils >= D().REQ.title && EZ.sliverGain(s) >= 1;
  EZ.claimTitle = function (s) {
    if (!EZ.canTitle(s)) return 0;
    const g = EZ.sliverGain(s);
    s.slivers += g; s.sliversCycle += g; s.sliversTotal += g;
    s.titles++; s.titlesTotal++;
    if (s.titlesTotal === 1 && s.artron < 10) s.artron = 10;
    resetTitle(s);
    EZ.log(s, 'the title is yours. +' + EZ.fmt(g) + ' slivers of the child. (title ' + s.titlesTotal + ')', 'ascend');
    return g;
  };

  EZ.paradoxPossible = (s) => s.artron < 1 ? 0 : 3 * Math.pow(2, (Math.log10(s.artron) - 15) / 2) *
    Math.pow(2, L(s, 'shop4', 'widens')) * (s.lumen >= 5 ? 3 : 1);
  EZ.paradoxGain = function (s) {
    if (s.artron < D().REQ.burn) return 0;
    return Math.max(0, Math.floor(EZ.paradoxPossible(s) - s.paradoxCycle));
  };
  EZ.canBurn = (s) => !s.chal && s.artron >= D().REQ.burn && EZ.paradoxGain(s) >= 1;
  EZ.burn = function (s) {
    if (!EZ.canBurn(s)) return 0;
    const g = EZ.paradoxGain(s);
    s.paradox += g; s.paradoxCycle += g;
    s.burns++; s.burnsTotal++;
    resetBurn(s);
    EZ.log(s, 'a timeline burns. +' + EZ.fmt(g) + ' paradox. (timeline ' + s.burnsTotal + ')', 'ascend');
    return g;
  };

  EZ.nightmarePossible = (s) => 5 * Math.pow(s.grace / D().REQ.cut, 1.2) * (s.lumen >= 6 ? 3 : 1);
  EZ.nightmareGain = function (s) {
    if (s.grace < D().REQ.cut) return 0;
    return Math.max(0, Math.floor(EZ.nightmarePossible(s) - s.nightmareCycle));
  };
  EZ.canCut = (s) => !s.chal && s.grace >= D().REQ.cut && EZ.nightmareGain(s) >= 1;
  EZ.cut = function (s) {
    if (!EZ.canCut(s)) return 0;
    const g = EZ.nightmareGain(s);
    s.nightmare += g; s.nightmareCycle += g;
    s.cuts++; s.cutsTotal++;
    resetCut(s);
    EZ.log(s, 'the cage is cut. +' + EZ.fmt(g) + ' nightmare. (cut ' + s.cutsTotal + ')', 'ascend');
    return g;
  };

  EZ.canDoor = (s) => !s.chal && s.lumen >= D().REQ.door;
  EZ.openDoor = function (s) {
    if (!EZ.canDoor(s)) return false;
    s.cataclysms++;
    resetDoor(s);
    EZ.log(s, 'the door is open. the universe holds its breath, and then it does not. (cataclysm ' + s.cataclysms + ')', 'ascend');
    return true;
  };

  /* ---------- burnt timelines (challenges) ---------- */
  EZ.enterChal = function (s, id) {
    if (s.chal || !EZ.has.timelines(s)) return false;
    s.chal = id; s.chalRegens = 0;
    resetTitle(s);
    EZ.log(s, 'you step into a burning timeline: ' + D().chals.find((c) => c.id === id).name.toLowerCase() + '.', 'ascend');
    return true;
  };
  EZ.chalGoalMet = (s) => !!s.chal && D().chals.find((c) => c.id === s.chal).goal(s);
  EZ.leaveChal = function (s) {
    if (!s.chal) return false;
    const c = D().chals.find((x) => x.id === s.chal);
    const won = c.goal(s);
    if (won && !s.chalDone[c.id]) {
      s.chalDone[c.id] = 1;
      EZ.log(s, 'the timeline is ash. reward: ' + c.reward.toLowerCase(), 'ascend');
    } else if (!won) EZ.log(s, 'you flee the burning timeline.', 'ascend');
    s.chal = null;
    resetTitle(s);
    return won;
  };

  /* ---------- resets ---------- */
  function resetLife(s) {
    s.embers = 0; s.embersLife = 0; s.lifeTime = 0;
    const banked = L(s, 'shop2', 'banked');
    if (banked) s.embers = 1e3 * Math.pow(100, banked);
    // with stoking forbidden, leave a little kindling so the fire can start at all
    if (s.chal === 'glass') s.embers = Math.max(s.embers, 100);
    s.gens = {};
    const mem = L(s, 'tree', 'memory');
    if (mem) { s.gens.thought = 10 * mem; s.gens.whisper = 5 * mem; }
    if (L(s, 'tree', 'remembered')) {
      const keep = {};
      for (const k in s.ups) if (k.startsWith('rite_')) keep[k] = s.ups[k];
      s.ups = keep;
    } else s.ups = {};
    s.buffs = [];
    s.whisper.active = null;
    s.whisper.next = Math.min(s.whisper.next, 60);
    s.ghosts.n = 0;
    s.arms = {};
    s.tourney = freshTourney(s.tourney.bestEver);
    if (EZ.has.tourney(s)) s.tourney.enemyHp = EZ.enemyHp(1);
  }
  function resetTitle(s) {
    const keep = {};
    for (const d of D().tree) if (d.unlock && L(s, 'tree', d.id)) keep[d.id] = 1;
    s.tree = keep;
    const rewound = L(s, 'shop3', 'rewound');
    s.ash = rewound ? 10 * rewound * rewound : 0;
    s.ashCycle = s.ash; s.ashEarned = 0;
    s.regens = 0; s.sigils = 0; s.sigilRecord = 0; s.titleTime = 0; s.embersTitle = 0;
    s.wrath = 0; s.cds = {};
    resetLife(s);
  }
  function resetBurn(s) {
    s.slivers = 0; s.sliversCycle = 0; s.titles = 0; s.shop2 = {};
    s.artron = 10; s.fronts = { n: [0, 0, 0, 0, 0], b: [0, 0, 0, 0, 0] }; s.roar = 0;
    s.burnTime = 0;
    resetTitle(s);
  }
  function resetCut(s) {
    s.paradox = 0; s.paradoxCycle = 0; s.burns = 0;
    const keep = {};
    for (const d of D().shop3) if (d.unlock && L(s, 'shop3', d.id)) keep[d.id] = 1;
    s.shop3 = keep;
    s.siege = freshSiege(s.siege.bestChoir); s.engines = {}; s.grace = 0;
    s.cutTime = 0;
    resetBurn(s);
  }
  function resetDoor(s) {
    s.nightmare = 0; s.nightmareCycle = 0; s.cuts = 0; s.shop4 = {};
    s.hunt = { progress: 0 }; s.lumen = 0;
    resetCut(s);
  }
  EZ._resets = { resetLife, resetTitle, resetBurn, resetCut, resetDoor };

  /* ================= the tick ================= */
  function shadeOn(s, id) {
    const sh = s.shades[id];
    if (!sh || !sh.on) return false;
    const def = D().shades.find((x) => x.id === id);
    return !!def && def.unlock(s);
  }
  EZ.shadeOn = shadeOn;
  EZ.shadeVal = function (s, id, key) {
    const sh = s.shades[id];
    const def = D().shades.find((x) => x.id === id);
    const f = def.fields.find((x) => x.key === key);
    const v = sh && sh[key] !== undefined ? Number(sh[key]) : f.def;
    return isFinite(v) ? v : f.def;
  };

  function spawnWhisper(s) {
    s.whisper.active = { ttl: 13, x: EZ.rand(0.1, 0.9), y: EZ.rand(0.15, 0.85) };
    s.whisper.seen++;
    s.whisper.next = EZ.whisperInterval(s);
  }

  EZ.tick = function (s, dt) {
    if (!(dt > 0)) return;
    const d = D();
    s.playTime += dt; s.lifeTime += dt; s.titleTime += dt; s.burnTime += dt; s.cutTime += dt;
    EZ.calc(s);
    const C = EZ.C;

    // embers
    gain(s, C.eps * dt);
    if (C.autoStoke > 0) gain(s, C.click * C.autoStoke * dt);

    // buffs
    for (const b of s.buffs) b.t -= dt;
    s.buffs = s.buffs.filter((b) => b.t > 0);

    // whispers
    const w = s.whisper;
    if (w.active) {
      w.active.ttl -= dt;
      if (w.active.ttl <= 0) w.active = null;
    } else if (s.chal !== 'shadows') {
      w.next -= dt;
      if (w.next <= 0) spawnWhisper(s);
    }

    // ghosts & tournament
    if (EZ.has.crack(s)) tickGhosts(s, dt);
    if (EZ.has.tourney(s)) tickTourney(s, dt);

    // grimoire
    if (EZ.has.grimoire(s)) {
      s.wrath = Math.min(EZ.wrathMax(s), s.wrath + EZ.wrathRegen(s) * dt);
      for (const k in s.cds) s.cds[k] = Math.max(0, s.cds[k] - dt);
    }

    // time war
    if (EZ.has.timewar(s)) tickTimeWar(s, dt);
    if (EZ.has.siege(s)) tickSiege(s, dt);
    if (EZ.has.hunt(s)) tickHunt(s, dt);

    // automation
    s.misc.shadeT = (s.misc.shadeT || 0) + dt;
    if (s.misc.shadeT >= 0.25) { runShades(s); s.misc.shadeT = 0; }

    // keep everything finite: nothing in this universe may reach infinity, not even you
    for (const k of ['embers', 'embersLife', 'embersTitle', 'embersTotal', 'artron', 'artronTotal', 'sigils', 'sigilsTotal'])
      if (!(s[k] <= CAP)) s[k] = isNaN(s[k]) ? 0 : CAP;

    // bookkeeping once a second
    s.misc.slowT = (s.misc.slowT || 0) + dt;
    if (s.misc.slowT >= 1) { s.misc.slowT = 0; slowChecks(s); }
  };

  function tickGhosts(s, dt) {
    const cap = EZ.ghostCap(s);
    const g = s.ghosts;
    if (g.n < cap) {
      g.n += EZ.ghostRate(s) * (1 - g.n / cap) * dt;
      if (g.n > cap) g.n = cap;
    } else g.n = cap;
  }

  function tickTourney(s, dt) {
    const t = s.tourney;
    if (t.enemyHp < 0) t.enemyHp = EZ.enemyHp(t.bout);
    if (!t.alive) {
      t.regroup -= dt;
      if (t.regroup <= 0) EZ.sendSquad(s, false);
      if (!t.alive) return;
    }
    const atkPer = EZ.squadAtkPer(s), hpPer = EZ.squadHpPer(s);
    let rem = dt, it = 0;
    while (rem > 1e-9 && t.alive && it++ < 2000) {
      const atk = t.squad * atkPer, maxHp = t.squad * hpPer, eAtk = EZ.enemyAtk(t.bout);
      const tKill = t.enemyHp / atk;
      const tDie = (t.hpFrac * maxHp) / eAtk;
      if (tKill <= rem && tKill <= tDie) {
        rem -= tKill;
        t.hpFrac -= (eAtk * tKill) / maxHp;
        winBout(s);
      } else if (tDie <= rem) {
        rem -= tDie;
        t.enemyHp -= atk * tDie;
        s.ghosts.n = Math.max(0, s.ghosts.n - t.squad);
        t.alive = false; t.squad = 0; t.regroup = 5;
      } else {
        t.enemyHp -= atk * rem;
        t.hpFrac -= (eAtk * rem) / maxHp;
        rem = 0;
      }
    }
  }

  function winBout(s) {
    const t = s.tourney;
    const b = t.bout;
    if (EZ.isChampion(b)) {
      // the Court only pays for champions you have not already beaten this Title
      if (b > s.sigilRecord) {
        const g = EZ.sigilsFor(s, b);
        s.sigils += g; s.sigilsTotal += g;
        s.sigilRecord = b;
        if (b <= D().champions.length * 10 || b % 100 === 0)
          EZ.log(s, EZ.enemyName(b).toLowerCase() + ' falls. +' + EZ.fmt(g) + ' skull sigil' + (g === 1 ? '' : 's') + '.', 'tourney');
      }
    }
    t.best = Math.max(t.best, b);
    t.bestEver = Math.max(t.bestEver, b);
    t.bout = b + 1;
    t.enemyHp = EZ.enemyHp(t.bout);
    t.hpFrac = Math.min(1, t.hpFrac + 0.2 + 0.05 * L(s, 'arms', 'scepter'));
    t.lastProgress = s.lifeTime;
  }

  function tickTimeWar(s, dt) {
    const f = s.fronts, n = f.n;
    const m = EZ.artronMult(s);
    const fr = D().fronts;
    for (let i = n.length - 1; i >= 1; i--) {
      if (n[i] > 0) n[i - 1] += n[i] * fr[i].prod * Math.pow(2, Math.floor(f.b[i] / 10)) * dt;
    }
    const a = n[0] * fr[0].prod * Math.pow(2, Math.floor(f.b[0] / 10)) * m * dt;
    s.artron += a; s.artronTotal += a;
  }

  function tickSiege(s, dt) {
    const sg = s.siege;
    if (sg.ward < 0) sg.ward = EZ.wardMax(sg.choir);
    const dps = EZ.siegeDps(s);
    let rem = dt, it = 0;
    while (rem > 0 && it++ < 100) {
      const max = EZ.wardMax(sg.choir), regen = EZ.wardRegen(s, sg.choir);
      const net = dps - regen;
      if (net > 0 && sg.ward / net <= rem) {
        rem -= sg.ward / net;
        const g = (sg.choir + 1) * Math.pow(2, L(s, 'shop4', 'theft'));
        s.grace += g; s.graceTotal += g;
        const name = sg.choir < D().choirs.length ? D().choirs[sg.choir] : 'Heaven’s Gate (echo ' + (sg.choir - D().choirs.length + 2) + ')';
        EZ.log(s, name.toLowerCase() + ' break. +' + EZ.fmt(g) + ' grace.', 'siege');
        sg.choir++;
        sg.bestChoir = Math.max(sg.bestChoir, sg.choir);
        sg.ward = EZ.wardMax(sg.choir);
      } else {
        sg.ward = EZ.clamp(sg.ward - net * rem, 0, max);
        rem = 0;
      }
    }
  }

  function tickHunt(s, dt) {
    const d = D();
    if (s.lumen >= d.lumen.length) return;
    s.hunt.progress += EZ.huntPower(s) * dt;
    let it = 0;
    while (s.lumen < d.lumen.length && s.hunt.progress >= d.lumen[s.lumen].light && it++ < 10) {
      s.hunt.progress -= d.lumen[s.lumen].light;
      const target = d.lumen[s.lumen];
      s.lumen++;
      EZ.log(s, target.name.toLowerCase() + '’s light goes out. ' + target.boon.toLowerCase(), 'lumen');
    }
    if (s.lumen >= d.lumen.length) s.hunt.progress = 0;
  }

  /* ---------- shades (automation) ---------- */
  function runShades(s) {
    const d = D();
    EZ.calc(s);
    if (shadeOn(s, 'listener') && s.whisper.active) EZ.clickWhisper(s);
    if (shadeOn(s, 'kindler')) {
      const budget0 = s.embers * EZ.shadeVal(s, 'kindler', 'pct') / 100;
      let spent = 0;
      for (let k = 0; k < 200; k++) {
        let best = null, bestV = 0;
        for (const g of d.gens) {
          if (!EZ.isVisible(s, g) || EZ.blocked(s, g)) continue;
          const c = g.cost(s, g.level(s));
          if (spent + c > budget0) continue;
          const v = (EZ.C.genProd[g.id] || g.prod) / c;
          if (v > bestV) { bestV = v; best = g; }
        }
        if (!best) break;
        spent += best.cost(s, best.level(s));
        EZ.buy(s, best, 1);
      }
    }
    if (shadeOn(s, 'rites')) {
      const pct = EZ.shadeVal(s, 'rites', 'pct') / 100;
      for (const u of d.rites) {
        if (!EZ.isVisible(s, u)) continue;
        for (let k = 0; k < 20 && !EZ.blocked(s, u) && u.cost(s, u.level(s)) <= s.embers * pct; k++) EZ.buy(s, u, 1);
      }
    }
    if (shadeOn(s, 'armourer')) buyCheapest(s, d.arms, s.embers * EZ.shadeVal(s, 'armourer', 'pct') / 100, 300);
    if (shadeOn(s, 'ashen')) buyCheapest(s, d.tree, Infinity, 100);
    if (shadeOn(s, 'gifts')) buyCheapest(s, d.shop2, Infinity, 100);
    if (shadeOn(s, 'warfront')) {
      for (let i = d.fronts.length - 1; i >= 0; i--) if (EZ.isVisible(s, d.fronts[i])) EZ.buy(s, d.fronts[i], 'max');
      EZ.buy(s, d.roar, 'max');
    }
    if (shadeOn(s, 'siege')) { buyCheapest(s, d.engines, Infinity, 300); buyCheapest(s, d.shop3, Infinity, 100); }
    if (shadeOn(s, 'grim') && EZ.has.grimoire(s)) { EZ.cast(s, 'breath'); EZ.cast(s, 'torment'); EZ.cast(s, 'hellspawn'); }
    if (shadeOn(s, 'regen') && EZ.canRegen(s)) {
      const ashAt = EZ.shadeVal(s, 'regen', 'ash'), stall = EZ.shadeVal(s, 'regen', 'stall'), min = EZ.shadeVal(s, 'regen', 'min');
      if (s.lifeTime >= min) {
        const byAsh = ashAt > 0 && EZ.ashGain(s) >= ashAt;
        const t = s.tourney;
        const byStall = stall > 0 && EZ.has.tourney(s) && s.lifeTime - t.lastProgress >= stall && s.lifeTime >= stall;
        if (byAsh || byStall) EZ.regenerate(s);
      }
    }
    if (shadeOn(s, 'title') && EZ.canTitle(s) && s.sigils >= EZ.shadeVal(s, 'title', 'sigils')) EZ.claimTitle(s);
    if (shadeOn(s, 'burn') && EZ.canBurn(s) && EZ.paradoxGain(s) >= EZ.shadeVal(s, 'burn', 'paradox')) EZ.burn(s);
  }

  function buyCheapest(s, list, budget, maxBuys) {
    let spent = 0;
    for (let k = 0; k < maxBuys; k++) {
      let best = null, bestC = Infinity;
      for (const u of list) {
        if (!EZ.isVisible(s, u) || EZ.blocked(s, u)) continue;
        const c = u.cost(s, u.level(s));
        if (c < bestC) { bestC = c; best = u; }
      }
      if (!best || spent + bestC > budget) break;
      spent += bestC;
      EZ.buy(s, best, 1);
    }
  }
  EZ.buyCheapest = buyCheapest;

  /* ---------- once-a-second bookkeeping ---------- */
  function slowChecks(s) {
    const d = D();
    for (const o of d.omens) {
      if (!s.omens[o.id] && o.test(s)) {
        s.omens[o.id] = 1;
        EZ.log(s, 'an omen: ' + o.name + '.', 'omen');
        if (EZ.onOmen) EZ.onOmen(o);
      }
    }
    while (s.rank < d.ranks.length - 1 && d.ranks[s.rank + 1].test(s)) {
      s.rank++;
      EZ.log(s, 'you rise in the hierarchy. rank ' + EZ.roman(d.ranks[s.rank].n) + ': ' + d.ranks[s.rank].name.toLowerCase() + '.', 'rank');
    }
    for (const st of d.story) {
      if (!s.flags.story[st.id] && st.when(s)) {
        s.flags.story[st.id] = 1;
        EZ.log(s, st.text, 'story');
      }
    }
    for (const g of d.gens) if (g.visible(s)) s.flags.seenGen = Math.max(s.flags.seenGen, g.idx);
    // a newly called shade starts working at once, except the ones that would reset your progress
    for (const sh of d.shades) {
      if (!s.shades[sh.id] && sh.unlock(s)) {
        s.shades[sh.id] = { on: ['regen', 'title', 'burn'].indexOf(sh.id) < 0 };
        EZ.log(s, 'a shade answers your call: ' + sh.name.toLowerCase() + '.', 'omen');
      }
    }
    // ambient murmurs, rarely
    if (s.playTime > 120 && Math.random() < 1 / 240) EZ.log(s, EZ.pick(d.ambient), 'ambient');
  }

  EZ.log = function (s, text, cls) {
    s.log.push({ t: Date.now(), text, cls: cls || '' });
    if (s.log.length > 80) s.log.splice(0, s.log.length - 80);
    if (EZ.onLog) EZ.onLog(text, cls);
  };

  /* ================= offline & saving ================= */
  EZ.offlineEff = (s) => Math.min(1, 0.25 + 0.15 * L(s, 'tree', 'smoulder'));

  /** Simulate `seconds` of absence. Returns a summary. */
  EZ.simulate = function (s, seconds, eff) {
    eff = eff === undefined ? 1 : eff;
    const before = { embers: s.embersTotal, ash: s.ashTotal, sigils: s.sigilsTotal, artron: s.artronTotal, grace: s.graceTotal };
    let total = seconds * eff;
    const steps = Math.min(4000, Math.max(1, Math.ceil(total / 0.5)));
    const dt = total / steps;
    const muteLog = EZ.onLog;
    EZ.onLog = null;
    for (let i = 0; i < steps; i++) EZ.tick(s, dt);
    EZ.onLog = muteLog;
    return {
      seconds, eff,
      embers: s.embersTotal - before.embers, ash: s.ashTotal - before.ash, sigils: s.sigilsTotal - before.sigils,
      artron: s.artronTotal - before.artron, grace: s.graceTotal - before.grace,
    };
  };

  EZ.serialize = (s) => JSON.stringify(s);
  EZ.exportSave = function (s) {
    const json = EZ.serialize(s);
    return typeof btoa !== 'undefined' ? btoa(unescape(encodeURIComponent(json))) : Buffer.from(json).toString('base64');
  };
  EZ.importSave = function (str) {
    str = String(str).trim();
    let json;
    try { json = decodeURIComponent(escape(atob(str))); } catch (e) { json = str; }
    return EZ.hydrate(JSON.parse(json));
  };

  /** Merge a loaded object onto fresh defaults so new fields always exist. */
  EZ.hydrate = function (obj) {
    const base = EZ.newState();
    (function merge(dst, src) {
      for (const k in src) {
        if (src[k] && typeof src[k] === 'object' && !Array.isArray(src[k]) && dst[k] && typeof dst[k] === 'object' && !Array.isArray(dst[k])) merge(dst[k], src[k]);
        else dst[k] = src[k];
      }
    })(base, obj);
    if (base.fronts.n.length < 5) { while (base.fronts.n.length < 5) { base.fronts.n.push(0); base.fronts.b.push(0); } }
    return base;
  };

  /* Storage can be missing or throw (private windows, sandboxed frames), so every access is guarded. */
  function store() { try { return root.localStorage || null; } catch (e) { return null; } }
  EZ.save = function (s) {
    s.lastSave = Date.now();
    try { const st = store(); if (!st) return false; st.setItem(SAVE_KEY, EZ.serialize(s)); return true; } catch (e) { return false; }
  };
  EZ.load = function () {
    try {
      const st = store();
      const raw = st && st.getItem(SAVE_KEY);
      return raw ? EZ.hydrate(JSON.parse(raw)) : null;
    } catch (e) { return null; }
  };
  EZ.wipe = function () { try { const st = store(); if (st) st.removeItem(SAVE_KEY); } catch (e) { /* ignore */ } };

  EZ.init = function () { prepGens(); };
  if (EZ.DATA) prepGens();
})(typeof window !== 'undefined' ? window : globalThis);
