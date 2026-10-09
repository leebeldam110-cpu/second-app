#!/usr/bin/env node
/* Headless balance simulator: a greedy bot plays the real engine and reports when each tier is reached.
 * Usage: node tools/sim.js [hours=72] [dt=1] */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

for (const f of ['util.js', 'data.js', 'engine.js']) {
  vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), { filename: f });
}
const EZ = globalThis.EZ;
EZ.init();
const D = EZ.DATA;

const HOURS = Number(process.argv[2] || 72);
const DT = Number(process.argv[3] || 1);
const s = EZ.newState();
const L = (st, id) => EZ.L(s, st, id);
const marks = [];
const mark = (what) => { marks.push([s.playTime, what]); console.log(EZ.fmtTime(s.playTime).padStart(9), ' ', what); };

let clickAcc = 0;
function bot() {
  EZ.calc(s);
  // manual stoking while there is no shade to do it (4/s)
  if (!EZ.shadeOn(s, 'stoker') && s.chal !== 'glass') { clickAcc += 4 * DT; const n = Math.floor(clickAcc); clickAcc -= n; if (n) EZ.stoke(s, n); }
  if (s.whisper.active && Math.random() < 0.8) EZ.clickWhisper(s);
  // turn on every shade we have
  for (const sh of D.shades) if (sh.unlock(s) && !s.shades[sh.id]) {
    s.shades[sh.id] = { on: true };
    if (sh.id === 'regen') Object.assign(s.shades.regen, { ash: 0, stall: 90, min: 60 });
  }
  // kindlings: best value
  for (let k = 0; k < 300; k++) {
    let best = null, bv = 0;
    for (const g of D.gens) {
      if (!EZ.isVisible(s, g) || EZ.blocked(s, g)) continue;
      const v = (EZ.C.genProd[g.id] || g.prod) / g.cost(s, g.level(s));
      if (v > bv) { bv = v; best = g; }
    }
    if (!best) break;
    EZ.buy(s, best, 1);
    EZ.calc(s);
  }
  for (const u of D.rites) if (EZ.isVisible(s, u)) EZ.buy(s, u, 'max');
  // tree: unlocks first
  for (const id of ['crack', 'herald']) { const d = D.tree.find((x) => x.id === id); EZ.buy(s, d, 1); }
  EZ.buyCheapest(s, D.tree, Infinity, 100);
  if (EZ.has.crack(s)) EZ.buyCheapest(s, D.arms, s.embers * 0.3, 200);
  EZ.buyCheapest(s, D.shop2, Infinity, 100);
  if (EZ.has.timewar(s)) {
    for (let i = D.fronts.length - 1; i >= 0; i--) if (EZ.isVisible(s, D.fronts[i])) EZ.buy(s, D.fronts[i], 'max');
    EZ.buy(s, D.roar, 'max');
  }
  if (EZ.has.grimoire(s)) { EZ.cast(s, 'breath'); EZ.cast(s, 'torment'); EZ.cast(s, 'hellspawn'); }
  if (EZ.has.siege(s)) { EZ.buyCheapest(s, D.engines, Infinity, 300); EZ.buyCheapest(s, D.shop3, Infinity, 100); }
  EZ.buyCheapest(s, D.shop4, Infinity, 100);

  // ascension decisions
  const t = s.tourney;
  if (EZ.canRegen(s) && !EZ.shadeOn(s, 'regen')) {
    const g = EZ.ashGain(s);
    const stalled = EZ.has.tourney(s) && s.lifeTime - t.lastProgress > 120 && s.lifeTime > 120;
    if (g >= Math.max(1, s.ashEarned) || (stalled && g >= 0.25 * s.ashEarned) || (s.regensTotal === 0 && g >= 11)) {
      const before = s.regensTotal; EZ.regenerate(s);
      if (before < 3) mark('regenerate #' + s.regensTotal + ' (+' + EZ.fmt(g) + ' ash, ashCycle ' + EZ.fmt(s.ashCycle) + ')');
    }
  }
  if (s.chal) {
    if (EZ.chalGoalMet(s)) { const id = s.chal; EZ.leaveChal(s); mark('completed timeline ' + id); }
    else if (s.titleTime > 4 * 3600) { const id = s.chal; EZ.leaveChal(s); mark('gave up timeline ' + id); }
  }
  if (EZ.canTitle(s) && (EZ.sliverGain(s) >= Math.max(3, s.sliversCycle * 0.5) || s.titleTime > 3600)) {
    const g = EZ.claimTitle(s); if (s.titlesTotal <= 5 || s.titlesTotal % 10 === 0) mark('TITLE #' + s.titlesTotal + ' (+' + g + ' slivers, cycle ' + s.sliversCycle + ')');
  }
  if (EZ.canBurn(s) && (EZ.paradoxGain(s) >= Math.max(3, s.paradoxCycle * 0.5) || s.burnTime > 4 * 3600)) {
    const g = EZ.burn(s); mark('BURN #' + s.burnsTotal + ' (+' + g + ' paradox, cycle ' + s.paradoxCycle + ')');
    // try the next undone timeline right after a burn
    const c = D.chals.find((x) => !s.chalDone[x.id]);
    if (c && s.burnsTotal >= 2) { EZ.enterChal(s, c.id); mark('enter timeline ' + c.id); }
  }
  if (EZ.canCut(s) && (EZ.nightmareGain(s) >= Math.max(5, s.nightmareCycle * 0.5) || s.cutTime > 8 * 3600)) { const g = EZ.cut(s); mark('CUT #' + s.cutsTotal + ' (+' + g + ' nightmare)'); }
  if (EZ.canDoor(s)) { EZ.openDoor(s); mark('DOOR OPENED (cataclysm ' + s.cataclysms + ')'); }
}

let lastReport = 0, lastLumen = 0;
const end = HOURS * 3600;
while (s.playTime < end) {
  bot();
  EZ.tick(s, DT);
  if (s.lumen > lastLumen) { lastLumen = s.lumen; mark('lumen ' + s.lumen + ' extinguished'); }
  if (s.playTime - lastReport >= 3600 * (HOURS > 24 ? 6 : 1)) {
    lastReport = s.playTime;
    console.log('   [' + EZ.fmtTime(s.playTime) + '] eps ' + EZ.fmt(EZ.C.eps) + ' embersLife ' + EZ.fmt(s.embersLife) +
      ' ash ' + EZ.fmt(s.ashCycle) + ' sigils ' + EZ.fmt(s.sigils) + ' bout ' + s.tourney.best + '/' + s.tourney.bestEver +
      ' ghosts ' + Math.floor(s.ghosts.n) + '/' + Math.floor(EZ.ghostCap(s)) + ' titles ' + s.titlesTotal + ' artron ' + EZ.fmt(s.artron) +
      ' burns ' + s.burnsTotal + ' chal ' + Object.keys(s.chalDone).length + (s.chal ? '(' + s.chal + ')' : '') +
      ' grace ' + EZ.fmt(s.grace) + ' choir ' + s.siege.choir + ' dps ' + EZ.fmt(EZ.siegeDps(s)) + ' cuts ' + s.cutsTotal + ' lumen ' + s.lumen +
      ' hunt ' + EZ.fmt(EZ.huntPower(s)) + '/s');
  }
}
console.log('omens', Object.keys(s.omens).length, '/', D.omens.length, 'rank', D.ranks[s.rank].n);
if (process.env.SAVE_OUT) {
  s.lastTick = Date.now();
  fs.writeFileSync(process.env.SAVE_OUT, JSON.stringify(s));
  console.log('state written to', process.env.SAVE_OUT);
}
